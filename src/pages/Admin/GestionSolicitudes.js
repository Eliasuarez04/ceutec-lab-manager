// src/pages/Admin/GestionSolicitudes.js
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../firebaseConfig';
import { collection, query, where, getDocs, orderBy, doc, updateDoc } from 'firebase/firestore';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import '../styles/GestionSolicitudes.css';

// --- Componente para una Tarjeta de Solicitud Individual ---
const RequestCard = ({ request, onAdvanceStatus }) => {
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
        <ul>
          {request.requestedItems.map(item => (
            <li key={item.itemId}>{item.quantity} x {item.itemName}</li>
          ))}
        </ul>
      </div>
      <div className="card-actions">
        <button 
          className={`action-button ${isPending ? 'pending' : 'in-use'}`}
          onClick={() => onAdvanceStatus(request.id, isPending ? 'En Uso' : 'Devuelto')}
        >
          {isPending ? 'Marcar como Entregado' : 'Confirmar Devolución'}
        </button>
      </div>
    </div>
  );
};


export default function GestionSolicitudes() {
  const [allRequests, setAllRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pendiente');

  const fetchRequests = async () => {
    setLoading(true);
    try {
      // Traer todas las solicitudes que no estén 'Devuelto' o 'Sin Solicitud'
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
      loading: 'Actualizando estado...',
      success: `Estado actualizado a "${newStatus}".`,
      error: 'Error al actualizar el estado.'
    }).then(() => {
      fetchRequests(); // Recargar la lista
    });
  };

  const renderContent = (requests) => {
    if (loading) return <p>Cargando solicitudes...</p>;
    if (requests.length === 0) return <p>No hay solicitudes en esta categoría.</p>;
    
    return (
      <div className="requests-grid">
        {requests.map(req => (
          <RequestCard key={req.id} request={req} onAdvanceStatus={handleAdvanceStatus} />
        ))}
      </div>
    );
  };

  return (
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
  );
}