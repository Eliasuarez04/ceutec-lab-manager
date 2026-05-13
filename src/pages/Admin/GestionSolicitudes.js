import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { db } from '../../firebaseConfig';
import { collection, query, where, getDocs, doc, updateDoc, runTransaction, Timestamp} from 'firebase/firestore';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import Modal from '../../components/Modal';
import { useAuth } from '../../context/AuthContext';
import { useSearchParams, Link } from 'react-router-dom'; // 🔥 IMPORTACIÓN NECESARIA
import '../styles/GestionSolicitudes.css';
import '../../pages/styles/Dashboard.css'; 

const RequestCard = ({ request, onAdvanceStatus, onOpenClosureModal }) => {
  const isPending = request.fulfillmentStatus === 'Pendiente';

  return (
    <div className="request-card">
      <div className="request-header">
        <div>
          <h3>{request.labName}</h3>
          <p>{format(request.startTime.toDate(), 'eeee, dd MMM')} @ {format(request.startTime.toDate(), 'HH:mm')}</p>
        </div>
        <span className={`status-tag ${request.fulfillmentStatus.toLowerCase().replace(/\s+/g, '-')}`}>
          {request.fulfillmentStatus}
        </span>
      </div>
      <div className="request-details">
        <p><strong>Docente:</strong> {request.userEmail}</p>
        <p><strong>Motivo:</strong> {request.purpose}</p>
      </div>
      <div className="items-list">
        <h4>Material Solicitado</h4>
        {request.requestedItems && request.requestedItems.length > 0 ? (
          <ul>
            {request.requestedItems.map(item => (
              <li key={item.itemId}>{item.quantity} x {item.itemName}</li>
            ))}
          </ul>
        ) : <p style={{ fontStyle: 'italic', color: '#888' }}>Sin material solicitado.</p>}
      </div>
      <div className="card-actions">
        <button 
          className={`action-button ${isPending ? 'pending' : 'in-use'}`}
          onClick={() => isPending ? onAdvanceStatus(request.id, 'En Uso') : onOpenClosureModal(request)}
          disabled={!request.requestedItems || request.requestedItems.length === 0}
        >
          {isPending ? 'Marcar como Entregado' : 'Confirmar Devolución'}
        </button>
      </div>
    </div>
  );
};

export default function GestionSolicitudes() {
  const { currentUser, userData } = useAuth();
  const [searchParams] = useSearchParams();
  
  // 🔥 PARCHE 2: Obtenemos la sede actual para filtrar
  const currentSede = searchParams.get('sede') || userData?.sede || "";

  const [allRequests, setAllRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pendiente');

  const [isClosureModalOpen, setIsClosureModalOpen] = useState(false);
  const [currentRequest, setCurrentRequest] = useState(null);
  const [itemStatuses, setItemStatuses] = useState({});
  const [noveltyNotes, setNoveltyNotes] = useState({});

  const fetchRequests = useCallback(async () => {
    if (!currentSede) return;
    setLoading(true);
    try {
      // 🔥 PARCHE 2 Y 3: Filtramos por sede y quitamos el orderBy de Firebase para evitar errores de índices
      const q = query(
        collection(db, 'reservations'),
        where('sede', '==', currentSede),
        where('fulfillmentStatus', 'in', ['Pendiente', 'En Uso'])
      );
      
      const querySnapshot = await getDocs(q);
      const requestsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Ordenamos las solicitudes por fecha directamente en JavaScript (Es gratis y más rápido)
      requestsData.sort((a, b) => a.startTime.toDate() - b.startTime.toDate());
      
      setAllRequests(requestsData);
    } catch (error) {
      console.error("Error fetching requests:", error);
      toast.error("No se pudieron cargar las solicitudes.");
    } finally {
      setLoading(false);
    }
  }, [currentSede]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const { pendingRequests, inUseRequests } = useMemo(() => {
    const pending = allRequests.filter(req => req.fulfillmentStatus === 'Pendiente');
    const inUse = allRequests.filter(req => req.fulfillmentStatus === 'En Uso');
    return { pendingRequests: pending, inUseRequests: inUse };
  }, [allRequests]);

  const handleAdvanceStatus = async (requestId, newStatus) => {
    const docRef = doc(db, 'reservations', requestId);
    const promise = updateDoc(docRef, { fulfillmentStatus: newStatus });
    toast.promise(promise, {
      loading: 'Actualizando estado...', success: `Estado actualizado a "${newStatus}".`, error: 'Error al actualizar.'
    }).then(() => {
      fetchRequests();
    });
  };

  const handleOpenClosureModal = (request) => {
    setCurrentRequest(request);
    const initialStatuses = {};
    request.requestedItems.forEach(item => {
      initialStatuses[item.itemId] = 'OK';
    });
    setItemStatuses(initialStatuses);
    setNoveltyNotes({});
    setIsClosureModalOpen(true);
  };

  const handleStatusChange = (itemId, status) => {
    setItemStatuses(prev => ({ ...prev, [itemId]: status }));
  };

  const handleNoteChange = (itemId, note) => {
    setNoveltyNotes(prev => ({ ...prev, [itemId]: note }));
  };

  const handleClosureSubmit = async () => {
    const closingToast = toast.loading('Procesando devolución...');
    try {
      const reservationRef = doc(db, 'reservations', currentRequest.id);
      
      const noveltyPromises = currentRequest.requestedItems
        .filter(item => itemStatuses[item.itemId] === 'Novedad')
        .map(async (item) => {
          // 🔥 PARCHE 1: Corregimos la ruta de 'laboratories' a 'spaces'
          const itemRef = doc(db, 'spaces', currentRequest.labId, 'equipment', item.itemId);
          const note = noveltyNotes[item.itemId] || 'Sin detalles.';
          
          await runTransaction(db, async (transaction) => {
            const itemDoc = await transaction.get(itemRef);
            if (!itemDoc.exists()) { throw new Error(`El ítem ${item.itemName} no fue encontrado en la base de datos.`); }
            
            const newQuantity = itemDoc.data().quantity - 1;
            transaction.update(itemRef, { quantity: newQuantity < 0 ? 0 : newQuantity });

            const logData = {
              labId: currentRequest.labId, labName: currentRequest.labName, itemId: item.itemId,
              itemName: item.itemName, userEmail: currentUser.email, changeType: 'Novedad Reportada',
              quantityChange: -1, newQuantity: newQuantity < 0 ? 0 : newQuantity,
              timestamp: Timestamp.now(), notes: `Reserva de ${currentRequest.userEmail}. Novedad: ${note}`
            };
            const logRef = doc(collection(db, 'inventory_logs'));
            transaction.set(logRef, logData);
          });
        });

      await Promise.all(noveltyPromises);
      await updateDoc(reservationRef, { fulfillmentStatus: 'Devuelto' });

      toast.dismiss(closingToast);
      toast.success('Devolución procesada con éxito.');
      setIsClosureModalOpen(false);
      fetchRequests();

    } catch (error) {
      toast.dismiss(closingToast);
      toast.error(`Error al procesar la devolución: ${error.message}`);
      console.error(error);
    }
  };

  const renderContent = (requests) => {
    if (loading) return <p style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>Cargando solicitudes...</p>;
    if (requests.length === 0) return <p style={{ padding: '3rem', textAlign: 'center', background: 'white', borderRadius: '15px', boxShadow: '0 4px 10px rgba(0,0,0,0.05)', color: '#94a3b8', fontWeight: 'bold' }}>No hay solicitudes en esta categoría para {currentSede}.</p>;
    
    return (
      <div className="requests-grid">
        {requests.map(req => (
          <RequestCard 
            key={req.id} 
            request={req} 
            onAdvanceStatus={handleAdvanceStatus}
            onOpenClosureModal={handleOpenClosureModal}
          />
        ))}
      </div>
    );
  };

  return (
    <>
      <Modal isOpen={isClosureModalOpen} onClose={() => setIsClosureModalOpen(false)} title="Verificar Devolución de Material">
        {currentRequest && (
          <div className="closure-form">
            <p style={{marginBottom: '15px'}}>Verifica el estado del material devuelto para la reserva de <strong>{currentRequest.userEmail}</strong>.</p>
            <div className="closure-items-list" style={{display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '20px'}}>
              {currentRequest.requestedItems.map(item => (
                <div key={item.itemId} className="closure-item-row" style={{background: '#f8fafc', padding: '15px', borderRadius: '10px', border: '1px solid #e2e8f0'}}>
                  <div className="item-info" style={{display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px'}}>
                    <span className="item-quantity" style={{background: '#1e293b', color: 'white', padding: '2px 8px', borderRadius: '6px', fontWeight: 'bold'}}>{item.quantity}x</span>
                    <span className="item-name" style={{fontWeight: '700', color: '#334155'}}>{item.itemName}</span>
                  </div>
                  <div className="item-status-selector" style={{display: 'flex', gap: '10px'}}>
                    <button 
                      type="button"
                      className={`status-btn ok ${itemStatuses[item.itemId] === 'OK' ? 'active' : ''}`}
                      onClick={() => handleStatusChange(item.itemId, 'OK')}
                      style={{flex: 1, padding: '10px', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer', background: itemStatuses[item.itemId] === 'OK' ? '#22c55e' : '#e2e8f0', color: itemStatuses[item.itemId] === 'OK' ? 'white' : '#64748b'}}
                    >Devuelto OK</button>
                    <button 
                      type="button"
                      className={`status-btn novelty ${itemStatuses[item.itemId] === 'Novedad' ? 'active' : ''}`}
                      onClick={() => handleStatusChange(item.itemId, 'Novedad')}
                      style={{flex: 1, padding: '10px', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer', background: itemStatuses[item.itemId] === 'Novedad' ? '#ef4444' : '#e2e8f0', color: itemStatuses[item.itemId] === 'Novedad' ? 'white' : '#64748b'}}
                    >Reportar Novedad</button>
                  </div>
                  {itemStatuses[item.itemId] === 'Novedad' && (
                    <textarea 
                      className="novelty-notes"
                      placeholder="Describe el daño o la pérdida para el reporte de inventario..."
                      value={noveltyNotes[item.itemId] || ''}
                      onChange={(e) => handleNoteChange(item.itemId, e.target.value)}
                      style={{width: '100%', marginTop: '10px', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', boxSizing: 'border-box'}}
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="modal-actions" style={{display: 'flex', gap: '10px', justifyContent: 'flex-end'}}>
              <button type="button" className="action-btn cancel-btn" onClick={() => setIsClosureModalOpen(false)} style={{padding: '12px 20px', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer', background: '#f1f5f9', color: '#64748b'}}>Cancelar</button>
              <button type="button" className="action-btn save-btn" onClick={handleClosureSubmit} style={{padding: '12px 20px', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer', background: '#c8102e', color: 'white'}}>Cerrar Préstamo</button>
            </div>
          </div>
        )}
      </Modal>

      <div className="dashboard-wrapper">
        <div className="requests-page-card">
          <div className="page-container" style={{maxWidth: '1200px', margin: '0 auto', width: '100%'}}>
            <header style={{marginBottom: '30px'}}>
                <Link to={`/dashboard?sede=${encodeURIComponent(currentSede)}`} className="back-link-simple" style={{textDecoration: 'none', color: '#c8102e', fontWeight: 'bold', marginBottom: '15px', display: 'inline-block'}}>← Volver al Dashboard</Link>
                <h1 style={{margin: '0 0 5px 0', color: '#1e293b'}}>📦 Gestión de Solicitudes</h1>
                <p style={{color: '#64748b', margin: 0, fontWeight: '600'}}>Administración de recursos solicitados en <strong>{currentSede}</strong></p>
            </header>
            
            <div className="tabs" style={{display: 'flex', gap: '10px', marginBottom: '25px', background: 'white', padding: '5px', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.02)'}}>
              <button 
                className={activeTab === 'pendiente' ? 'active' : ''} 
                onClick={() => setActiveTab('pendiente')}
                style={{flex: 1, padding: '15px', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', background: activeTab === 'pendiente' ? '#1e293b' : 'transparent', color: activeTab === 'pendiente' ? 'white' : '#64748b', transition: '0.2s'}}
              >
                📥 Pendientes de Entrega ({pendingRequests.length})
              </button>
              <button 
                className={activeTab === 'en_uso' ? 'active' : ''} 
                onClick={() => setActiveTab('en_uso')}
                style={{flex: 1, padding: '15px', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', background: activeTab === 'en_uso' ? '#c8102e' : 'transparent', color: activeTab === 'en_uso' ? 'white' : '#64748b', transition: '0.2s'}}
              >
                ⏱️ En Uso Actual ({inUseRequests.length})
              </button>
            </div>
            
            <div className="tab-content">
              {activeTab === 'pendiente' ? renderContent(pendingRequests) : renderContent(inUseRequests)}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}