// src/pages/Admin/MaintenanceTickets.js
import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { useSearchParams, Link } from 'react-router-dom';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import '../styles/MaintenanceTickets.css';

export default function MaintenanceTickets() {
  const [searchParams] = useSearchParams();
  const currentSede = searchParams.get('sede') || "";
  const [tickets, setTickets] = useState([]);

  useEffect(() => {
    if (!currentSede) return;
    // Buscamos reservas que terminaron con incidencias
    const q = query(
      collection(db, 'reservations'), 
      where('sede', '==', currentSede),
      where('fulfillmentStatus', '==', 'Completada (Con Incidencias)')
    );

    const unsub = onSnapshot(q, (snap) => {
      setTickets(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [currentSede]);

  const resolveTicket = async (ticketId) => {
    try {
      await updateDoc(doc(db, 'reservations', ticketId), { 
        fulfillmentStatus: 'Completada (Incidencia Resuelta)',
        resolvedAt: new Date()
      });
      toast.success("Incidencia marcada como resuelta.");
    } catch (e) { toast.error("Error al actualizar."); }
  };

  return (
    <div className="dashboard-wrapper">
      <div className="maintenance-container-glass fade-in">
        <header className="page-header-pro">
          <Link to={`/dashboard?sede=${currentSede}`} className="back-link-tech">← Dashboard</Link>
          <h1>Panel de Soporte Técnico: <span className="red-text">{currentSede}</span></h1>
        </header>

        <div className="tickets-grid">
          {tickets.length === 0 ? (
            <div className="empty-tickets">No hay fallas técnicas reportadas. ✅</div>
          ) : (
            tickets.map(ticket => (
              <div key={ticket.id} className="ticket-card-pro">
                <div className="ticket-badge">FALLA REPORTADA</div>
                <h2>{ticket.labName}</h2>
                <div className="ticket-info">
                    <p><strong>Materia:</strong> {ticket.className}</p>
                    <p><strong>Docente:</strong> {ticket.userName}</p>
                    <p><strong>Fecha:</strong> {format(ticket.startTime.toDate(), 'dd/MM/yyyy')}</p>
                </div>
                <button onClick={() => resolveTicket(ticket.id)} className="btn-resolve-ticket">
                    Marcar como Reparado
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}