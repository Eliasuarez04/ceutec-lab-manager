// src/pages/Reservations.js
import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import format from 'date-fns/format';
import parse from 'date-fns/parse';
import startOfWeek from 'date-fns/startOfWeek';
import getDay from 'date-fns/getDay';
import es from 'date-fns/locale/es';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { db } from '../firebaseConfig';
import { collection, getDocs, query, where, writeBatch, doc, Timestamp, orderBy, addDoc, deleteDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import './styles/Reservations.css'; // Asegúrate que esta ruta es correcta
import toast from 'react-hot-toast';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import * as XLSX from 'xlsx';

const MySwal = withReactContent(Swal);

// --- SOLUCIÓN: DICCIONARIO DE MAPEO CORREGIDO ---
// 'Clave' (izquierda): El valor EXACTO de la columna "espacio_aprendizaje" del Excel.
// 'Valor' (derecha): El nombre EXACTO del laboratorio como está en tu base de datos (Firestore).
// **¡ESTE ES EL ÚNICO LUGAR QUE NECESITAS EDITAR EN EL FUTURO!**
const excelToFirestoreLabMap = {
  'SN/FOT': 'Fotografía',
  'SN/RD' : 'Laboratorio de Redes',
  'SN/TRD': 'Taller de Redes',
  'SN/QUI': 'Química',
  'SN/DB1': 'Dibujo I',
  'SN/DB2': 'Dibujo II',
  'SN/DB3': 'Dibujo III',
  'SN/MAC': 'MAC',
  'SN/L08': 'Cómputo 08',
  'SN/L07': 'Cómputo 07',
};


// Configuración y mensajes
const locales = { 'es': es };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });
const messages = {
  allDay: 'Todo el día', previous: 'Atrás', next: 'Siguiente', today: 'Hoy',
  month: 'Mes', week: 'Semana', day: 'Día', agenda: 'Agenda', date: 'Fecha',
  time: 'Hora', event: 'Evento', noEventsInRange: 'No hay eventos en este rango.',
  showMore: total => `+ Ver más (${total})`
};

const getFacultyFromClassName = (className = '') => {
    const name = className ? className.toLowerCase() : '';
    if (name.includes('diseño') || name.includes('arte') || name.includes('animación') || name.includes('fotografía')) return 'Escuela de Arte y Diseño';
    if (name.includes('ingeniería') || name.includes('cálculo') || name.includes('física') || name.includes('programación') || name.includes('redes') || name.includes('eléctrica')) return 'Facultad de Ingeniería';
    if (name.includes('social') || name.includes('psicología') || name.includes('derecho')) return 'Facultad de Ciencias Sociales';
    if (name.includes('salud') || name.includes('medicina') || name.includes('enfermería')) return 'Facultad de Ciencias de la Salud';
    return 'Facultad por Determinar';
};

export default function Reservations() {
  const { currentUser, userData } = useAuth();
  const [labs, setLabs] = useState([]);
  const [selectedLab, setSelectedLab] = useState(null);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('week');
  const [date, setDate] = useState(new Date());
  const location = useLocation();
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [slotInfo, setSlotInfo] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [purpose, setPurpose] = useState('');
  const [importFile, setImportFile] = useState(null);
  const [periodStartDate, setPeriodStartDate] = useState('');
  const [periodEndDate, setPeriodEndDate] = useState('');

  useEffect(() => {
    const fetchLabs = async () => {
      const q = query(collection(db, 'laboratories'), where('status', '==', 'Disponible'), orderBy('name'));
      const querySnapshot = await getDocs(q);
      const labsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const allLabsOption = { id: 'all', name: 'Todos los Laboratorios' };
      const availableLabs = [allLabsOption, ...labsData];
      setLabs(availableLabs);
      const params = new URLSearchParams(location.search);
      const labIdFromUrl = params.get('labId');
      const labFromUrl = availableLabs.find(lab => lab.id === labIdFromUrl);
      setSelectedLab(labFromUrl || allLabsOption);
    };
    fetchLabs();
  }, [location.search]);

  const fetchReservations = useCallback(async () => {
    if (!selectedLab) return;
    setLoading(true);
    let q;
    if (selectedLab.id === 'all') {
      q = query(collection(db, 'reservations'));
    } else {
      q = query(collection(db, 'reservations'), where('labId', '==', selectedLab.id));
    }
    const querySnapshot = await getDocs(q);
    const reservationsData = querySnapshot.docs.map(doc => {
      const data = doc.data();
      const title = selectedLab.id === 'all'
        ? `${data.labName}: ${data.purpose} (${data.userEmail.split('@')[0]})`
        : `${data.purpose} (${data.userEmail.split('@')[0]})`;
      return { ...data, id: doc.id, start: data.startTime.toDate(), end: data.endTime.toDate(), title };
    });
    setReservations(reservationsData);
    setLoading(false);
  }, [selectedLab]);

  useEffect(() => {
    fetchReservations();
  }, [fetchReservations]);

  const handleSelectSlot = (slot) => {
    if (selectedLab?.id === 'all') {
      toast.error("Por favor, selecciona un laboratorio específico para poder reservar.");
      return;
    }
    if (slot.start < new Date()) return;
    const isOverlapping = reservations.some(event => slot.start < event.end && slot.end > event.start);
    if (isOverlapping) {
      toast.error('Este horario ya está ocupado por una clase o reserva.');
      return;
    }
    const startTime = slot.start;
    const endTime = new Date(startTime.getTime() + 90 * 60000);
    setSlotInfo({ start: startTime, end: endTime, type: 'Practica' });
    setIsBookingModalOpen(true);
  };

  const handleSelectEvent = (event) => {
    setSelectedEvent(event);
    setIsViewModalOpen(true);
  };

  const handleCreateReservation = async (e) => {
    e.preventDefault();
    if (!purpose.trim() || !slotInfo) return;
    const newReservationData = {
      type: slotInfo.type || 'Practica', labId: selectedLab.id, labName: selectedLab.name,
      userId: currentUser.uid, userEmail: currentUser.email,
      startTime: Timestamp.fromDate(slotInfo.start), endTime: Timestamp.fromDate(slotInfo.end),
      purpose: purpose.trim(),
    };
    const promise = addDoc(collection(db, 'reservations'), newReservationData);
    toast.promise(promise, {
      loading: 'Creando reserva...', success: '¡Reserva creada con éxito!', error: 'Error al crear la reserva.',
    }).then(() => {
      setIsBookingModalOpen(false); setPurpose(''); setSlotInfo(null); fetchReservations();
    });
  };

  const handleDeleteReservation = (reservationId) => {
    setIsViewModalOpen(false);
    MySwal.fire({
      title: '¿Estás seguro?', text: "¡Esta acción no se puede revertir!", icon: 'warning',
      showCancelButton: true, confirmButtonColor: '#c8102e', cancelButtonColor: '#6c757d',
      confirmButtonText: 'Sí, ¡eliminar!', cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        const promise = deleteDoc(doc(db, "reservations", reservationId));
        toast.promise(promise, {
          loading: 'Eliminando reserva...', success: 'Reserva eliminada.', error: 'Error al eliminar.'
        }).then(() => {
          setSelectedEvent(null); fetchReservations();
        });
      }
    });
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) { setImportFile(file); }
  };

  const handleImportSubmit = async (e) => {
    e.preventDefault();
    if (!importFile || !periodStartDate || !periodEndDate) {
      return toast.error("Por favor, selecciona un archivo y las fechas del período.");
    }

    setIsImportModalOpen(false);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        const loadingToast = toast.loading("Procesando carga académica...");
        const newReservations = [];
        const labsFromDB = labs.filter(lab => lab.id !== 'all');
        const labNameToIdMap = new Map(labsFromDB.map(lab => [lab.name.toLowerCase(), lab.id]));
        const dayMap = { '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 0 };

        for (const row of jsonData) {
                    const excelLabCode = String(row['espacio_aprendizaje'] || '').trim();
                    if (!excelLabCode) continue;

                    const firestoreLabName = excelToFirestoreLabMap[excelLabCode];
                    if (!firestoreLabName) {
                        console.warn(`Código "${excelLabCode}" no reconocido. Saltando.`);
                        continue;
                    }

                    const labId = labNameToIdMap.get(firestoreLabName.toLowerCase());
                    if (!labId) {
                        console.warn(`Laboratorio "${firestoreLabName}" no existe en la BD. Saltando.`);
                        continue;
                    }

                    const daysStr = String(row['dias_habiles'] || '');
                    const timeStr = String(row['hora'] || '');
                    const durationInMinutes = 90;
                    const subjectName = row['nombre_materia'];
                    
                    if (!daysStr || !timeStr || !subjectName) continue;

                    const faculty = getFacultyFromClassName(subjectName);
                    const career = row['nombre_areaacademicasCompactacion'];
                    const teacherId = row['codigo_th'];
                    const section = row['seccion'];
                    const studentCount = row['matriculados'];
                    const teacherName = row['nombre']
                    const classDays = daysStr.split('').map(d => dayMap[d]).filter(d => d !== undefined);
                    
                    let currentDate = new Date(periodStartDate + 'T00:00:00');
                    let endDate = new Date(periodEndDate + 'T00:00:00');

                    while (currentDate <= endDate) {
                        if (classDays.includes(currentDate.getDay())) {
                            const timeParts = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
                            if (!timeParts) continue;

                            let [_, hours, minutes, modifier] = timeParts;
                            hours = parseInt(hours);
                            if (modifier.toUpperCase() === 'PM' && hours !== 12) hours += 12;
                            if (modifier.toUpperCase() === 'AM' && hours === 12) hours = 0;

                            const startTime = new Date(currentDate);
                            startTime.setHours(hours, parseInt(minutes), 0, 0);
                            const endTime = new Date(startTime.getTime() + durationInMinutes * 60000);

                            newReservations.push({
                                type: 'Clase', labId, labName: firestoreLabName, purpose: subjectName,
                                faculty, career, teacherId, section, studentCount, teacherName,
                                startTime: Timestamp.fromDate(startTime), endTime: Timestamp.fromDate(endTime),
                                userEmail: 'Carga Académica',
                            });
                        }
                        currentDate.setDate(currentDate.getDate() + 1);
                    }
                }
                
                toast.dismiss(loadingToast);
                if (newReservations.length === 0) {
                  return toast.error("No se generaron reservas. Verifica los códigos en 'espacio_aprendizaje' y el formato del archivo.");
                }

                MySwal.fire({
                  title: 'Confirmar Importación', text: `Se crearán ${newReservations.length} reservas de clase. ¿Continuar?`,
                  icon: 'info', showCancelButton: true, confirmButtonColor: '#c8102e', cancelButtonColor: '#6c757d',
                  confirmButtonText: 'Sí, importar', cancelButtonText: 'Cancelar'
                }).then(async (result) => {
                  if (result.isConfirmed) {
                    const batch = writeBatch(db);
                    newReservations.forEach(res => {
                      const docRef = doc(collection(db, 'reservations'));
                      batch.set(docRef, res);
                    });
                    const promise = batch.commit();
                    await toast.promise(promise, {
                      loading: 'Guardando reservas...', success: `¡${newReservations.length} reservas importadas!`, error: 'Error al guardar.'
                    });
                    fetchReservations();
                  }
                });
            } catch (error) {
                console.error("Error al procesar el archivo:", error);
                toast.error("Hubo un error al procesar el archivo. Revisa la consola.");
            }
        };
        reader.readAsArrayBuffer(importFile);
    };

    const eventPropGetter = useCallback((event) => ({
        ...(event.type === 'Clase' && { className: 'event-clase' }),
    }), []);


  return (
    <>
      <Modal isOpen={isBookingModalOpen} onClose={() => setIsBookingModalOpen(false)} title="Confirmar Reserva">
        {slotInfo && (
          <form onSubmit={handleCreateReservation} className="modal-form">
            <p><strong>Laboratorio:</strong> {selectedLab?.name}</p>
            <p><strong>Fecha:</strong> {slotInfo.start.toLocaleDateString('es-ES', {weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'})}</p>
            <p><strong>Horario:</strong> {`${format(slotInfo.start, 'HH:mm')} - ${format(slotInfo.end, 'HH:mm')}`}</p>
            <div className="form-group">
              <label htmlFor="purpose">Motivo de la Reserva (Ej: Clase, Proyecto)</label>
              <input id="purpose" type="text" value={purpose} onChange={(e) => setPurpose(e.target.value)} required />
            </div>
            <div className="modal-actions">
              <button type="button" className="action-btn cancel-btn" onClick={() => setIsBookingModalOpen(false)}>Cancelar</button>
              <button type="submit" className="action-btn save-btn">Reservar Espacio</button>
            </div>
          </form>
        )}
      </Modal>

      <Modal isOpen={isViewModalOpen} onClose={() => setIsViewModalOpen(false)} title="Detalles de la Reserva">
        {selectedEvent && (
          <div className="view-modal-content">
            <p><strong>Tipo:</strong> {selectedEvent.type || 'Practica'}</p>
            <p><strong>Laboratorio:</strong> {selectedEvent.labName}</p>
            {selectedEvent.type === 'Clase' ? (
              <>
                <p><strong>Clase:</strong> {selectedEvent.purpose}</p>
                <p><strong>Facultad:</strong> {selectedEvent.faculty}</p>
                <p><strong>Carrera:</strong> {selectedEvent.career}</p>
                <p><strong>Nombre del Docente:</strong> {selectedEvent.teacherName}</p>
                <p><strong>Docente (TH):</strong> {selectedEvent.teacherId}</p>
                <p><strong>Sección:</strong> {selectedEvent.section}</p>
                <p><strong>Alumnos:</strong> {selectedEvent.studentCount}</p>
              </>
            ) : (
              <>
                <p><strong>Reservado por:</strong> {selectedEvent.userEmail}</p>
                <p><strong>Motivo:</strong> {selectedEvent.purpose}</p>
              </>
            )}
            <p><strong>Fecha:</strong> {format(selectedEvent.start, 'dd/MM/yyyy')}</p>
            <p><strong>Horario:</strong> {`${format(selectedEvent.start, 'HH:mm')} - ${format(selectedEvent.end, 'HH:mm')}`}</p>
            {userData?.role === 'admin' && (
              <div className="modal-actions">
                <button 
                  className="action-btn delete-btn" 
                  onClick={() => handleDeleteReservation(selectedEvent.id)}
                >
                  Eliminar Reserva (Admin)
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} title="Importar Carga Académica">
        <form onSubmit={handleImportSubmit} className="modal-form">
          <p>Sube el archivo Excel con la carga académica. Los códigos en 'espacio_aprendizaje' deben coincidir con la lista predefinida.</p>
          <div className="form-group">
            <label htmlFor="period-start">Fecha de Inicio del Período</label>
            <input id="period-start" type="date" value={periodStartDate} onChange={e => setPeriodStartDate(e.target.value)} required />
          </div>
          <div className="form-group">
            <label htmlFor="period-end">Fecha de Fin del Período</label>
            <input id="period-end" type="date" value={periodEndDate} onChange={e => setPeriodEndDate(e.target.value)} required />
          </div>
          <div className="form-group">
            <label htmlFor="file-upload">Archivo Excel (.xlsx, .xls)</label>
            <input id="file-upload" type="file" accept=".xlsx, .xls" onChange={handleFileChange} required />
          </div>
          <div className="modal-actions">
            <button type="button" className="action-btn cancel-btn" onClick={() => setIsImportModalOpen(false)}>Cancelar</button>
            <button type="submit" className="action-btn save-btn">Importar</button>
          </div>
        </form>
      </Modal>

      <div className="page-container reservations-page">
        <div className="reservations-header">
          <h1 className="reservations-title">Reserva de Laboratorios</h1>
          <div className="lab-selector-actions">
            {userData?.role === 'admin' && (
              <button className="import-button" onClick={() => setIsImportModalOpen(true)}>
                Importar Carga
              </button>
            )}
            <div className="lab-selector">
              <label htmlFor="lab-select">Selecciona un Laboratorio:</label>
              <select id="lab-select" value={selectedLab?.id || ''} onChange={(e) => { const lab = labs.find(l => l.id === e.target.value); setSelectedLab(lab); }}>
                {labs.map(lab => <option key={lab.id} value={lab.id}>{lab.name}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="calendar-container">
          {loading ? <p style={{ textAlign: 'center', padding: '2rem' }}>Cargando calendario...</p> : (
            <Calendar
              localizer={localizer} events={reservations} startAccessor="start" endAccessor="end"
              style={{ height: 'calc(100vh - 220px)' }} selectable onSelectSlot={handleSelectSlot}
              onSelectEvent={handleSelectEvent} culture='es' messages={messages} view={view}
              date={date} onView={(newView) => setView(newView)} onNavigate={(newDate) => setDate(newDate)}
              views={['week', 'day']} step={30} timeslots={2}
              min={new Date(0, 0, 0, 7, 0, 0)} max={new Date(0, 0, 0, 22, 0, 0)}
              eventPropGetter={eventPropGetter}
            />
          )}
        </div>
      </div>
    </>
  );
}