import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay, addDays, addMinutes, setHours, setMinutes, startOfDay, endOfDay } from 'date-fns';
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

const CITY_PERMISSIONS = {
  "San Pedro Sula": ["Ceutec SPS Norte", "Ceutec SPS Central"],
  "Tegucigalpa": ["Ceutec TGU (Prado)", "Ceutec TGU (Centroamerica)"],
  "La Ceiba": ["Ceutec LCE"]
};

const CAMPUS_CITY_MAP = {
  'SPS': 'San Pedro Sula',
  'CENTRAL': 'San Pedro Sula',
  'TGU': 'Tegucigalpa',
  'PRADO': 'Tegucigalpa',
  'CEIBA': 'La Ceiba',
  'LCE': 'La Ceiba'
};

const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales: { es } });
const messages = { allDay: 'Todo el día', previous: 'Atrás', next: 'Siguiente', today: 'Hoy', month: 'Mes', week: 'Semana', day: 'Día', agenda: 'Agenda', date: 'Fecha', time: 'Hora', event: 'Evento', noEventsInRange: 'No hay eventos en este rango.' };

export default function Reservations() {
  const { currentUser, userData } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  
  const urlSede = params.get('sede') || "";
  const urlTipo = params.get('tipo') || 'Aula';
  const urlSpaceId = params.get('spaceId');

  const userCity = userData?.city;
  const allowedSedes = CITY_PERMISSIONS[userCity] || [];
  const isCorrectCity = userData?.role === 'superadmin' || allowedSedes.some(s => urlSede.includes(s) || s.includes(urlSede));
  
  const canManageType = () => {
      if (['superadmin', 'coordinador', 'docente'].includes(userData?.role)) return true;
      if (userData?.role === 'coord_labs' && urlTipo === 'Laboratorio') return true;
      if (userData?.role === 'coord_aulas' && urlTipo === 'Aula') return true;
      return false;
  };

  const canReserveInThisSede = isCorrectCity && canManageType();
  const isProfileComplete = userData?.city && userData?.th;

  // Estados
  const [allSpaces, setAllSpaces] = useState([]);
  const [activeSpace, setActiveSpace] = useState(null);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentView, setCurrentView] = useState('day');
  
  // Modales
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [slotInfo, setSlotInfo] = useState(null);

  // --- ESTADOS PARA CARGA MASIVA ---
  const [isMassLoadOpen, setIsMassLoadOpen] = useState(false);
  const [loadingMass, setLoadingMass] = useState(false);
  const [massStep, setMassStep] = useState(1); 
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [previewStats, setPreviewStats] = useState({ count: 0, spacesFound: 0 });
  const [preparedReservations, setPreparedReservations] = useState([]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchSpaces = async () => {
      try {
        const snap = await getDocs(collection(db, 'spaces'));
        const rawData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const filtered = rawData.filter(s => {
            const sedeBD = (s.sede || s.campus || "").toLowerCase().replace('ceutec', '').trim();
            const sedeURL = urlSede.toLowerCase().replace('ceutec', '').trim();
            const tipoBD = (s.type || s.tipo || "").toLowerCase().trim();
            const coincideSede = sedeBD.includes(sedeURL) || sedeURL.includes(sedeBD);
            const coincideTipo = tipoBD.includes(urlTipo.toLowerCase().trim());
            return coincideSede && coincideTipo;
        });
        filtered.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        setAllSpaces(filtered);
        if (urlSpaceId) {
          const found = filtered.find(s => s.id === urlSpaceId);
          if (found) { setActiveSpace(found); setSearchTerm(found.name); }
        }
      } catch (error) { console.error(error); }
    };
    fetchSpaces();
  }, [urlSede, urlTipo, urlSpaceId]);

  // --- LÓGICA DEL BUSCADOR (RESTAURADA) ---
  const filteredOptions = useMemo(() => {
    return allSpaces.filter(s => 
        (s.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.id || "").toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [allSpaces, searchTerm]);

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
    } catch (err) { console.error("Error al cargar reservas:", err); } 
    finally { setLoading(false); }
  }, [activeSpace]);

  useEffect(() => { fetchReservations(); }, [fetchReservations]);

  const handleSlotSelect = (slot) => {
    if(slot.start < new Date()) { toast.error("No puedes reservar fechas pasadas."); return; }
    if (!isProfileComplete) { toast.error("Completa tu perfil antes de reservar."); navigate(`/perfil?sede=${urlSede}`); return; }
    if (!isCorrectCity) { toast.error(`Tu cuenta es de ${userCity}, no puedes reservar aquí.`); return; }
    if (!canManageType()) { toast.error(`No tienes permisos para gestionar ${urlTipo}s.`); return; }
    setSlotInfo(slot); 
    setIsBookingModalOpen(true); 
  };

  const handleCreateReservation = async (data) => {
    try {
      const newRes = {
        ...data, 
        labId: activeSpace.id,
        labName: activeSpace.name,
        sede: activeSpace.sede || urlSede,
        spaceType: activeSpace.type,
        userId: currentUser.uid,
        userEmail: currentUser.email,
        userName: currentUser.displayName || 'Usuario',
        startTime: Timestamp.fromDate(new Date(data.start)),
        endTime: Timestamp.fromDate(new Date(data.end)),
        createdAt: Timestamp.now(),
        fulfillmentStatus: 'Confirmada',
        reservationType: 'Manual'
      };
      await addDoc(collection(db, 'reservations'), newRes);
      toast.success("Reserva creada con éxito");
      setIsBookingModalOpen(false); 
      fetchReservations(); 
    } catch (error) { toast.error("Error al guardar reserva"); }
  };

  const handleSelectSpace = (space) => {
    setActiveSpace(space); setSearchTerm(space.name); setIsDropdownOpen(false);
  };

  // --- CARGA MASIVA ---
  const handleFileRead = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!periodStart || !periodEnd) {
      toast.error("Selecciona primero las fechas del periodo.");
      e.target.value = null; 
      return;
    }

    setLoadingMass(true);
    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

        const spacesSnap = await getDocs(collection(db, 'spaces'));
        const spaceMap = {};
        spacesSnap.docs.forEach(doc => {
            const s = { id: doc.id, ...doc.data() };
            if (s.codigoOriginal) spaceMap[s.codigoOriginal.toString().trim().toUpperCase()] = s;
        });

        const tempReservations = [];
        const startDateObj = startOfDay(new Date(periodStart));
        const endDateObj = startOfDay(new Date(periodEnd));
        const usedSpaces = new Set();

        for (const row of jsonData) {
            const codigoEspacio = row['espacio_aprendizaje'] ? row['espacio_aprendizaje'].toString().trim().toUpperCase() : null;
            const diasCode = row['dias_habiles'] ? row['dias_habiles'].toString() : ""; 
            const duracionMin = parseInt(row['duracion_clase']) || 90;
            const horaRaw = row['hora']; 

            const targetSpace = spaceMap[codigoEspacio];
            if (targetSpace) {
                usedSpaces.add(targetSpace.id);
                let startHour = 0; let startMinute = 0;
                
                if (typeof horaRaw === 'number') {
                    const totalMinutes = Math.round(horaRaw * 24 * 60);
                    startHour = Math.floor(totalMinutes / 60);
                    startMinute = totalMinutes % 60;
                } else if (typeof horaRaw === 'string') {
                    const timeStr = horaRaw.trim().toUpperCase();
                    const matches = timeStr.match(/(\d+):(\d+)\s*(AM|PM)?/);
                    if (matches) {
                        startHour = parseInt(matches[1]);
                        startMinute = parseInt(matches[2]);
                        const period = matches[3];
                        if (period === 'PM' && startHour < 12) startHour += 12;
                        if (period === 'AM' && startHour === 12) startHour = 0;
                    }
                }

                const daysToReserve = diasCode.split('').map(d => parseInt(d));

                let iterDate = new Date(startDateObj);
                while (iterDate <= endDateObj) {
                    const currentDayNum = getDay(iterDate); 
                    const dayMap = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 0 };
                    const translatedDays = daysToReserve.map(d => dayMap[d]);

                    if (translatedDays.includes(currentDayNum)) {
                        const startDateTime = setMinutes(setHours(new Date(iterDate), startHour), startMinute);
                        const endDateTime = addMinutes(startDateTime, duracionMin);

                        tempReservations.push({
                            labId: targetSpace.id,
                            labName: targetSpace.name,
                            sede: targetSpace.sede || urlSede,
                            spaceType: targetSpace.type, 
                            userId: currentUser.uid,
                            userEmail: currentUser.email,
                            userName: row['nombre'] || 'Docente Carga',
                            className: row['nombre_materia'] || 'Clase',
                            section: row['seccion'] ? row['seccion'].toString() : '',
                            th: row['codigo_th'] ? row['codigo_th'].toString() : 'N/A',
                            attendees: row['matriculados'] || 0,
                            faculty: row['areaGestion'] || '',
                            career: row['nombre_areaacademicasCompactacion'] || '',
                            startTime: Timestamp.fromDate(startDateTime),
                            endTime: Timestamp.fromDate(endDateTime),
                            createdAt: Timestamp.now(),
                            fulfillmentStatus: 'Confirmada',
                            reservationType: 'academic_load'
                        });
                    }
                    iterDate = addDays(iterDate, 1);
                }
            }
        }

        setPreparedReservations(tempReservations);
        setPreviewStats({ count: tempReservations.length, spacesFound: usedSpaces.size });
        setMassStep(2); 
        setLoadingMass(false);
      } catch (error) {
        toast.error("Error leyendo archivo");
        setLoadingMass(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const confirmUpload = async () => {
    setLoadingMass(true);
    const batchSize = 400; 
    try {
        toast.loading("Guardando carga académica...", { id: 'processToast' });
        let writeBatches = [];
        let currentWriteBatch = writeBatch(db);
        let writeCount = 0;

        for (const res of preparedReservations) {
            const newRef = doc(collection(db, "reservations"));
            currentWriteBatch.set(newRef, res);
            writeCount++;
            if (writeCount % batchSize === 0) {
                writeBatches.push(currentWriteBatch);
                currentWriteBatch = writeBatch(db);
            }
        }
        if (writeCount % batchSize !== 0) writeBatches.push(currentWriteBatch);
        
        await Promise.all(writeBatches.map(b => b.commit()));
        toast.success(`Éxito: ${writeCount} clases creadas.`, { id: 'processToast' });
        closeMassModal();
        fetchReservations(); 
    } catch (error) {
        toast.error("Error al guardar: " + error.message, { id: 'processToast' });
        setLoadingMass(false);
    }
  };

  const closeMassModal = () => {
      setIsMassLoadOpen(false);
      setMassStep(1);
      setPreparedReservations([]);
      setPreviewStats({ count: 0, spacesFound: 0 });
      setLoadingMass(false);
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
          <div className="header-actions">
             {/* RESTRICCIÓN DE ROL PARA CARGA MASIVA */}
             {['coord_labs', 'coord_aulas', 'superadmin'].includes(userData?.role) && (
                 <button onClick={() => setIsMassLoadOpen(true)} className="btn-mass-load">
                   📥 Carga Académica Masiva
                 </button>
             )}
             {!canReserveInThisSede && <div className="read-only-badge">⛔ Modo Lectura</div>}
          </div>
        </header>

        <div className="search-selection-wrapper" ref={dropdownRef}>
            <label className="search-label">Selecciona el espacio académico:</label>
            <div className={`custom-searchable-select ${isDropdownOpen ? 'is-open' : ''}`}>
                <div className="input-container" onClick={() => setIsDropdownOpen(true)}>
                    <span className="search-icon">🔍</span>
                    <input type="text" placeholder="Escribe para buscar..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setIsDropdownOpen(true); }} />
                    <span className="chevron">▼</span>
                </div>
                {isDropdownOpen && (
                    <ul className="dropdown-list fade-in">
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map(s => (
                                <li key={s.id} onClick={() => handleSelectSpace(s)} className={activeSpace?.id === s.id ? 'selected' : ''}>
                                    <div className="opt-name">{s.name}</div>
                                    <div className="opt-id">ID: {s.id}</div>
                                </li>
                            ))
                        ) : <li className="no-results">Sin resultados</li>}
                    </ul>
                )}
            </div>
        </div>

        <div className="calendar-main-card">
          {!activeSpace ? (
            <div className="empty-state-calendar"><h3>Busca un espacio arriba ☝️</h3></div>
          ) : loading ? (
            <div className="loader-cal">Cargando disponibilidad...</div>
          ) : (
            <Calendar
              localizer={localizer}
              events={reservations}
              startAccessor="start"
              endAccessor="end"
              style={{ height: 'calc(100vh - 420px)', minHeight: '500px' }}
              culture="es"
              messages={messages}
              date={currentDate}
              view={currentView}
              onNavigate={setCurrentDate}
              onView={setCurrentView}
              selectable={canReserveInThisSede}
              onSelectSlot={handleSlotSelect}
              onSelectEvent={(ev) => { setSelectedEvent(ev); setIsViewModalOpen(true); }}
            />
          )}
        </div>
      </div>

      <ReservationModal isOpen={isBookingModalOpen} onClose={() => setIsBookingModalOpen(false)} spaceData={activeSpace} slotInfo={slotInfo} onSubmit={handleCreateReservation} />
      
      {/* --- MODAL DETALLES DE RESERVA (FICHA TÉCNICA COMPLETA) --- */}
      <Modal isOpen={isViewModalOpen} onClose={() => setIsViewModalOpen(false)} title="Detalles de la Reserva">
        {selectedEvent && (
          <div className="details-view-container">
            <div className="details-header">
                <span className="detail-type-badge">
                  {selectedEvent.reservationType === 'academic_load' ? '📦 Carga Académica' : '👤 Reserva Manual'}
                </span>
                <h2>{selectedEvent.className || 'Actividad Académica'}</h2>
                <h4>{selectedEvent.labName}</h4>
            </div>

            <div className="details-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                
                {/* Información del Docente */}
                <div className="detail-box">
                    <label>Docente Responsable</label>
                    <p>{selectedEvent.userName}</p>
                </div>
                <div className="detail-box">
                    <label>TH / ID Empleado</label>
                    <p style={{color: '#c8102e', fontWeight:'bold'}}>{selectedEvent.th || 'N/A'}</p>
                </div>

                {/* Información Académica */}
                <div className="detail-box">
                    <label>Facultad / Área</label>
                    <p>{selectedEvent.faculty || '---'}</p>
                </div>
                <div className="detail-box">
                    <label>Carrera</label>
                    <p>{selectedEvent.career || '---'}</p>
                </div>

                {/* Detalles de la Clase */}
                <div className="detail-box">
                    <label>Código Materia</label>
                    <p>{selectedEvent.subjectCode || '---'}</p>
                </div>
                <div className="detail-box">
                    <label>Sección</label>
                    <p>{selectedEvent.section || '---'}</p>
                </div>

                {/* Ciclo Académico */}
                <div className="detail-box">
                    <label>Semestre / Q</label>
                    <p>{selectedEvent.semester || '---'}</p>
                </div>
                <div className="detail-box">
                    <label>Módulo</label>
                    <p>{selectedEvent.module || '---'}</p>
                </div>

                {/* Datos Operativos */}
                <div className="detail-box">
                    <label>Modalidad</label>
                    <p>{selectedEvent.modality || 'Presencial'}</p>
                </div>
                <div className="detail-box">
                    <label>N° Estudiantes</label>
                    <p>{selectedEvent.attendees || '0'}</p>
                </div>

                {/* Caja de Horario Destacada */}
                <div className="detail-box time-box" style={{ gridColumn: '1 / -1' }}>
                    <label>Fecha y Horario Programado</label>
                    <p className="big-time">
                        {format(selectedEvent.start, "EEEE, dd 'de' MMMM yyyy", { locale: es })} <br/>
                        {format(selectedEvent.start, 'HH:mm')} - {format(selectedEvent.end, 'HH:mm')}
                    </p>
                </div>
            </div>

            {/* Observaciones e Instrucciones */}
            {selectedEvent.observations && (
                <div className="detail-notes" style={{ marginBottom: '10px' }}>
                    <label>Observaciones del Sistema:</label>
                    <p>{selectedEvent.observations}</p>
                </div>
            )}

            {selectedEvent.purpose && selectedEvent.reservationType !== 'academic_load' && (
                <div className="detail-notes">
                    <label>Propósito de la Reserva:</label>
                    <p>{selectedEvent.purpose}</p>
                </div>
            )}

            <div className="modal-footer-pro">
              <button onClick={() => setIsViewModalOpen(false)} className="btn-save-pro">Cerrar Ficha</button>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={isMassLoadOpen} onClose={closeMassModal} title="Carga Académica Nacional (Excel)">
         <div className="academic-form-pro" style={{padding: '10px 20px 25px 20px'}}>
            {massStep === 1 ? (
                <>
                    <div className="form-row-pro">
                        <div className="field-group">
                            <label>Fecha Inicio Periodo</label>
                            <input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} />
                        </div>
                        <div className="field-group">
                            <label>Fecha Fin Periodo</label>
                            <input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} />
                        </div>
                    </div>
                    <div className="dropzone-mass" style={{marginTop: '20px', border: '2px dashed #cbd5e1', borderRadius: '16px', padding: '40px 20px', textAlign: 'center', background: '#f8fafc'}}>
                        {loadingMass ? (
                            <p>⏳ Procesando registros...</p>
                        ) : (
                            <>
                                <input type="file" id="fileLoad" accept=".xlsx, .xls" onChange={handleFileRead} hidden />
                                <label htmlFor="fileLoad" style={{cursor: 'pointer'}}>
                                    <div style={{fontSize: '2.5rem', marginBottom: '10px'}}>📊</div>
                                    <p style={{fontWeight: '700', color: '#1e293b'}}>Haz clic para subir el archivo Excel</p>
                                    <small style={{color: '#64748b'}}>Se detectarán horarios y códigos de aula automáticamente</small>
                                </label>
                            </>
                        )}
                    </div>
                </>
            ) : (
                <div className="fade-in">
                    <div style={{background: '#f8fafc', padding: '20px', borderRadius: '15px', border: '1px solid #e2e8f0', marginBottom: '25px'}}>
                        <h3 style={{textAlign: 'center', marginBottom: '15px'}}>Resumen de Carga</h3>
                        <div style={{display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #edf2f7'}}>
                            <span>Clases identificadas:</span> <strong>{previewStats.count}</strong>
                        </div>
                        <div style={{display: 'flex', justifyContent: 'space-between', padding: '10px 0'}}>
                            <span>Espacios detectados:</span> <strong>{previewStats.spacesFound}</strong>
                        </div>
                    </div>
                    <div className="modal-footer-pro">
                        <button onClick={closeMassModal} className="btn-cancel-pro">Cancelar</button>
                        <button onClick={confirmUpload} disabled={loadingMass} className="btn-save-pro">Confirmar y Guardar</button>
                    </div>
                </div>
            )}
         </div>
      </Modal>
    </div>
  );
}