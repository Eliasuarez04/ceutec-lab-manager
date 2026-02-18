import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import es from 'date-fns/locale/es';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { db } from '../firebaseConfig';
import { collection, getDocs, query, where, Timestamp, addDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import ReservationModal from '../components/ReservationModal';
import './styles/Reservations.css'; // Importante: Debe importar el CSS corregido
import toast from 'react-hot-toast';

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
        fulfillmentStatus: 'Pendiente'
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

  return (
    <div className="dashboard-wrapper">
      <div className="reservations-container-glass">
        
        <header className="reservations-header-pro">
          <div className="header-nav-left">
             <Link to={`/dashboard?sede=${urlSede}`} className="back-link-simple">← Volver al Dashboard</Link>
             <h1>🗓️ Agenda Académica</h1>
             <p>Sede: <strong>{urlSede}</strong> ({urlTipo}s)</p>
          </div>
          {!canReserveInThisSede && (
              <div className="read-only-badge">⛔ Modo Lectura</div>
          )}
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

      <ReservationModal 
        isOpen={isBookingModalOpen} 
        onClose={() => setIsBookingModalOpen(false)} 
        spaceData={activeSpace} 
        slotInfo={slotInfo} 
        onSubmit={handleCreateReservation} 
      />
      
      {/* --- MODAL DETALLES DE RESERVA (MEJORADO) --- */}
      <Modal isOpen={isViewModalOpen} onClose={() => setIsViewModalOpen(false)} title="Detalles de la Reserva">
        {selectedEvent && (
          <div className="details-view-container">
            
            <div className="details-header">
                <span className="detail-type-badge">{selectedEvent.reservationType || selectedEvent.spaceType}</span>
                <h2>{selectedEvent.className || 'Clase Académica'}</h2>
                <h4>{selectedEvent.labName}</h4>
            </div>

            <div className="details-grid">
                
                <div className="detail-box">
                    <label>Docente Responsable</label>
                    <p>{selectedEvent.userName}</p>
                </div>
                
                <div className="detail-box">
                    <label>TH Asignado</label>
                    <p style={{color: '#c8102e'}}>{selectedEvent.th || 'N/A'}</p>
                </div>

                <div className="detail-box">
                    <label>Facultad</label>
                    <p>{selectedEvent.faculty || '---'}</p>
                </div>

                <div className="detail-box">
                    <label>Carrera</label>
                    <p>{selectedEvent.career || '---'}</p>
                </div>

                <div className="detail-box">
                    <label>Sección</label>
                    <p>{selectedEvent.section || '---'}</p>
                </div>

                <div className="detail-box">
                    <label>Alumnos</label>
                    <p>{selectedEvent.attendees || '0'}</p>
                </div>

                <div className="detail-box time-box">
                    <label>Fecha y Horario</label>
                    <p className="big-time">
                        {format(selectedEvent.start, 'dd MMM yyyy')} <br/>
                        {format(selectedEvent.start, 'HH:mm')} - {format(selectedEvent.end, 'HH:mm')}
                    </p>
                </div>
            </div>

            {selectedEvent.purpose && (
                <div className="detail-notes">
                    <label>Observaciones / Requerimientos:</label>
                    <p>{selectedEvent.purpose}</p>
                </div>
            )}

            <div className="modal-footer-pro">
              <button onClick={() => setIsViewModalOpen(false)} className="btn-save-pro">Cerrar</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}