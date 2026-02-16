// src/pages/MisReservas.js
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebaseConfig';
import { collection, query, where, getDocs, orderBy, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { format, isPast, isFuture, parseISO, startOfDay, endOfDay } from 'date-fns';
import es from 'date-fns/locale/es';
import toast from 'react-hot-toast';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ReservationModal from '../components/ReservationModal'; 
import './styles/MisReservas.css';

const MySwal = withReactContent(Swal);

// --- Componente para una Tarjeta de Reserva Individual ---
const ReservationCard = ({ reservation, onCancel, onEdit }) => (
  <div className="reservation-card fade-in">
    <div className="card-header">
      <span className={`type-badge ${reservation.spaceType?.toLowerCase() || 'aula'}`}>
        {reservation.spaceType || 'Espacio'}
      </span>
      <span className="status-indicator">{reservation.fulfillmentStatus || 'Pendiente'}</span>
    </div>
    <div className="card-body">
      <h3>{reservation.labName}</h3>
      <p><strong>Materia/Motivo:</strong> {reservation.className || reservation.purpose}</p>
      <p><strong>Fecha:</strong> {format(reservation.startTime.toDate(), "eeee, dd 'de' MMMM", { locale: es })}</p>
      <p><strong>Horario:</strong> {`${format(reservation.startTime.toDate(), 'HH:mm')} - ${format(reservation.endTime.toDate(), 'HH:mm')}`}</p>
    </div>
    {onCancel && (
      <div className="card-footer-btns">
        <button className="btn-edit-small" onClick={() => onEdit(reservation)}>Editar</button>
        <button className="btn-cancel-small" onClick={() => onCancel(reservation)}>Cancelar</button>
      </div>
    )}
  </div>
);

export default function MisReservas() {
  const { currentUser } = useAuth();
  const [searchParams] = useSearchParams();
  
  // Capturamos la sede de la URL para persistencia
  const currentSede = searchParams.get('sede') || "";

  const [allReservations, setAllReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('upcoming');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Estados para la Edición
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingReservation, setEditingReservation] = useState(null);

  const fetchReservations = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, 'reservations'),
        where('userId', '==', currentUser.uid),
        orderBy('startTime', 'desc')
      );
      const querySnapshot = await getDocs(q);
      const reservationsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAllReservations(reservationsData);
    } catch (error) {
      console.error("Error fetching reservations: ", error);
      toast.error("No se pudieron cargar tus reservas.");
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    fetchReservations();
  }, [fetchReservations]);

  const filteredReservations = useMemo(() => {
    // 1. Filtro por Tab (Próximas o Historial)
    const list = activeTab === 'upcoming'
      ? allReservations.filter(res => isFuture(res.startTime.toDate())).sort((a, b) => a.startTime - b.startTime)
      : allReservations.filter(res => isPast(res.startTime.toDate()));

    // 2. Filtro por Fechas
    if (!startDate && !endDate) return list;
    
    const start = startDate ? startOfDay(parseISO(startDate)) : null;
    const end = endDate ? endOfDay(parseISO(endDate)) : (start ? endOfDay(start) : null);
    
    return list.filter(res => {
      const resDate = res.startTime.toDate();
      if (start && end) return resDate >= start && resDate <= end;
      if (start) return resDate >= start;
      if (end) return resDate <= end;
      return true;
    });
  }, [activeTab, allReservations, startDate, endDate]);

  const handleCancelReservation = (reservation) => {
    MySwal.fire({
      title: '¿Confirmas la cancelación?',
      text: `Se cancelará la reserva en ${reservation.labName}`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#c8102e',
      confirmButtonText: 'Sí, cancelar',
      cancelButtonText: 'No'
    }).then(async (result) => {
      if (result.isConfirmed) {
        await deleteDoc(doc(db, "reservations", reservation.id));
        toast.success('Reserva cancelada');
        fetchReservations();
      }
    });
  };

  const handleOpenEditModal = (reservation) => {
    setEditingReservation(reservation);
    setIsEditModalOpen(true);
  };

  const handleUpdateReservation = async (updatedData) => {
    try {
      const reservationRef = doc(db, 'reservations', editingReservation.id);
      await updateDoc(reservationRef, updatedData);
      toast.success("Reserva actualizada");
      setIsEditModalOpen(false);
      fetchReservations();
    } catch (e) { toast.error("Error al editar"); }
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const tableRows = [];
    filteredReservations.forEach(res => {
      tableRows.push([
        res.spaceType || 'Aula',
        res.labName,
        res.className || res.purpose,
        format(res.startTime.toDate(), 'dd/MM/yyyy'),
        `${format(res.startTime.toDate(), 'HH:mm')} - ${format(res.endTime.toDate(), 'HH:mm')}`
      ]);
    });

    doc.text(`Mis Reservas - ${currentSede}`, 14, 15);
    autoTable(doc, {
      head: [["Tipo", "Espacio", "Motivo", "Fecha", "Horario"]],
      body: tableRows,
      startY: 25,
    });
    doc.save(`reservas_${currentSede}.pdf`);
  };

  return (
    <div className="dashboard-wrapper">
      <div className="mis-reservas-container-glass">
        
        {/* HEADER REESTRUCTURADO */}
        <header className="reservations-header-pro">
          <div className="header-nav-left">
             <Link to={`/dashboard?sede=${currentSede}`} className="back-link-simple">
               ← Volver al Dashboard
             </Link>
             <h1>Mis Reservas</h1>
             <p>Sede: <strong>{currentSede}</strong></p>
          </div>

          <div className="header-actions-right">
             <Link to={`/reservas?tipo=Aula&sede=${currentSede}`} className="btn-cal-mini btn-aula">
                🏫 Calendario Aulas
             </Link>
             <Link to={`/reservas?tipo=Laboratorio&sede=${currentSede}`} className="btn-cal-mini btn-lab">
                🔬 Calendario Labs
             </Link>
          </div>
        </header>

        {/* BARRA DE CONTROLES: TABS + FILTROS + EXPORT */}
        <div className="controls-bar-modern">
          <div className="tabs-group">
            <button className={activeTab === 'upcoming' ? 'active' : ''} onClick={() => setActiveTab('upcoming')}>Próximas</button>
            <button className={activeTab === 'past' ? 'active' : ''} onClick={() => setActiveTab('past')}>Historial</button>
          </div>
          
          <div className="filters-group">
            <div className="date-inputs">
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} title="Fecha inicio" />
                <span>al</span>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} title="Fecha fin" />
            </div>
            <button className="btn-export-pdf" onClick={handleExportPDF} disabled={filteredReservations.length === 0}>
               📄 Exportar PDF
            </button>
          </div>
        </div>

        {/* CONTENIDO PRINCIPAL */}
        <div className="reservas-content-grid-area">
          {loading ? (
            <div className="loading-state">Cargando tus reservas...</div>
          ) : filteredReservations.length === 0 ? (
            <div className="empty-state-reservas">
                <div className="empty-icon">📁</div>
                <h3>No hay registros</h3>
                <p>No se encontraron reservas para los filtros seleccionados.</p>
            </div>
          ) : (
            <div className="reservations-grid">
              {filteredReservations.map(res => (
                <ReservationCard 
                  key={res.id} 
                  reservation={res} 
                  onCancel={activeTab === 'upcoming' ? handleCancelReservation : null}
                  onEdit={activeTab === 'upcoming' ? handleOpenEditModal : null}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {isEditModalOpen && (
        <ReservationModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          spaceData={editingReservation}
          existingReservation={editingReservation}
          onSubmit={handleUpdateReservation}
        />
      )}
    </div>
  );
}