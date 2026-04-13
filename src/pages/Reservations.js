import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay, addMinutes } from 'date-fns'; 
import es from 'date-fns/locale/es';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { db } from '../firebaseConfig';
import { collection, getDocs, query, where, Timestamp, addDoc, writeBatch, doc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import ReservationModal from '../components/ReservationModal';
import './styles/Reservations.css'; 
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

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
  const [loading, setLoading] = useState(false);
  const[searchTerm, setSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentView, setCurrentView] = useState('month');
  
  const[isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const[isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [slotInfo, setSlotInfo] = useState(null);

  const[isMassLoadOpen, setIsMassLoadOpen] = useState(false);
  const [loadingMass, setLoadingMass] = useState(false);
  const [massStep, setMassStep] = useState(1); 
  const[periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const[previewStats, setPreviewStats] = useState({ count: 0, spacesFound: 0 });
  const[preparedReservations, setPreparedReservations] = useState([]);

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
    setLoading(true);
    try {
      const q = query(collection(db, 'reservations'), where('labId', '==', activeSpace.id));
      const snap = await getDocs(q);
      const data = snap.docs.map(doc => {
        const res = doc.data();
        return {
          ...res,
          id: doc.id,
          start: res.startTime.toDate(),
          end: res.endTime.toDate(),
          title: res.className ? `[${res.section || 'S/S'}] ${res.className}` : (res.purpose || 'Reservado')
        };
      });
      setReservations(data);
    } catch (err) { console.error(err); } finally { setLoading(false); }
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
            // 🔴 MAPEO FLEXIBLE DE COLUMNAS
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
                            userName: row[findKey('nombre')] || row[findKey('docente_nombre')] || 'Docente',
                            className: row[findKey('nombre_materia')] || 'Clase', 
                            // 🔴 ASIGNACIÓN SEGÚN HEADERS DEL EXCEL
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

        // PASO 1: DOCENTES
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

        // PASO 2: LIMPIEZA
        toast.loading("Paso 2/3: Limpiando Malla...", { id: 'processToast' });
        const qExisting = query(collection(db, 'reservations'), where('startTime', '>=', Timestamp.fromDate(startSearch)), where('startTime', '<=', Timestamp.fromDate(endSearch)));
        const snapshot = await getDocs(qExisting);
        const existingByLab = {};
        snapshot.docs.forEach(docSnap => {
            const d = docSnap.data();
            if (!existingByLab[d.labId]) existingByLab[d.labId] = [];
            existingByLab[d.labId].push({ ref: docSnap.ref, start: d.startTime.toDate().getTime(), end: d.endTime.toDate().getTime() });
        });
        const docsToDelete = new Set();
        preparedReservations.forEach(newR => {
            const potentials = existingByLab[newR.labId];
            if (potentials) {
                const nS = newR.startTime.toDate().getTime();
                const nE = newR.endTime.toDate().getTime();
                potentials.forEach(old => { if (nS < old.end && nE > old.start) docsToDelete.add(old.ref); });
            }
        });
        const delArray = Array.from(docsToDelete);
        for (let i = 0; i < delArray.length; i += batchSize) {
            const b = writeBatch(db);
            delArray.slice(i, i + batchSize).forEach(ref => b.delete(ref));
            await b.commit();
        }

        // PASO 3: GUARDADO
        toast.loading(`Paso 3/3: Guardando ${preparedReservations.length} clases...`, { id: 'processToast' });
        for (let i = 0; i < preparedReservations.length; i += batchSize) {
            const b = writeBatch(db);
            preparedReservations.slice(i, i + batchSize).forEach(res => b.set(doc(collection(db, "reservations")), res));
            await b.commit();
        }

        toast.success(`Carga exitosa.`, { id: 'processToast' });
        closeMassModal();
        fetchReservations(); 
    } catch (error) { toast.error(error.message, { id: 'processToast' }); setLoadingMass(false); }
  };

  const handleSelectSpace = (space) => { setActiveSpace(space); setSearchTerm(space.name); setIsDropdownOpen(false); };

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
            <Calendar localizer={localizer} events={reservations} style={{ height: 'calc(100vh - 420px)' }} culture="es" messages={messages} date={currentDate} view={currentView} onNavigate={setCurrentDate} onView={setCurrentView} selectable onSelectSlot={handleSlotSelect} onSelectEvent={(ev) => { setSelectedEvent(ev); setIsViewModalOpen(true); }} />
          ) : <div className="empty-state-calendar"><h3>Selecciona un espacio arriba ☝️</h3></div>}
        </div>
      </div>

      <ReservationModal isOpen={isBookingModalOpen} onClose={() => setIsBookingModalOpen(false)} spaceData={activeSpace} slotInfo={slotInfo} onSubmit={async (d) => { await addDoc(collection(db, 'reservations'), {...d, labId: activeSpace.id, labName: activeSpace.name, sede: urlSede, userId: currentUser.uid, userEmail: currentUser.email, userName: currentUser.displayName, th: d.thDocente, attendees: d.studentCount, startTime: Timestamp.fromDate(new Date(d.start)), endTime: Timestamp.fromDate(new Date(d.end)), createdAt: Timestamp.now(), fulfillmentStatus: 'Pendiente', reservationType: 'Manual'}); setIsBookingModalOpen(false); fetchReservations(); }} existingReservations={reservations} />
      
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

                <div className="detail-box"> <label style={{fontSize: '0.65rem', fontWeight:'800', color: '#c8102e'}}>DOCENTE</label> <p style={{fontWeight:'bold', fontSize:'0.9rem', margin:0}}>{selectedEvent.userName}</p> </div>
                <div className="detail-box"> <label style={{fontSize: '0.65rem', fontWeight:'800', color: '#c8102e'}}>SECCIÓN</label> <p style={{margin:0, fontWeight:'600'}}>{selectedEvent.section || '---'}</p> </div>
                <div className="detail-box"> <label style={{fontSize: '0.65rem', fontWeight:'800', color: '#c8102e'}}>TH</label> <p style={{fontWeight:'bold', margin:0}}>{selectedEvent.th || 'N/A'}</p> </div>
                <div className="detail-box"> <label style={{fontSize: '0.65rem', fontWeight:'800', color: '#c8102e'}}>ESTUDIANTES</label> <p style={{margin:0, fontWeight:'600'}}>{selectedEvent.attendees || '0'}</p> </div>
                
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

      <Modal isOpen={isMassLoadOpen} onClose={closeMassModal} title="Carga Académica Masiva (Excel)">
         <div style={{padding: '20px'}}>
            {massStep === 1 && (
                <>
                    <div style={{display: 'flex', gap: '20px', marginBottom: '20px'}}>
                        <div style={{flex: 1}}> <label>Inicio Periodo:</label> <input type="date" className="form-control" value={periodStart} onChange={e => setPeriodStart(e.target.value)} /> </div>
                        <div style={{flex: 1}}> <label>Fin Periodo:</label> <input type="date" className="form-control" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} /> </div>
                    </div>
                    <input type="file" accept=".xlsx, .xls" onChange={handleFileRead} />
                </>
            )}
            {massStep === 2 && (
                <div style={{textAlign: 'center'}}>
                    <p><strong>Clases Nuevas Detectadas:</strong> {previewStats.count}</p>
                    <button onClick={confirmUpload} disabled={loadingMass} className="btn-save-pro">Confirmar y Guardar</button>
                    <button onClick={closeMassModal} className="btn-cancel-pro">Cancelar</button>
                </div>
            )}
         </div>
      </Modal>
    </div>
  );
}