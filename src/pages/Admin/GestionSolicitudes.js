// src/pages/Admin/GestionSolicitudes.js
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../firebaseConfig';
import { collection, query, where, getDocs, orderBy, doc, updateDoc, runTransaction, Timestamp} from 'firebase/firestore';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import Modal from '../../components/Modal';
import { useAuth } from '../../context/AuthContext';
import '../styles/GestionSolicitudes.css';
import '../../pages/styles/Dashboard.css'; 

// --- Componente para una Tarjeta de Solicitud Individual (ACTUALIZADO) ---
const RequestCard = ({ request, onAdvanceStatus, onOpenClosureModal }) => {
  const isPending = request.fulfillmentStatus === 'Pendiente';

  return (
    <div className="request-card">
      <div className="request-header">
        <div>
          <h3>{request.labName}</h3>
          <p>{format(request.startTime.toDate(), 'eeee, dd MMM')} @ {format(request.startTime.toDate(), 'HH:mm')}</p>
        </div>
        <span className={`status-tag ${request.fulfillmentStatus.toLowerCase()}`}>
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
  const { currentUser } = useAuth();
  const [allRequests, setAllRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pendiente');

  const [isClosureModalOpen, setIsClosureModalOpen] = useState(false);
  const [currentRequest, setCurrentRequest] = useState(null);
  const [itemStatuses, setItemStatuses] = useState({});
  const [noveltyNotes, setNoveltyNotes] = useState({});

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'reservations'),
        where('fulfillmentStatus', 'in', ['Pendiente', 'En Uso']),
        orderBy('startTime', 'asc')
      );
      const querySnapshot = await getDocs(q);
      const requestsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAllRequests(requestsData);
    } catch (error) {
      console.error("Error fetching requests:", error);
      toast.error("No se pudieron cargar las solicitudes.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

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
          const itemRef = doc(db, 'laboratories', currentRequest.labId, 'equipment', item.itemId);
          const note = noveltyNotes[item.itemId] || 'Sin detalles.';
          
          await runTransaction(db, async (transaction) => {
            const itemDoc = await transaction.get(itemRef);
            if (!itemDoc.exists()) { throw new Error(`El ítem ${item.itemName} no fue encontrado.`); }
            
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
    if (loading) return <p style={{ padding: '2rem', textAlign: 'center' }}>Cargando solicitudes...</p>;
    if (requests.length === 0) return <p style={{ padding: '2rem', textAlign: 'center', background: 'white', borderRadius: '15px', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>No hay solicitudes en esta categoría.</p>;
    
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
            <p>Verifica el estado del material devuelto para la reserva de <strong>{currentRequest.userEmail}</strong>.</p>
            <div className="closure-items-list">
              {currentRequest.requestedItems.map(item => (
                <div key={item.itemId} className="closure-item-row">
                  <div className="item-info">
                    <span className="item-quantity">{item.quantity}x</span>
                    <span className="item-name">{item.itemName}</span>
                  </div>
                  <div className="item-status-selector">
                    <button 
                      className={`status-btn ok ${itemStatuses[item.itemId] === 'OK' ? 'active' : ''}`}
                      onClick={() => handleStatusChange(item.itemId, 'OK')}
                    >Devuelto OK</button>
                    <button 
                      className={`status-btn novelty ${itemStatuses[item.itemId] === 'Novedad' ? 'active' : ''}`}
                      onClick={() => handleStatusChange(item.itemId, 'Novedad')}
                    >Reportar Novedad</button>
                  </div>
                  {itemStatuses[item.itemId] === 'Novedad' && (
                    <textarea 
                      className="novelty-notes"
                      placeholder="Describe la novedad (ej: dañado, no devuelto)..."
                      value={noveltyNotes[item.itemId] || ''}
                      onChange={(e) => handleNoteChange(item.itemId, e.target.value)}
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="modal-actions">
              <button type="button" className="action-btn cancel-btn" onClick={() => setIsClosureModalOpen(false)}>Cancelar</button>
              <button type="button" className="action-btn save-btn" onClick={handleClosureSubmit}>Cerrar Préstamo</button>
            </div>
          </div>
        )}
      </Modal>

      
{/* APLICAMOS EL FONDO GLOBAL */}
      <div className="dashboard-wrapper">
        <div className="requests-page-card"> {/* CONTENEDOR DE CRISTAL */}
          <div className="page-container">
            <h1>Gestión de Solicitudes</h1>
            <div className="tabs">
              <button className={activeTab === 'pendiente' ? 'active' : ''} onClick={() => setActiveTab('pendiente')}>
                Pendientes ({pendingRequests.length})
              </button>
              <button className={activeTab === 'en_uso' ? 'active' : ''} onClick={() => setActiveTab('en_uso')}>
                En Uso ({inUseRequests.length})
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