// src/pages/Reservations.js
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import es from 'date-fns/locale/es';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { db } from '../firebaseConfig';
import { collection, getDocs, query, where, Timestamp, addDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import ReservationModal from '../components/ReservationModal';
import './styles/Reservations.css';
import toast from 'react-hot-toast';

const localizer = dateFnsLocalizer({ 
  format, 
  parse, 
  startOfWeek, 
  getDay, 
  locales: { es } 
});

const messages = {
  allDay: 'Todo el día',
  previous: 'Atrás',
  next: 'Siguiente',
  today: 'Hoy',
  month: 'Mes',
  week: 'Semana',
  day: 'Día',
  agenda: 'Agenda',
  date: 'Fecha',
  time: 'Hora',
  event: 'Evento',
  noEventsInRange: 'No hay eventos en este rango.'
};

export default function Reservations() {
  const { currentUser } = useAuth();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  
  const urlSede = params.get('sede') || "";
  const urlTipo = params.get('tipo') || 'Aula';
  const urlSpaceId = params.get('spaceId');

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
          if (found) {
              setActiveSpace(found);
              setSearchTerm(found.name);
          }
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
    } catch (err) {
      console.error("Error al cargar reservas:", err);
    } finally {
      setLoading(false);
    }
  }, [activeSpace]);

  useEffect(() => { fetchReservations(); }, [fetchReservations]);

  // --- FUNCIÓN PARA GUARDAR LA RESERVA (IMPORTANTE) ---
  const handleCreateReservation = async (academicData) => {
    try {
      const newRes = {
        ...academicData, // Esto trae className, section, faculty, purpose, start, end del Modal
        labId: activeSpace.id,
        labName: activeSpace.name,
        sede: activeSpace.sede || urlSede,
        spaceType: activeSpace.type,
        userId: currentUser.uid,
        userEmail: currentUser.email,
        userName: currentUser.displayName || 'Docente',
        // Convertimos las fechas del modal a Timestamps de Firebase
        startTime: Timestamp.fromDate(new Date(academicData.start)),
        endTime: Timestamp.fromDate(new Date(academicData.end)),
        createdAt: Timestamp.now(),
        fulfillmentStatus: 'Pendiente'
      };

      await addDoc(collection(db, 'reservations'), newRes);
      toast.success("Reserva creada con éxito");
      setIsBookingModalOpen(false); // Cerrar modal de carga
      fetchReservations(); // Recargar el calendario para ver la nueva reserva
    } catch (error) {
      console.error("Error al guardar reserva:", error);
      toast.error("No se pudo guardar la reserva");
    }
  };

  const handleSelectSpace = (space) => {
    setActiveSpace(space);
    setSearchTerm(space.name);
    setIsDropdownOpen(false);
  };

  return (
    <div className="dashboard-wrapper">
      <div className="reservations-container-glass">
        
        <header className="reservations-header-pro">
          <div className="header-nav-left">
             <Link to={`/dashboard?sede=${urlSede}`} className="back-link-simple">← Volver al Dashboard</Link>
             <h1>🗓️ Agenda Académica</h1>
             <p>Viendo disponibilidad en: <strong>{urlSede}</strong> ({urlTipo}s)</p>
          </div>
        </header>

        <div className="search-selection-wrapper" ref={dropdownRef}>
            <label className="search-label">Selecciona {urlTipo === 'Aula' ? 'el Aula' : 'el Laboratorio'}:</label>
            <div className={`custom-searchable-select ${isDropdownOpen ? 'is-open' : ''}`}>
                <div className="input-container" onClick={() => setIsDropdownOpen(true)}>
                    <span className="search-icon">🔍</span>
                    <input 
                        type="text" 
                        placeholder="Escribe para buscar..." 
                        value={searchTerm}
                        onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setIsDropdownOpen(true);
                        }}
                    />
                    <span className="chevron">▼</span>
                </div>

                {isDropdownOpen && (
                    <ul className="dropdown-list fade-in">
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map(s => (
                                <li key={s.id} onClick={() => handleSelectSpace(s)} className={activeSpace?.id === s.id ? 'selected' : ''}>
                                    <div className="opt-name">{s.name}</div>
                                    <div className="opt-id">ID: {s.id} • Capacidad: {s.capacity || s.Capacidad}</div>
                                </li>
                            ))
                        ) : (
                            <li className="no-results">No se encontraron coincidencias</li>
                        )}
                    </ul>
                )}
            </div>
        </div>

        <div className="calendar-main-card">
          {!activeSpace ? (
            <div className="empty-state-calendar">
              <div className="empty-icon">☝️</div>
              <h3>Busca y selecciona un espacio arriba</h3>
              <p>Escribe en la barra para cargar el calendario correspondiente.</p>
            </div>
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
              selectable
              onSelectSlot={(slot) => { 
                  if(slot.start < new Date()) return toast.error("No puedes reservar fechas pasadas");
                  setSlotInfo(slot); 
                  setIsBookingModalOpen(true); 
              }}
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
        onSubmit={handleCreateReservation}  // <--- CORREGIDO: Ahora llama a la función de guardar
        existingReservations={reservations} 
      />
      
      <Modal 
        isOpen={isViewModalOpen} 
        onClose={() => setIsViewModalOpen(false)} 
        title="Información de Reserva"
      >
        {selectedEvent && (
          <div className="res-details-glass">
            <div className="res-header-info">
              <span className="res-type-tag">{selectedEvent.spaceType || 'Clase'}</span>
              <h2>{selectedEvent.className || selectedEvent.purpose || 'Sin nombre'}</h2>
              <p className="res-subtitle">{selectedEvent.labName || 'Espacio seleccionado'}</p>
            </div>

            <div className="res-grid-details">
              <div className="res-item">
                <label>Docente</label>
                <p>{selectedEvent.userName || "Carga Académica"}</p>
                <small>{selectedEvent.userEmail || ""}</small>
              </div>
              <div className="res-item">
                <label>Sección / ID</label>
                <p>{selectedEvent.section || 'N/A'}</p>
              </div>
              <div className="res-item">
                <label>Facultad</label>
                <p>{selectedEvent.faculty || 'General'}</p>
              </div>
              <div className="res-item">
                <label>Tipo de Reserva</label>
                <p>{selectedEvent.reservationType || 'Académica'}</p>
              </div>
              <div className="res-item full">
                <label>Horario</label>
                <p className="res-time-highlight">
                  {format(selectedEvent.start, 'HH:mm')} - {format(selectedEvent.end, 'HH:mm')}
                </p>
              </div>
            </div>
            
            {selectedEvent.purpose && (
              <div className="res-notes">
                <label>Notas/Propósito:</label>
                <p>{selectedEvent.purpose}</p>
              </div>
            )}

            <div className="modal-footer-pro">
              <button onClick={() => setIsViewModalOpen(false)} className="btn-save-pro">
                Cerrar Detalle
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}