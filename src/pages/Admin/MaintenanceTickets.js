import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { useSearchParams, Link } from 'react-router-dom';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import '../styles/MaintenanceTickets.css';

const MySwal = withReactContent(Swal);

export default function MaintenanceTickets() {
  const [searchParams] = useSearchParams();
  const currentSede = searchParams.get('sede') || "";
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentSede) return;
    
    // Buscamos reservas que terminaron con incidencias (Consulta Autolimpiable)
    const q = query(
      collection(db, 'reservations'), 
      where('sede', '==', currentSede),
      where('fulfillmentStatus', '==', 'Completada (Con Incidencias)')
    );

    const unsub = onSnapshot(q, (snap) => {
      setTickets(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    
    return () => unsub();
  }, [currentSede]);

  const resolveTicket = async (ticket) => {
    const { isConfirmed } = await MySwal.fire({
        title: '¿Marcar como Resuelto?',
        text: `¿Confirmas que la incidencia en ${ticket.labName} ha sido solucionada?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#22c55e',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Sí, está reparado',
        cancelButtonText: 'Cancelar'
    });

    if (!isConfirmed) return;

    const toastId = toast.loading("Cerrando ticket...");
    try {
      await updateDoc(doc(db, 'reservations', ticket.id), { 
        fulfillmentStatus: 'Completada (Incidencia Resuelta)',
        resolvedAt: new Date()
      });
      toast.success("Incidencia marcada como resuelta.", { id: toastId });
    } catch (e) { 
      toast.error("Error al actualizar la base de datos.", { id: toastId }); 
    }
  };

  return (
    <div className="dashboard-wrapper">
      <div className="maintenance-container-glass fade-in">
        
        <header className="page-header-pro" style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '30px' }}>
          <Link to={`/dashboard?sede=${currentSede}`} className="back-link-tech" style={{ alignSelf: 'flex-start' }}>← Volver al Dashboard</Link>
          <h1 style={{ margin: 0 }}>🛠️ Panel de Soporte Técnico</h1>
          <p style={{ margin: 0, color: '#64748b', fontWeight: 'bold' }}>Monitoreo de incidencias en: <span className="red-text">{currentSede}</span></p>
        </header>

        {loading ? (
           <div className="loading-state" style={{ padding: '50px 0', textAlign: 'center', color: '#64748b', fontWeight: 'bold' }}>
               Buscando incidencias reportadas...
           </div>
        ) : (
          <div className="tickets-grid">
            {tickets.length === 0 ? (
              <div className="empty-tickets" style={{ gridColumn: '1 / -1', background: '#dcfce7', color: '#166534', padding: '40px', borderRadius: '12px', textAlign: 'center', fontWeight: 'bold', border: '1px solid #bbf7d0' }}>
                 <div style={{ fontSize: '3rem', marginBottom: '10px' }}>✅</div>
                 ¡Todo en orden! No hay fallas técnicas reportadas en esta sede.
              </div>
            ) : (
              tickets.map(ticket => (
                <div key={ticket.id} className="ticket-card-pro" style={{ background: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', borderTop: '5px solid #ef4444', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div className="ticket-badge" style={{ background: '#fee2e2', color: '#b91c1c', padding: '4px 10px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: '900' }}>
                          ⚠️ TICKET ABIERTO
                      </div>
                      <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 'bold' }}>
                          {format(ticket.startTime.toDate(), 'dd/MM/yyyy')}
                      </span>
                  </div>
                  
                  <h2 style={{ margin: 0, color: '#1e293b', fontSize: '1.4rem' }}>{ticket.labName}</h2>
                  
                  <div className="ticket-info" style={{ background: '#f8fafc', padding: '15px', borderRadius: '10px', border: '1px solid #edf2f7', fontSize: '0.9rem', color: '#334155' }}>
                      <p style={{ margin: '0 0 5px 0' }}><strong>📚 Materia:</strong> {ticket.className}</p>
                      <p style={{ margin: '0 0 5px 0' }}><strong>👨‍🏫 Docente:</strong> {ticket.userName}</p>
                      <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed #cbd5e1' }}>
                          <strong>🚨 Detalle del Reporte:</strong>
                          <p style={{ margin: '5px 0 0 0', color: '#ef4444', fontStyle: 'italic' }}>
                              {ticket.issueDescription || ticket.cancelReason || 'Falla técnica general reportada al finalizar la clase.'}
                          </p>
                      </div>
                  </div>

                  <button 
                    onClick={() => resolveTicket(ticket)} 
                    className="btn-resolve-ticket"
                    style={{ marginTop: 'auto', background: '#22c55e', color: 'white', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s' }}
                  >
                      ✅ Marcar como Reparado
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}