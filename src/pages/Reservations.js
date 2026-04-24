import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay, addMinutes } from 'date-fns'; 
import es from 'date-fns/locale/es';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { db } from '../firebaseConfig';
import { collection, getDocs, query, where, Timestamp, addDoc, writeBatch, doc, getDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import ReservationModal from '../components/ReservationModal';
import './styles/Reservations.css'; 
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
// 🔥 IMPORTAMOS SWEETALERT PARA LA ALERTA INTERACTIVA
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

const MySwal = withReactContent(Swal);
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales: { es } });
const messages = { allDay: 'Todo el día', previous: 'Atrás', next: 'Siguiente', today: 'Hoy', month: 'Mes', week: 'Semana', day: 'Día', agenda: 'Agenda', date: 'Fecha', time: 'Hora', event: 'Evento', noEventsInRange: 'No hay eventos en este rango.' };

export default function Reservations() {
  const { currentUser, userData } = useAuth();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  
  const urlSede = params.get('sede') || "";
  const urlTipo = params.get('tipo') || 'Aula';
  const urlSpaceId = params.get('spaceId');

  const canManageMassLoad = userData?.role === 'superadmin' || 
                            userData?.role === 'coord_labs' || 
                            userData?.role === 'coord_aulas';

  const [allSpaces, setAllSpaces] = useState([]);
  const [activeSpace, setActiveSpace] = useState(null);
  const [reservations, setReservations] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentView, setCurrentView] = useState('month');
  
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [slotInfo, setSlotInfo] = useState(null);

  const [isMassLoadOpen, setIsMassLoadOpen] = useState(false);
  const [loadingMass, setLoadingMass] = useState(false);
  const [massStep, setMassStep] = useState(1); 
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [previewStats, setPreviewStats] = useState({ count: 0, spacesFound: 0 });
  const [preparedReservations, setPreparedReservations] = useState([]);

  const closeMassModal = useCallback(() => {
    setIsMassLoadOpen(false);
    setMassStep(1);
    setPreparedReservations([]);
    setPreviewStats({ count: 0, spacesFound: 0 });
    setLoadingMass(false);
  },[]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  },[]);

  useEffect(() => {
    const fetchSpaces = async () => {
      try {
        const snap = await getDocs(collection(db, 'spaces'));
        const rawData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const filtered = rawData.filter(s => {
            const sedeBD = (s.sede || s.campus || "").toLowerCase().replace('ceutec', '').replace('sps', '').trim();
            const sedeURL = urlSede.toLowerCase().replace('ceutec', '').replace('sps', '').trim();
            const tipoBD = (s.type || s.tipo || "").toLowerCase().trim();
            const tipoURL = urlTipo.toLowerCase().trim();
            return (sedeBD.includes(sedeURL) || sedeURL.includes(sedeBD)) && tipoBD.includes(tipoURL);
        });
        filtered.sort((a, b) => (a.name || "").localeCompare(b.name || "", undefined, {numeric: true}));
        setAllSpaces(filtered);
        if (urlSpaceId) {
          const found = filtered.find(s => s.id === urlSpaceId);
          if (found) { setActiveSpace(found); setSearchTerm(found.name); }
        }
      } catch (error) { console.error(error); }
    };
    fetchSpaces();
  },[urlSede, urlTipo, urlSpaceId]);

  const fetchReservations = useCallback(async () => {
    if (!activeSpace) return;
    try {
      const q = query(collection(db, 'reservations'), where('labId', '==', activeSpace.id));
      const snap = await getDocs(q);
      const data = snap.docs.map(doc => {
        const res = doc.data();
        
        if (!res.startTime || !res.endTime || typeof res.startTime.toDate !== 'function') {
            return null;
        }

        return {
          ...res,
          id: doc.id,
          start: res.startTime.toDate(),
          end: res.endTime.toDate(),
          title: res.className ? `[${res.section || 'S/S'}] ${res.className}` : (res.purpose || 'Reservado')
        };
      }).filter(Boolean);

      setReservations(data);
    } catch (err) { 
      console.error(err); 
      toast.error("Error de sincronización con la base de datos.");
    }
  }, [activeSpace]);

  useEffect(() => { fetchReservations(); }, [fetchReservations]);

  const handleSlotSelect = (slot) => {
    if (slot.start < new Date()) return toast.error("No se pueden realizar reservas pasadas.");
    setSlotInfo(slot); setIsBookingModalOpen(true); 
  };

  const handleFileRead = async (e) => {
    const file = e.target.files[0];
    if (!file || !periodStart || !periodEnd) return toast.error("Selecciona fechas y archivo.");
    setLoadingMass(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const dataBuffer = new Uint8Array(event.target.result);
        const workbook = XLSX.read(dataBuffer, { type: 'array' });
        const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        const spacesSnap = await getDocs(collection(db, 'spaces'));
        const spaceMap = {};
        spacesSnap.docs.forEach(doc => {
            const s = { id: doc.id, ...doc.data() };
            if (s.codigoOriginal) spaceMap[s.codigoOriginal.toString().trim().toUpperCase()] = s;
        });

        const tempReservations =[];
        const usedSpaces = new Set();
        const [sy, sm, sd] = periodStart.split('-').map(Number);
        const [ey, em, ed] = periodEnd.split('-').map(Number);
        const startDateObj = new Date(sy, sm - 1, sd, 0, 0, 0);
        const endDateObj = new Date(ey, em - 1, ed, 23, 59, 59);

        for (const row of jsonData) {
            const findKey = (search) => Object.keys(row).find(k => k.toLowerCase().includes(search.toLowerCase()));
            
            const codigoEspacio = row[findKey('espacio_aprendizaje')]?.toString().trim().toUpperCase();
            const targetSpace = spaceMap[codigoEspacio];

            if (targetSpace) {
                usedSpaces.add(targetSpace.id);
                let startHour = 0, startMinute = 0;
                const horaRaw = row[findKey('hora')];

                if (typeof horaRaw === 'number') {
                    const totalMinutes = Math.round(horaRaw * 24 * 60);
                    startHour = Math.floor(totalMinutes / 60);
                    startMinute = totalMinutes % 60;
                } else if (typeof horaRaw === 'string') {
                    const timeStr = horaRaw.trim().toUpperCase();
                    const matches = timeStr.match(/(\d+):(\d+)\s*(AM|PM)?/);
                    if (matches) {
                        let hours = parseInt(matches[1]);
                        const minutes = parseInt(matches[2]);
                        const period = matches[3];
                        if (period === 'PM' && hours < 12) hours += 12;
                        if (period === 'AM' && hours === 12) hours = 0;
                        startHour = hours; startMinute = minutes;
                    }
                }

                const diasKey = findKey('dias_habile') || findKey('dias_habiles');
                const diasCode = row[diasKey]?.toString() || "";
                const daysToReserve = diasCode.split('').map(Number).filter(n => !isNaN(n));
                
                let iterDate = new Date(startDateObj);
                while (iterDate <= endDateObj) {
                    if (daysToReserve.includes(getDay(iterDate))) {
                        const startDT = new Date(iterDate.getFullYear(), iterDate.getMonth(), iterDate.getDate(), startHour, startMinute, 0);
                        const endDT = addMinutes(startDT, parseInt(row[findKey('duracion_clase')]) || 60);
                        
                        tempReservations.push({
                            labId: targetSpace.id, labName: targetSpace.name, sede: targetSpace.sede || urlSede, spaceType: targetSpace.type, 
                            userId: "SYSTEM_MALLA", 
                            userEmail: row[findKey('correo')] || "Carga Académica", 
                            
                            userName: row[findKey('nombre_docente')] || row[findKey('catedratico')] || row[findKey('profesor')] || 'Docente',
                            className: row[findKey('nombre_materia')] || row[findKey('asignatura')] || row[findKey('clase')] || 'Clase', 
                            
                            section: row[findKey('seccion')]?.toString() || '', 
                            th: row[findKey('codigo_th')]?.toString() || 'N/A',
                            subjectCode: row[findKey('codigo_materia')]?.toString() || 'N/A', 
                            attendees: row[findKey('cupo')] || 0,
                            startTime: Timestamp.fromDate(startDT), endTime: Timestamp.fromDate(endDT), createdAt: Timestamp.now(),
                            fulfillmentStatus: 'Confirmada', reservationType: 'academic_load'
                        });
                    }
                    iterDate.setDate(iterDate.getDate() + 1);
                }
            }
        }
        setPreparedReservations(tempReservations);
        setPreviewStats({ count: tempReservations.length, spacesFound: usedSpaces.size });
        setMassStep(2); setLoadingMass(false);
      } catch (e) { toast.error(e.message); setLoadingMass(false); }
    };
    reader.readAsArrayBuffer(file);
  };

  const confirmUpload = async () => {
    setLoadingMass(true);
    const batchSize = 450; 
    try {
        const [sy, sm, sd] = periodStart.split('-').map(Number);
        const [ey, em, ed] = periodEnd.split('-').map(Number);
        const startSearch = new Date(sy, sm - 1, sd, 0, 0, 0);
        const endSearch = new Date(ey, em - 1, ed, 23, 59, 59);

        toast.loading("Paso 1/3: Autorizando Docentes (TH)...", { id: 'processToast' });
        const activeTeachersMap = {};
        preparedReservations.forEach(res => {
            if (res.th && res.th !== 'N/A') {
                activeTeachersMap[res.th] = { th: res.th, name: res.userName, email: res.userEmail, lastUpdate: Timestamp.now() };
            }
        });
        const teacherBatch = writeBatch(db);
        Object.values(activeTeachersMap).forEach(teacher => {
            teacherBatch.set(doc(db, 'active_teachers_list', teacher.th), teacher);
        });
        await teacherBatch.commit();

        toast.loading("Paso 2/3: Limpiando Malla Anterior...", { id: 'processToast' });
        
        const qExisting = query(
            collection(db, 'reservations'), 
            where('startTime', '>=', Timestamp.fromDate(startSearch)), 
            where('startTime', '<=', Timestamp.fromDate(endSearch))
        );
        const snapshot = await getDocs(qExisting);
        
        const docsToDelete = [];
        snapshot.docs.forEach(docSnap => {
            const data = docSnap.data();
            if (data.reservationType === 'academic_load' && data.sede === urlSede) {
                docsToDelete.push(docSnap.ref);
            }
        });

        for (let i = 0; i < docsToDelete.length; i += batchSize) {
            const b = writeBatch(db);
            docsToDelete.slice(i, i + batchSize).forEach(ref => b.delete(ref));
            await b.commit();
        }

        toast.loading(`Paso 3/3: Guardando ${preparedReservations.length} clases...`, { id: 'processToast' });
        for (let i = 0; i < preparedReservations.length; i += batchSize) {
            const b = writeBatch(db);
            preparedReservations.slice(i, i + batchSize).forEach(res => b.set(doc(collection(db, "reservations")), res));
            await b.commit();
        }

        toast.success(`Carga exitosa.`, { id: 'processToast' });
        
        setIsMassLoadOpen(false);
        setMassStep(1);
        setPreparedReservations([]);
        setPreviewStats({ count: 0, spacesFound: 0 });
        setLoadingMass(false);
        
        fetchReservations(); 
    } catch (error) { toast.error(error.message, { id: 'processToast' }); setLoadingMass(false); }
  };

  const handleSelectSpace = (space) => { setActiveSpace(space); setSearchTerm(space.name); setIsDropdownOpen(false); };

  // 🔥 LÓGICA DE ALERTA, BÚSQUEDA Y CIERRE UX (Reservations.js) 🔥
  const handleSubmitReservation = async (d) => {
    // 1. UX CRÍTICO: Cerramos el modal INMEDIATAMENTE al dar clic en guardar
    setIsBookingModalOpen(false);
    
    const toastId = toast.loading("Buscando docente y procesando...");
    try {
        let teacherName = "";
        let teacherEmail = "pendiente@unitec.edu.hn"; // Correo provisional si no existe
        let teacherId = "PENDIENTE_REGISTRO";
        let docenteEncontrado = false;

        // Búsqueda del TH en las bases de datos
        if (d.thDocente) {
            const cleanTh = d.thDocente.toString().trim();
            
            // Intento 1: active_teachers_list
            const teacherRef = doc(db, 'active_teachers_list', cleanTh);
            const teacherSnap = await getDoc(teacherRef);
            
            if (teacherSnap.exists()) {
                teacherName = teacherSnap.data().name;
                if (teacherSnap.data().email && teacherSnap.data().email !== "Pendiente de Registro") {
                    teacherEmail = teacherSnap.data().email;
                }
                docenteEncontrado = true;
            } else {
                // Intento 2: Lista de usuarios activos
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
        }

        // 🔥 SI NO SE ENCUENTRA AL DOCENTE, PEDIMOS EL NOMBRE MANUALMENTE 🔥
        if (!docenteEncontrado && d.thDocente) {
            toast.dismiss(toastId); // Pausamos el loading
            
            const { value: manualName, isDismissed } = await MySwal.fire({
                title: 'Docente no encontrado',
                text: `No encontramos a ningún docente con el TH ${d.thDocente}. Ingresa su nombre completo para registrar la reserva a su nombre:`,
                input: 'text',
                icon: 'warning',
                inputPlaceholder: 'Ej. Juan Carlos Pérez',
                showCancelButton: true,
                confirmButtonText: 'Guardar Reserva',
                cancelButtonText: 'Cancelar',
                confirmButtonColor: '#c8102e',
                inputValidator: (value) => {
                    if (!value) {
                        return '¡Necesitas ingresar el nombre del docente!'
                    }
                }
            });

            // Si cancela la alerta manual, se detiene el guardado
            if (isDismissed) return; 
            
            teacherName = manualName.toUpperCase();
            toast.loading("Guardando reserva manual...", { id: toastId }); // Retomamos el loading
        } else if (!d.thDocente) {
             // Fallback de seguridad si dejan el TH en blanco
             teacherName = currentUser.displayName;
             teacherEmail = currentUser.email;
             teacherId = currentUser.uid;
        }

        // Guardado de la reserva en la BD
        await addDoc(collection(db, 'reservations'), {
            ...d, 
            labId: activeSpace.id, 
            labName: activeSpace.name, 
            sede: urlSede, 
            userId: teacherId, 
            userEmail: teacherEmail, 
            userName: teacherName, 
            th: d.thDocente || 'N/A', 
            reservedByEmail: currentUser.email,
            reservedByName: currentUser.displayName,
            attendees: d.studentCount, 
            startTime: Timestamp.fromDate(new Date(d.start)), 
            endTime: Timestamp.fromDate(new Date(d.end)), 
            createdAt: Timestamp.now(), 
            fulfillmentStatus: 'Pendiente', 
            reservationType: 'Manual'
        }); 
        
        toast.success("Reserva guardada con éxito", {id: toastId});
        fetchReservations(); 
    } catch (e) {
        toast.error("Error al guardar reserva", {id: toastId});
        console.error(e);
    }
  };

  return (
    <div className="dashboard-wrapper">
      <div className="reservations-container-glass">
        <header className="reservations-header-pro">
          <div className="header-nav-left">
             <Link to={`/dashboard?sede=${urlSede}`} className="back-link-simple">← Volver al Dashboard</Link>
             <h1>🗓️ Agenda Académica</h1>
             <p>Sede: <strong>{urlSede}</strong> ({urlTipo}s)</p>
          </div>
          {canManageMassLoad && (
            <div className="header-actions">
               <button onClick={() => setIsMassLoadOpen(true)} className="btn-save-pro" style={{background: '#198754'}}>📤 Carga Masiva</button>
            </div>
          )}
        </header>

        <div className="search-selection-wrapper" ref={dropdownRef}>
            <div className={`custom-searchable-select ${isDropdownOpen ? 'is-open' : ''}`}>
                <div className="input-container" onClick={() => setIsDropdownOpen(true)}>
                    <input type="text" placeholder={`Buscar ${urlTipo.toLowerCase()}...`} value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setIsDropdownOpen(true); }} />
                </div>
                {isDropdownOpen && (
                    <ul className="dropdown-list fade-in">
                        {allSpaces.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase())).map(s => (
                            <li key={s.id} onClick={() => handleSelectSpace(s)} className={activeSpace?.id === s.id ? 'selected' : ''}>
                                <div className="opt-name" style={{fontWeight: '800'}}>{s.name}</div>
                                <div className="opt-id" style={{fontSize: '0.7rem', color: '#94a3b8'}}>CÓDIGO: {s.id}</div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>

      <div className="calendar-main-card">
          {activeSpace ? (
            <Calendar 
              localizer={localizer} 
              events={reservations} 
              style={{ height: '75vh', minHeight: '650px' }} 
              culture="es" 
              messages={messages} 
              date={currentDate} 
              view={currentView} 
              onNavigate={setCurrentDate} 
              onView={setCurrentView} 
              selectable 
              onSelectSlot={handleSlotSelect} 
              onSelectEvent={(ev) => { setSelectedEvent(ev); setIsViewModalOpen(true); }} 
            />
          ) : <div className="empty-state-calendar"><h3>Selecciona un espacio arriba ☝️</h3></div>}
        </div>
      </div>

      <ReservationModal 
        isOpen={isBookingModalOpen} 
        onClose={() => setIsBookingModalOpen(false)} 
        spaceData={activeSpace} 
        slotInfo={slotInfo} 
        onSubmit={handleSubmitReservation} 
        existingReservations={reservations} 
      />
      
      <Modal isOpen={isViewModalOpen} onClose={() => setIsViewModalOpen(false)} title="Detalles de la Reserva">
        {selectedEvent && (
          <div className="details-view-container">
            <div className="details-header">
                <span className="detail-type-badge">{selectedEvent.reservationType === 'academic_load' ? 'Carga Académica' : 'Manual'}</span>
                <h2 style={{lineHeight: '1.2'}}>{selectedEvent.className || selectedEvent.purpose}</h2>
                <h4 style={{color:'#666', marginTop:'5px'}}>{selectedEvent.labName}</h4>
            </div>
            
            <div className="details-grid" style={{display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px', marginTop: '20px'}}>
                <div className="detail-box" style={{gridColumn: 'span 2', background: '#f8fafc', border: '1px solid #edf2f7', padding: '10px', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                     <label style={{fontSize: '0.7rem', fontWeight:'800', color: '#64748b'}}>CÓDIGO MATERIA</label>
                     <span style={{fontSize: '1.1rem', fontWeight: '900', color: '#c8102e'}}>{selectedEvent.subjectCode || 'N/A'}</span>
                </div>

                <div className="detail-box"> 
                    <label style={{fontSize: '0.65rem', fontWeight:'800', color: '#c8102e'}}>DOCENTE</label> 
                    <p style={{fontWeight:'bold', fontSize:'0.9rem', margin:0}}>{selectedEvent.userName}</p> 
                </div>
                
                <div className="detail-box"> 
                    <label style={{fontSize: '0.65rem', fontWeight:'800', color: '#c8102e'}}>SECCIÓN</label> 
                    <p style={{margin:0, fontWeight:'600'}}>{selectedEvent.section || '---'}</p> 
                </div>
                
                <div className="detail-box"> 
                    <label style={{fontSize: '0.65rem', fontWeight:'800', color: '#c8102e'}}>TH</label> 
                    <p style={{fontWeight:'bold', margin:0}}>{selectedEvent.th || 'N/A'}</p> 
                </div>
                
                <div className="detail-box"> 
                    <label style={{fontSize: '0.65rem', fontWeight:'800', color: '#c8102e'}}>ESTUDIANTES</label> 
                    <p style={{margin:0, fontWeight:'600'}}>{selectedEvent.attendees || '0'}</p> 
                </div>

                {selectedEvent.reservedByEmail && selectedEvent.reservedByEmail !== selectedEvent.userEmail && (
                    <div className="detail-box" style={{gridColumn: 'span 2', background: '#f0f9ff', borderColor: '#bae6fd'}}> 
                        <label style={{fontSize: '0.65rem', fontWeight:'800', color: '#0369a1'}}>RESERVADO POR (COORDINACIÓN)</label> 
                        <p style={{margin:0, fontWeight:'600', fontSize:'0.85rem', color: '#0f172a'}}>{selectedEvent.reservedByEmail}</p> 
                    </div>
                )}
                
                <div className="detail-box time-box" style={{gridColumn: '1 / -1', background: '#fff5f5', padding: '15px', borderRadius: '12px', textAlign: 'center', border: '1px solid #fee2e2'}}>
                    <label style={{fontSize: '0.7rem', fontWeight:'800', color: '#c8102e'}}>FECHA Y HORARIO</label>
                    <p style={{fontSize: '1.1rem', fontWeight: '800', color: '#1a202c', margin: '5px 0'}}> 
                        {format(selectedEvent.start, 'dd MMM yyyy')} <br/> 
                        <span style={{color:'#c8102e'}}>{format(selectedEvent.start, 'HH:mm')} - {format(selectedEvent.end, 'HH:mm')}</span>
                    </p>
                </div>
            </div>
            <div className="modal-footer-pro" style={{marginTop: '25px', textAlign:'right'}}> 
                <button onClick={() => setIsViewModalOpen(false)} className="btn-save-pro" style={{width:'100%'}}>Cerrar</button> 
            </div>
          </div>
        )}
      </Modal>

      {/* 🔥 MODAL DE CARGA MASIVA CON DISEÑO MODERNO 🔥 */}
      <Modal isOpen={isMassLoadOpen} onClose={closeMassModal} title="Carga Académica Masiva">
         <div style={{padding: '10px 20px 30px'}}>
            {massStep === 1 && (
                <div className="fade-in">
                    <p style={{color: '#64748b', fontSize: '0.9rem', marginBottom: '20px', lineHeight: '1.5'}}>
                        Define el rango de fechas del período académico y arrastra el archivo maestro (Excel) para procesar la carga en la sede: <strong>{urlSede}</strong>.
                    </p>
                    
                    <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '25px'}}>
                        <div style={{display: 'flex', flexDirection: 'column'}}> 
                            <label style={{fontSize: '0.8rem', fontWeight: '800', color: '#1e293b', marginBottom: '5px'}}>INICIO PERIODO:</label> 
                            <input type="date" style={{padding: '14px', borderRadius: '12px', border: '2px solid #edf2f7', outline: 'none', fontFamily: 'inherit', fontWeight: '600'}} value={periodStart} onChange={e => setPeriodStart(e.target.value)} /> 
                        </div>
                        <div style={{display: 'flex', flexDirection: 'column'}}> 
                            <label style={{fontSize: '0.8rem', fontWeight: '800', color: '#1e293b', marginBottom: '5px'}}>FIN PERIODO:</label> 
                            <input type="date" style={{padding: '14px', borderRadius: '12px', border: '2px solid #edf2f7', outline: 'none', fontFamily: 'inherit', fontWeight: '600'}} value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} /> 
                        </div>
                    </div>
                    
                    <div style={{
                        border: '2px dashed #c8102e', 
                        borderRadius: '16px', 
                        padding: '40px 20px', 
                        textAlign: 'center',
                        background: 'rgba(200, 16, 46, 0.03)',
                        cursor: 'pointer',
                        position: 'relative',
                        transition: 'all 0.3s ease'
                    }}>
                        <input 
                            type="file" 
                            accept=".xlsx, .xls" 
                            onChange={handleFileRead} 
                            style={{
                                opacity: 0, position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', cursor: 'pointer'
                            }}
                        />
                        <div style={{fontSize: '2.5rem', marginBottom: '10px'}}>📁</div>
                        <h4 style={{color: '#1e293b', margin: '0 0 5px 0'}}>Haz clic o arrastra el archivo Excel</h4>
                        <p style={{color: '#64748b', fontSize: '0.8rem', margin: 0}}>Solo formatos .xlsx y .xls permitidos</p>
                    </div>
                </div>
            )}

            {massStep === 2 && (
                <div className="fade-in" style={{textAlign: 'center', padding: '20px 0'}}>
                    <div style={{fontSize: '3rem', marginBottom: '15px'}}>✨</div>
                    <h2 style={{color: '#1e293b', marginBottom: '10px', fontWeight: '800'}}>Archivo Analizado</h2>
                    
                    <div style={{background: '#f8fafc', padding: '20px', borderRadius: '16px', marginBottom: '25px', border: '1px solid #edf2f7'}}>
                        <p style={{margin: '0 0 5px 0', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', fontSize: '0.8rem'}}>Clases Nuevas Detectadas</p>
                        <h1 style={{margin: 0, color: '#c8102e', fontSize: '3rem', fontWeight: '900'}}>{previewStats.count}</h1>
                    </div>
                    
                    <div style={{display: 'flex', gap: '15px'}}>
                        <button onClick={closeMassModal} disabled={loadingMass} className="btn-cancel-pro" style={{flex: 1, padding: '16px', borderRadius: '14px', background: '#f1f5f9', color: '#64748b', border: 'none', fontWeight: '800', cursor: 'pointer'}}>
                            Cancelar
                        </button>
                        <button onClick={confirmUpload} disabled={loadingMass} className="btn-save-pro" style={{flex: 2, padding: '16px', borderRadius: '14px', background: '#c8102e', color: 'white', border: 'none', fontWeight: '800', cursor: 'pointer'}}>
                            {loadingMass ? 'Guardando...' : 'Confirmar y Subir'}
                        </button>
                    </div>
                </div>
            )}
         </div>
      </Modal>
    </div>
  );
}