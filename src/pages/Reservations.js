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

// --- CONFIGURACIÓN ---
const CITY_PERMISSIONS = {
  "San Pedro Sula": ["Ceutec SPS Norte", "Ceutec SPS Central"],
  "Tegucigalpa": ["Ceutec TGU (Prado)", "Ceutec TGU (Centroamerica)"],
  "La Ceiba": ["Ceutec LCE"]
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

  const [allSpaces, setAllSpaces] = useState([]);
  const [activeSpace, setActiveSpace] = useState(null);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentView, setCurrentView] = useState('day');
  
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
        fulfillmentStatus: 'Pendiente',
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

  // ----------------------------------------------------------------------------------
  // --- CARGA MASIVA: LECTURA Y PARSEO DE TIEMPO AM/PM ---
  // ----------------------------------------------------------------------------------
  const handleFileRead = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!periodStart || !periodEnd) {
      toast.error("Selecciona primero las fechas de inicio y fin.");
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
            const sedeBD = (s.sede || s.campus || "").toLowerCase().replace('ceutec', '').trim();
            const sedeURL = urlSede.toLowerCase().replace('ceutec', '').trim();
            if (sedeBD.includes(sedeURL) || sedeURL.includes(sedeBD)) {
                if (s.codigoOriginal) spaceMap[s.codigoOriginal.toString().trim().toUpperCase()] = s;
            }
        });

        const tempReservations = [];
        const startDateObj = startOfDay(new Date(periodStart));
        const endDateObj = startOfDay(new Date(periodEnd));
        const usedSpaces = new Set();

        for (const row of jsonData) {
            const codigoEspacio = row['espacio_aprendizaje'] ? row['espacio_aprendizaje'].toString().trim().toUpperCase() : null;
            const diasCode = row['dias_habiles'] ? row['dias_habiles'].toString() : ""; 
            const duracionMin = parseInt(row['duracion_clase']) || 60;
            const horaRaw = row['hora']; 

            const targetSpace = spaceMap[codigoEspacio];
            if (targetSpace) {
                usedSpaces.add(targetSpace.id);
                
                let startHour = 0; let startMinute = 0;
                
                // --- CORRECCIÓN DE AM/PM ---
                if (typeof horaRaw === 'number') {
                    const totalMinutes = Math.round(horaRaw * 24 * 60);
                    startHour = Math.floor(totalMinutes / 60);
                    startMinute = totalMinutes % 60;
                } else if (typeof horaRaw === 'string') {
                    const timeStr = horaRaw.trim().toUpperCase();
                    // Captura Horas, Minutos y opcionalmente AM/PM
                    const matches = timeStr.match(/(\d+):(\d+)\s*(AM|PM)?/);
                    if (matches) {
                        startHour = parseInt(matches[1]);
                        startMinute = parseInt(matches[2]);
                        const period = matches[3];
                        // Conversión a formato 24h
                        if (period === 'PM' && startHour < 12) startHour += 12;
                        if (period === 'AM' && startHour === 12) startHour = 0;
                    }
                }

                const daysToReserve = [];
                for (let char of diasCode) {
                    const dayNum = parseInt(char);
                    if (!isNaN(dayNum)) daysToReserve.push(dayNum);
                }

                let iterDate = new Date(startDateObj);
                while (iterDate <= endDateObj) {
                    const currentDayNum = getDay(iterDate); 
                    if (daysToReserve.includes(currentDayNum)) {
                        const startDateTime = setMinutes(setHours(new Date(iterDate), startHour), startMinute);
                        const endDateTime = addMinutes(startDateTime, duracionMin);

                        tempReservations.push({
                            labId: targetSpace.id,
                            labName: targetSpace.name,
                            sede: targetSpace.sede || urlSede,
                            spaceType: targetSpace.type, 
                            userId: currentUser.uid,
                            userEmail: currentUser.email,
                            userName: row['nombre'] || row['docente_nombre'] || 'Docente',
                            className: row['nombre_materia'] || 'Clase',
                            section: row['seccion'] ? row['seccion'].toString() : '',
                            th: row['codigo_th'] ? row['codigo_th'].toString() : 'N/A',
                            attendees: row['cupo'] || 0,
                            faculty: row['nombre_areaacademica'] || row['areaGestion'] || '',
                            career: row['codigo_modalidacampusarea'] || '', 
                            semester: row['semestre'] || '',
                            module: row['modulo'] || '',
                            modality: row['modalidadPrograma'] || '',
                            observations: row['observaciones'] || '',
                            instructions: row['instrucciones'] || '',
                            subjectCode: row['codigo_materia'] || '',
                            daysImparted: row['dias_impartida'] || '', 
                            purpose: `Clase: ${row['nombre_materia']} (${row['seccion']})`,
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
        toast.error("Error leyendo archivo: " + error.message);
        setLoadingMass(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // ----------------------------------------------------------------------------------
  // --- CONFIRMACIÓN: ELIMINACIÓN DE DUPLICADOS EXACTOS Y GUARDADO ---
  // ----------------------------------------------------------------------------------
  const confirmUpload = async () => {
    setLoadingMass(true);
    const batchSize = 400; 
    try {
        const startDateObj = startOfDay(new Date(periodStart));
        const endDateObj = endOfDay(new Date(periodEnd));
        
        toast.loading("Eliminando colisiones y guardando...", { id: 'processToast' });

        const qExisting = query(
            collection(db, 'reservations'),
            where('startTime', '>=', Timestamp.fromDate(startDateObj)),
            where('startTime', '<=', Timestamp.fromDate(endDateObj))
        );
        const snapshot = await getDocs(qExisting);
        
        const existingByLab = {};
        snapshot.docs.forEach(doc => {
            const data = doc.data();
            const lid = data.labId;
            if (!existingByLab[lid]) existingByLab[lid] = [];
            existingByLab[lid].push({
                ref: doc.ref,
                start: data.startTime.toDate().getTime(),
                end: data.endTime.toDate().getTime()
            });
        });

        const docsToDelete = new Set(); 
        preparedReservations.forEach(newRes => {
            const targetLabId = newRes.labId;
            const newStart = newRes.startTime.toDate().getTime();
            const newEnd = newRes.endTime.toDate().getTime();
            const potentialConflicts = existingByLab[targetLabId];
            if (potentialConflicts) {
                potentialConflicts.forEach(existing => {
                    if (newStart < existing.end && newEnd > existing.start) {
                        docsToDelete.add(existing.ref);
                    }
                });
            }
        });

        const deleteArray = Array.from(docsToDelete);
        let delBatches = [];
        let currentDelBatch = writeBatch(db);
        let delCount = 0;
        deleteArray.forEach((ref) => {
            currentDelBatch.delete(ref);
            delCount++;
            if (delCount % batchSize === 0) {
                delBatches.push(currentDelBatch);
                currentDelBatch = writeBatch(db);
            }
        });
        if (delCount % batchSize !== 0) delBatches.push(currentDelBatch);
        await Promise.all(delBatches.map(b => b.commit()));

        if (preparedReservations.length > 0) {
            let writeBatches = [];
            let currentWriteBatch = writeBatch(db);
            let writeCount = 0;
            preparedReservations.forEach(res => {
                const newRef = doc(collection(db, "reservations"));
                currentWriteBatch.set(newRef, res);
                writeCount++;
                if (writeCount % batchSize === 0) {
                    writeBatches.push(currentWriteBatch);
                    currentWriteBatch = writeBatch(db);
                }
            });
            if (writeCount % batchSize !== 0) writeBatches.push(currentWriteBatch);
            await Promise.all(writeBatches.map(b => b.commit()));
            toast.success(`Carga completada: ${writeCount} clases. (Conflictos borrados: ${delCount})`, { id: 'processToast' });
        }

        closeMassModal();
        fetchReservations(); 
    } catch (error) {
        toast.error("Error: " + error.message, { id: 'processToast' });
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
             {canReserveInThisSede && (
                 <button onClick={() => setIsMassLoadOpen(true)} className="btn-save-pro" style={{marginRight: '10px', background: '#198754', borderColor: '#198754'}}>📤 Carga Masiva</button>
             )}
             {!canReserveInThisSede && <div className="read-only-badge">⛔ Modo Lectura</div>}
          </div>
        </header>

        <div className="search-selection-wrapper" ref={dropdownRef}>
            <label className="search-label">Selecciona {urlTipo === 'Aula' ? 'el Aula' : 'el Laboratorio'}:</label>
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
            <div className="empty-state-calendar"><h3>Selecciona un espacio arriba ☝️</h3></div>
          ) : loading ? (
            <div className="loader-cal">Cargando...</div>
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
      
      <Modal isOpen={isViewModalOpen} onClose={() => setIsViewModalOpen(false)} title="Detalles de la Reserva">
        {selectedEvent && (
          <div className="details-view-container">
            <div className="details-header">
                <span className="detail-type-badge">{selectedEvent.reservationType === 'academic_load' ? 'Carga Académica' : 'Manual'}</span>
                <h2>{selectedEvent.className}</h2>
                <h4 style={{color:'#666'}}>{selectedEvent.subjectCode ? `Código: ${selectedEvent.subjectCode}` : ''}</h4>
                <h4>{selectedEvent.labName}</h4>
            </div>
            <div className="details-grid" style={{gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))'}}>
                <div className="detail-box"> <label>Docente</label> <p style={{fontWeight:'bold'}}>{selectedEvent.userName}</p> </div>
                <div className="detail-box"> <label>Sección</label> <p>{selectedEvent.section || '---'}</p> </div>
                <div className="detail-box"> <label>TH</label> <p style={{color: '#c8102e', fontWeight:'bold'}}>{selectedEvent.th || 'N/A'}</p> </div>
                <div className="detail-box"> <label>Estudiantes</label> <p>{selectedEvent.attendees || '0'}</p> </div>
                <div className="detail-box time-box" style={{gridColumn: '1 / -1'}}>
                    <label>Fecha y Horario</label>
                    <p className="big-time"> {format(selectedEvent.start, 'dd MMM yyyy')} <br/> {format(selectedEvent.start, 'HH:mm')} - {format(selectedEvent.end, 'HH:mm')} </p>
                </div>
            </div>
            <div className="modal-footer-pro"> <button onClick={() => setIsViewModalOpen(false)} className="btn-save-pro">Cerrar</button> </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={isMassLoadOpen} onClose={closeMassModal} title="Carga Académica Masiva (Excel)">
         <div style={{padding: '20px'}}>
            {massStep === 1 && (
                <>
                    <p>Sube el Excel para programar clases. Se detectará automáticamente el horario AM/PM o 24h.</p>
                    <div style={{display: 'flex', gap: '20px', marginBottom: '20px'}}>
                        <div style={{flex: 1}}> <label>Inicio Periodo:</label> <input type="date" className="form-control" value={periodStart} onChange={e => setPeriodStart(e.target.value)} /> </div>
                        <div style={{flex: 1}}> <label>Fin Periodo:</label> <input type="date" className="form-control" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} /> </div>
                    </div>
                    <div style={{border: '2px dashed #ccc', padding: '30px', textAlign: 'center', borderRadius: '8px', backgroundColor: '#f9f9f9'}}>
                        {loadingMass ? <p>⏳ Analizando archivo...</p> : <input type="file" accept=".xlsx, .xls" onChange={handleFileRead} />}
                    </div>
                </>
            )}
            {massStep === 2 && (
                <div style={{textAlign: 'center'}}>
                    <h3 style={{color: '#333'}}>Confirmar Carga</h3>
                    <div style={{margin: '20px 0', padding: '15px', backgroundColor: '#fff3cd', border:'1px solid #ffeeba', borderRadius: '5px'}}>
                        <p><strong>Clases Nuevas:</strong> {previewStats.count}</p>
                        <p style={{color: '#856404', fontWeight: 'bold'}}>⚠️ SOBRESCRITURA ACTIVADA: Se borrarán choques existentes.</p>
                    </div>
                    <div style={{display: 'flex', justifyContent: 'center', gap: '15px'}}>
                        <button onClick={closeMassModal} style={{padding: '10px 20px', border: '1px solid #ccc', background: 'white', borderRadius: '5px'}}>Cancelar</button>
                        <button onClick={confirmUpload} disabled={loadingMass} style={{padding: '10px 20px', background: '#d9534f', color: 'white', border: 'none', borderRadius: '5px', fontWeight:'bold'}}>Reemplazar y Guardar</button>
                    </div>
                </div>
            )}
         </div>
      </Modal>
    </div>
  );
}