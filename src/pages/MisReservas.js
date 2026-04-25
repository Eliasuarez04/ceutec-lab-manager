import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebaseConfig';
// 🔥 IMPORTANTE: Agregamos "or" a la importación de Firestore para consultas múltiples y getDoc para la búsqueda
import { collection, query, where, getDocs, doc, deleteDoc, updateDoc, Timestamp, or, getDoc } from 'firebase/firestore';
import { format, isPast, isFuture, parseISO, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
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
const ReservationCard = ({ reservation, onCancel, onEdit, onCheckAction }) => {
  const isNow = isWithinInterval(new Date(), { 
    start: reservation.startTime.toDate(), 
    end: reservation.endTime.toDate() 
  });

  return (
    <div className="reservation-card fade-in">
      <div className="card-header">
        <span className={`type-badge ${reservation.spaceType?.toLowerCase() || 'aula'}`}>
          {reservation.spaceType || 'Espacio'}
        </span>
        <span className={`status-indicator ${reservation.fulfillmentStatus?.toLowerCase().replace(/\s+/g, '-')}`}>
            {reservation.fulfillmentStatus || 'Pendiente'}
        </span>
      </div>
      <div className="card-body">
        <h3>{reservation.labName}</h3>
        <p><strong>Materia/Motivo:</strong> {reservation.className || reservation.purpose}</p>
        <p><strong>Fecha:</strong> {format(reservation.startTime.toDate(), "eeee, dd 'de' MMMM", { locale: es })}</p>
        <p><strong>Horario:</strong> {`${format(reservation.startTime.toDate(), 'HH:mm')} - ${format(reservation.endTime.toDate(), 'HH:mm')}`}</p>
        {/* Mostramos a nombre de quién está reservado si no somos nosotros */}
        <p style={{fontSize: '0.8rem', color: '#64748b', marginTop: '10px'}}>👤 A nombre de: {reservation.userName}</p>
      </div>

      <div className="card-actions-ops" style={{ padding: '0 25px 15px' }}>
        {isNow && !reservation.checkInTime && (
          <button 
            className="btn-op-checkin" 
            style={{ width: '100%', padding: '12px', background: '#22c55e', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '900', cursor: 'pointer', marginBottom: '10px' }}
            onClick={() => onCheckAction(reservation.id, 'checkin')}
          >
            ▶️ Iniciar Clase
          </button>
        )}

        {reservation.checkInTime && !reservation.checkOutTime && (
          <button 
            className="btn-op-checkout" 
            style={{ width: '100%', padding: '12px', background: '#1e293b', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '900', cursor: 'pointer', marginBottom: '10px' }}
            onClick={() => onCheckAction(reservation.id, 'checkout')}
          >
            🏁 Finalizar Clase
          </button>
        )}
      </div>

      {!reservation.checkInTime && (
        <div className="card-footer-btns">
          <button className="btn-edit-small" onClick={() => onEdit(reservation)}>Editar</button>
          <button className="btn-cancel-small" onClick={() => onCancel(reservation)}>Cancelar</button>
        </div>
      )}
    </div>
  );
};

export default function MisReservas() {
  const { currentUser } = useAuth();
  const [searchParams] = useSearchParams();
  const currentSede = searchParams.get('sede') || "";

  const [allReservations, setAllReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('upcoming');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingReservation, setEditingReservation] = useState(null);

  const fetchReservations = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      // 🔥 CORRECCIÓN: Buscamos reservas donde el usuario sea el DOCENTE o el GESTOR 🔥
      const q = query(
        collection(db, 'reservations'),
        or(
            where('userId', '==', currentUser.uid), // Es mi clase
            where('reservedByEmail', '==', currentUser.email) // Yo la agendé por alguien más
        ),
        // orderBy('startTime', 'desc') -> NOTA: Al usar 'or', Firebase a veces pide index compuesto. Si falla, el sort lo hacemos en el front.
      );
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Ordenamos manualmente por fecha descendente
      data.sort((a, b) => b.startTime.toDate() - a.startTime.toDate());
      setAllReservations(data);
    } catch (error) {
      console.error("Error: ", error);
      toast.error("Error al cargar reservas.");
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  const handleCheckAction = async (resId, type) => {
    try {
      const resRef = doc(db, 'reservations', resId);
      
      if (type === 'checkin') {
        await updateDoc(resRef, { checkInTime: Timestamp.now(), fulfillmentStatus: 'En Progreso' });
        toast.success("¡Clase iniciada!");
      } else {
        const { isConfirmed } = await MySwal.fire({
            title: '¿Finalizar clase?',
            text: '¿Hubo alguna incidencia técnica en el salón?',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'No, todo bien ✅',
            cancelButtonText: 'Sí, reportar falla ⚠️',
            confirmButtonColor: '#22c55e',
            cancelButtonColor: '#f59e0b'
        });

        const status = isConfirmed ? 'Completada' : 'Completada (Con Incidencias)';
        await updateDoc(resRef, { 
            checkOutTime: Timestamp.now(), 
            fulfillmentStatus: status 
        });
        
        if(!isConfirmed) {
            toast("Falla reportada a Soporte Técnico", { icon: '⚠️' });
        } else {
            toast.success("Clase finalizada correctamente.");
        }
      }
      fetchReservations();
    } catch (e) { toast.error("Error operativo."); }
  };

  useEffect(() => { fetchReservations(); }, [fetchReservations]);

  const handleOpenEditModal = (reservation) => {
    setEditingReservation(reservation);
    setIsEditModalOpen(true);
  };

  const filteredReservations = useMemo(() => {
    let list = allReservations.filter(res => res.reservationType !== 'academic_load');

    if (activeTab === 'upcoming') {
      list = list.filter(res => isFuture(res.startTime.toDate())).sort((a, b) => a.startTime - b.startTime);
    } else {
      list = list.filter(res => isPast(res.startTime.toDate()));
    }

    if (!startDate && !endDate) return list;
    const start = startDate ? startOfDay(parseISO(startDate)) : null;
    const end = endDate ? endOfDay(parseISO(endDate)) : (start ? endOfDay(start) : null);
    
    return list.filter(res => {
      const d = res.startTime.toDate();
      if (start && end) return d >= start && d <= end;
      return true;
    });
  }, [activeTab, allReservations, startDate, endDate]);

  const handleCancelReservation = (reservation) => {
    MySwal.fire({
      title: '¿Confirmas la cancelación?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#c8102e',
      confirmButtonText: 'Sí, cancelar'
    }).then(async (result) => {
      if (result.isConfirmed) {
        await deleteDoc(doc(db, "reservations", reservation.id));
        toast.success('Reserva eliminada');
        fetchReservations();
      }
    });
  };

  // 🔥 LÓGICA DE EDICIÓN CON CIERRE INMEDIATO UX (MisReservas.js) 🔥
  const handleUpdateReservation = async (updatedData) => {
    // 1. UX CRÍTICO: Cerramos el modal INMEDIATAMENTE al dar clic en guardar
    setIsEditModalOpen(false); 

    const toastId = toast.loading("Verificando datos y guardando...");
    try {
      let teacherName = updatedData.userName || currentUser.displayName; 
      let teacherEmail = updatedData.userEmail || currentUser.email;
      let teacherId = updatedData.userId || currentUser.uid;
      let docenteEncontrado = false;

      // Búsqueda del TH si lo modificaron
      if (updatedData.thDocente && updatedData.thDocente !== editingReservation.th) {
          const cleanTh = updatedData.thDocente.toString().trim();
          
          const teacherRef = doc(db, 'active_teachers_list', cleanTh);
          const teacherSnap = await getDoc(teacherRef);
          
          if (teacherSnap.exists()) {
              teacherName = teacherSnap.data().name;
              if (teacherSnap.data().email && teacherSnap.data().email !== "Pendiente de Registro") {
                  teacherEmail = teacherSnap.data().email;
              }
              docenteEncontrado = true;
          } else {
              const qUser = query(collection(db, 'users'), where('th', '==', cleanTh));
              const uSnap = await getDocs(qUser);
              if (!uSnap.empty) {
                  const uData = uSnap.docs[0].data();
                  teacherName = uData.displayName || uData.name || teacherName;
                  teacherEmail = uData.email || teacherEmail;
                  teacherId = uData.uid || teacherId;
                  docenteEncontrado = true;
              }
          }

          // Si cambiaron el TH pero no existe, pedimos nombre manual
          if (!docenteEncontrado) {
            toast.dismiss(toastId); 
            const { value: manualName, isDismissed } = await MySwal.fire({
                title: 'Docente no encontrado',
                text: `El nuevo TH ${updatedData.thDocente} no existe. Ingresa el nombre manual:`,
                input: 'text',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Guardar',
                confirmButtonColor: '#c8102e',
                inputValidator: (value) => { if (!value) return 'El nombre es obligatorio' }
            });

            if (isDismissed) return; 
            teacherName = manualName.toUpperCase();
            toast.loading("Actualizando reserva...", { id: toastId });
          }
      }

      const reservationRef = doc(db, 'reservations', editingReservation.id);
      await updateDoc(reservationRef, {
        ...updatedData,
        userName: teacherName,
        userEmail: teacherEmail,
        userId: teacherId,
        th: updatedData.thDocente || 'N/A',
        attendees: updatedData.studentCount,
        startTime: Timestamp.fromDate(new Date(updatedData.start)),
        endTime: Timestamp.fromDate(new Date(updatedData.end)),
      });
      
      toast.success("Reserva actualizada", {id: toastId});
      fetchReservations();
    } catch (e) { 
        toast.error("Error al editar", {id: toastId}); 
    }
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const tableRows = filteredReservations.map(res => [
        res.spaceType || 'Aula',
        res.labName,
        res.className || res.purpose,
        format(res.startTime.toDate(), 'dd/MM/yyyy'),
        `${format(res.startTime.toDate(), 'HH:mm')} - ${format(res.endTime.toDate(), 'HH:mm')}`
    ]);
    doc.text(`Mis Reservas Manuales - ${currentSede}`, 14, 15);
    autoTable(doc, { head: [["Tipo", "Espacio", "Motivo", "Fecha", "Horario"]], body: tableRows, startY: 25 });
    doc.save(`reservas_manuales_${currentSede}.pdf`);
  };

  return (
    <div className="dashboard-wrapper">
      <div className="mis-reservas-container-glass">
        <header className="reservations-header-pro">
          <div className="header-nav-left">
             <Link to={`/dashboard?sede=${currentSede}`} className="back-link-simple">← Volver al Dashboard</Link>
             <h1>Mis Reservas</h1>
             <p>Sede: <strong>{currentSede}</strong> (Gestiones Manuales)</p>
          </div>
          <div className="header-actions-right">
             <Link to={`/reservas?tipo=Aula&sede=${currentSede}`} className="btn-cal-mini btn-aula">🏫 Agenda Aulas</Link>
             <Link to={`/reservas?tipo=Laboratorio&sede=${currentSede}`} className="btn-cal-mini btn-lab">🔬 Agenda Labs</Link>
          </div>
        </header>

        <div className="controls-bar-modern">
          <div className="tabs-group">
            <button className={activeTab === 'upcoming' ? 'active' : ''} onClick={() => setActiveTab('upcoming')}>Próximas</button>
            <button className={activeTab === 'past' ? 'active' : ''} onClick={() => setActiveTab('past')}>Historial</button>
          </div>
          <div className="filters-group">
            <div className="date-inputs">
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                <span>al</span>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
            <button className="btn-export-pdf" onClick={handleExportPDF} disabled={filteredReservations.length === 0}>📄 PDF</button>
          </div>
        </div>

        <div className="reservas-content-grid-area">
          {loading ? (
            <div className="loading-state">Cargando...</div>
          ) : filteredReservations.length === 0 ? (
            <div className="empty-state-reservas"><h3>No hay registros manuales</h3></div>
          ) : (
            <div className="reservations-grid">
              {filteredReservations.map(res => (
                <ReservationCard 
                  key={res.id} 
                  reservation={res} 
                  onCancel={activeTab === 'upcoming' ? handleCancelReservation : null}
                  onEdit={activeTab === 'upcoming' ? handleOpenEditModal : null}
                  onCheckAction={handleCheckAction}
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
          spaceData={{ id: editingReservation.labId, name: editingReservation.labName }}
          existingReservation={editingReservation}
          existingReservations={allReservations}
          onSubmit={handleUpdateReservation}
        />
      )}
    </div>
  );
}