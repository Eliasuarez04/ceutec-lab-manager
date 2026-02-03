// src/pages/MisReservas.js
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebaseConfig';
import { collection, query, where, getDocs, orderBy, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { format, isPast, isFuture, parseISO, startOfDay, endOfDay } from 'date-fns';
import toast from 'react-hot-toast';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ReservationModal from '../components/ReservationModal'; // Importar el nuevo modal
import './styles/MisReservas.css';

const MySwal = withReactContent(Swal);

// --- Componente para una Tarjeta de Reserva Individual ---
const ReservationCard = ({ reservation, onCancel, onEdit }) => (
  <div className="reservation-card">
    <div className="card-header">
      <span className={`type-badge ${reservation.type?.toLowerCase() || 'practica'}`}>
        {reservation.type || 'Práctica'}
      </span>
      <h3>{reservation.labName}</h3>
    </div>
    <div className="card-body">
      <p><strong>Motivo:</strong> {reservation.purpose}</p>
      <p><strong>Fecha:</strong> {format(reservation.startTime.toDate(), 'eeee, dd \'de\' MMMM \'de\' yyyy')}</p>
      <p><strong>Horario:</strong> {`${format(reservation.startTime.toDate(), 'HH:mm')} - ${format(reservation.endTime.toDate(), 'HH:mm')}`}</p>
    </div>
    {/* Solo mostramos los botones si las funciones onCancel/onEdit existen (reservas futuras) */}
    {onCancel && (
      <div className="card-footer">
        <button className="edit-button" onClick={() => onEdit(reservation)}>Editar</button>
        <button className="cancel-button" onClick={() => onCancel(reservation)}>Cancelar</button>
      </div>
    )}
  </div>
);

export default function MisReservas() {
  const { currentUser } = useAuth();
  const [allReservations, setAllReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('upcoming');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Estados para la Edición
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingReservation, setEditingReservation] = useState(null);
  const [labInventoryForEdit, setLabInventoryForEdit] = useState([]);

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
    const list = activeTab === 'upcoming'
      ? allReservations.filter(res => isFuture(res.startTime.toDate())).sort((a, b) => a.startTime - b.startTime)
      : allReservations.filter(res => isPast(res.startTime.toDate()));

    if (!startDate && !endDate) {
      return list;
    }
    
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
    const { id, purpose, labName, startTime } = reservation;
    MySwal.fire({
      title: '¿Confirmas la cancelación?',
      html: `
        <div class="swal-text">
          Estás a punto de cancelar tu reserva para:<br/>
          <strong>${purpose}</strong> en <strong>${labName}</strong><br/>
          el día <strong>${format(startTime.toDate(), 'dd/MM/yyyy \'a las\' HH:mm')}</strong>.
        </div>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#c8102e',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Sí, cancelar reserva',
      cancelButtonText: 'No'
    }).then((result) => {
      if (result.isConfirmed) {
        const promise = deleteDoc(doc(db, "reservations", id));
        toast.promise(promise, {
          loading: 'Cancelando reserva...',
          success: 'Reserva cancelada correctamente.',
          error: 'Error al cancelar la reserva.'
        }).then(() => {
          fetchReservations();
        });
      }
    });
  };

  // --- FUNCIÓN PARA ABRIR EL MODAL DE EDICIÓN ---
  const handleOpenEditModal = async (reservation) => {
    const toastId = toast.loading('Cargando datos para edición...');
    try {
      const equipmentColRef = collection(db, 'laboratories', reservation.labId, 'equipment');
      const q = query(equipmentColRef, where('quantity', '>', 0));
      const equipmentSnapshot = await getDocs(q);
      const inventoryData = equipmentSnapshot.docs.map(doc => ({ 
        id: doc.id, value: doc.id, label: `${doc.data().name} (Disp: ${doc.data().quantity})`,
        ...doc.data()
      }));
      setLabInventoryForEdit(inventoryData);
      setEditingReservation(reservation);
      setIsEditModalOpen(true);
    } catch (error) {
      toast.error('No se pudo cargar el inventario para editar.');
    } finally {
      toast.dismiss(toastId);
    }
  };

  // --- FUNCIÓN PARA GUARDAR LOS CAMBIOS DE LA EDICIÓN ---
  const handleUpdateReservation = async ({ purpose, requestedItems }) => {
    if (!editingReservation) return;

    const reservationRef = doc(db, 'reservations', editingReservation.id);
    const updatedData = {
      purpose: purpose,
      requestedItems: requestedItems,
      fulfillmentStatus: requestedItems.length > 0 ? 'Pendiente' : 'Sin Solicitud',
    };

    const promise = updateDoc(reservationRef, updatedData);
    await toast.promise(promise, {
      loading: 'Guardando cambios...',
      success: 'Reserva actualizada con éxito.',
      error: 'Error al actualizar la reserva.'
    });

    setIsEditModalOpen(false);
    fetchReservations(); // Recargar la lista
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const tableRows = [];
    const tableColumns = ["Tipo", "Laboratorio", "Motivo", "Fecha", "Horario"];
    
    doc.setFontSize(18);
    doc.text(`Reporte de Mis Reservas - ${currentUser.email}`, 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);

    const dataToExport = filteredReservations.length > 0 ? filteredReservations : allReservations;

    dataToExport.forEach(res => {
      const reservationData = [
        res.type || 'Práctica',
        res.labName,
        res.purpose,
        format(res.startTime.toDate(), 'dd/MM/yyyy'),
        `${format(res.startTime.toDate(), 'HH:mm')} - ${format(res.endTime.toDate(), 'HH:mm')}`
      ];
      tableRows.push(reservationData);
    });

    autoTable(doc, {
      head: [tableColumns],
      body: tableRows,
      startY: 30,
    });

    doc.text(`Total de Reservas: ${dataToExport.length}`, 14, doc.lastAutoTable.finalY + 10);
    doc.save(`mis_reservas_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    toast.success('¡Reporte PDF generado!');
  };

  const renderContent = () => {
    // ... (TU LÓGICA DE RENDERIZACIÓN DE CONTENIDO IGUAL) ...
    if (loading) return <div className="loading-state">Cargando tus reservas...</div>;
    
    if (filteredReservations.length === 0) {
      return (
        <div className="empty-state">
          <span className="empty-state-icon">📂</span>
          <h3>No se encontraron reservas</h3>
          <p>Prueba a cambiar o limpiar el rango de fechas, o no tienes reservas en esta categoría.</p>
        </div>
      );
    }

    return (
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
    );
  };

  return (
    <>
      {/* --- MODAL DE EDICIÓN --- */}
      <ReservationModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        labName={editingReservation?.labName}
        inventory={labInventoryForEdit}
        existingReservation={editingReservation}
        onSubmit={handleUpdateReservation}
      />

      {/* APLICAMOS EL FONDO GLOBAL */}
      <div className="dashboard-wrapper"> 
        <div className="page-container">
          <div className="page-header-mis-reservas">
            <h1>Mis Reservas</h1>
            <Link to="/reservas" className="back-to-calendar-btn">
              Ir a Calendario
            </Link>
          </div>
          
          <div className="controls-bar">
            <div className="tabs">
              <button className={activeTab === 'upcoming' ? 'active' : ''} onClick={() => setActiveTab('upcoming')}>Próximas</button>
              <button className={activeTab === 'past' ? 'active' : ''} onClick={() => setActiveTab('past')}>Historial</button>
            </div>
            
            <div className="filters">
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
              <button className="export-btn" onClick={handleExportPDF} disabled={filteredReservations.length === 0}>
                Exportar a PDF
              </button>
            </div>
          </div>

          <div className="content-area">
            {renderContent()}
          </div>
        </div>
      </div>
    </>
  );
}