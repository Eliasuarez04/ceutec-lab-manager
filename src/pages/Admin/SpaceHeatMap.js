import React, { useState, useEffect, useRef } from 'react';
import { db } from '../../firebaseConfig';
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { useSearchParams, Link } from 'react-router-dom';
import { startOfWeek, endOfWeek, eachDayOfInterval, format, addHours, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import toast from 'react-hot-toast';
import '../styles/SpaceHeatMap.css';

const HOURS = Array.from({ length: 15 }, (_, i) => i + 7); // 7 AM a 9 PM

export default function SpaceHeatMap() {
  const [searchParams] = useSearchParams();
  const currentSede = searchParams.get('sede') || "";
  
  const [spaces, setSpaces] = useState([]);
  const [selectedSpace, setSelectedSpace] = useState("");
  const [reservations, setReservations] = useState([]);

  // Filtros y Buscador unificado
  const [filterType, setFilterType] = useState('TODOS');
  const [displaySearch, setDisplaySearch] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Cerrar el dropdown al hacer clic afuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 1. CARGA DE ESPACIOS
  useEffect(() => {
    if (!currentSede) return;
    const searchTarget = currentSede.toLowerCase().replace('ceutec', '').replace(/[()]/g, '').trim();

    const unsubSpaces = onSnapshot(collection(db, 'spaces'), (snap) => {
      const loadedSpaces = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .filter(s => {
          const sSede = (s.sede || s.campus || "").toLowerCase();
          return sSede.includes(searchTarget) || searchTarget.includes(sSede);
        })
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
      
      setSpaces(loadedSpaces);
    });

    return () => unsubSpaces();
  }, [currentSede]);

  // 2. CARGA DE RESERVAS OPTIMIZADA
  useEffect(() => {
    if (!selectedSpace) {
        setReservations([]);
        return;
    }

    const today = new Date();
    const start = Timestamp.fromDate(startOfWeek(today, { weekStartsOn: 1 }));
    const end = Timestamp.fromDate(endOfWeek(today, { weekStartsOn: 1 }));

    const q = query(
      collection(db, 'reservations'),
      where('labId', '==', selectedSpace),
      where('startTime', '>=', start),
      where('startTime', '<=', end)
    );

    const unsubRes = onSnapshot(q, (snap) => {
      setReservations(snap.docs.map(d => ({
        id: d.id,
        start: d.data().startTime.toDate(),
        end: d.data().endTime.toDate(),
        className: d.data().className || 'Reserva Manual',
        userName: d.data().userName || 'Usuario',
        type: d.data().reservationType || 'N/A'
      })));
    }, (error) => {
      console.error(error);
      toast.error("Revisa la consola F12 si Firebase pide crear un Índice.");
    });

    return () => unsubRes();
  }, [selectedSpace]);

  // Lógica de Filtros para el Dropdown
  const filteredSpaces = spaces.filter(space => {
      const matchesType = filterType === 'TODOS' ? true : space.type?.toUpperCase() === filterType;
      const matchesSearch = space.name.toLowerCase().includes(displaySearch.toLowerCase());
      return matchesType && matchesSearch;
  });

  // Manejador al seleccionar un espacio de la lista
  const handleSelectSpace = (space) => {
    setSelectedSpace(space.id);
    setDisplaySearch(`${space.type?.toUpperCase() === 'AULA' ? '🏫' : '🔬'} ${space.name}`);
    setIsDropdownOpen(false);
  };

  const getHeatData = (day, hour) => {
    const slotStart = addHours(startOfDay(day), hour);
    const currentRes = reservations.find(res => slotStart >= res.start && slotStart < res.end);
    
    return {
        isOccupied: !!currentRes,
        cssClass: currentRes ? 'heat-high' : 'heat-none',
        resData: currentRes
    };
  };

  const days = eachDayOfInterval({
    start: startOfWeek(new Date(), { weekStartsOn: 1 }),
    end: endOfWeek(new Date(), { weekStartsOn: 1 })
  });

  return (
    <div className="heatmap-container fade-in">
      
      <div className="heatmap-top-bar">
        <Link to={`/dashboard?sede=${currentSede}`} className="back-link-radar">← Volver al Dashboard</Link>
      </div>

      <header className="heatmap-header">
        <h1>📊 Analítica de Ocupación (Heatmap)</h1>
        
        <div className="heatmap-advanced-controls">
            <div className="radar-tabs">
                <button className={filterType === "TODOS" ? "active" : ""} onClick={() => {setFilterType("TODOS"); setSelectedSpace(""); setDisplaySearch("");}}>TODOS</button>
                <button className={filterType === "AULA" ? "active" : ""} onClick={() => {setFilterType("AULA"); setSelectedSpace(""); setDisplaySearch("");}}>AULAS</button>
                <button className={filterType === "LABORATORIO" ? "active" : ""} onClick={() => {setFilterType("LABORATORIO"); setSelectedSpace(""); setDisplaySearch("");}}>LABS</button>
            </div>

            {/* COMBOBOX CUSTOM (Searchable Dropdown) */}
            <div className="search-select-combined" ref={dropdownRef}>
                <div className="search-input-wrapper custom-combobox">
                    <span className="search-icon">🔍</span>
                    <input 
                        type="text" 
                        placeholder={`Buscar en ${filterType.toLowerCase()}...`}
                        value={displaySearch}
                        onChange={(e) => {
                            setDisplaySearch(e.target.value);
                            setSelectedSpace(""); // Limpia el mapa si empieza a borrar/buscar
                            setIsDropdownOpen(true);
                        }}
                        onFocus={() => setIsDropdownOpen(true)}
                    />
                    {displaySearch && (
                        <button className="clear-search-btn" onClick={() => {
                            setDisplaySearch("");
                            setSelectedSpace("");
                            setIsDropdownOpen(true);
                        }}>✖</button>
                    )}
                </div>

                {isDropdownOpen && (
                    <ul className="custom-dropdown-list">
                        {filteredSpaces.length > 0 ? (
                            filteredSpaces.map(space => (
                                <li key={space.id} onClick={() => handleSelectSpace(space)}>
                                    {space.type?.toUpperCase() === 'AULA' ? '🏫' : '🔬'} {space.name}
                                </li>
                            ))
                        ) : (
                            <li className="no-results">No se encontraron espacios</li>
                        )}
                    </ul>
                )}
            </div>
        </div>
      </header>

      {selectedSpace ? (
        <div className="heatmap-grid-wrapper">
          <div className="heatmap-grid">
            <div className="time-column">
              <div className="hour-cell corner"></div>
              {HOURS.map(h => (
                <div key={h} className="hour-cell time-label">{h}:00</div>
              ))}
            </div>

            {days.map(day => (
              <div key={day.toString()} className="day-column">
                <div className="day-header">
                  <span className="day-name">{format(day, 'EEEE', { locale: es })}</span>
                  <span className="day-date">{format(day, 'dd MMM')}</span>
                </div>
                {HOURS.map(hour => {
                  const data = getHeatData(day, hour);
                  return (
                    <div key={hour} className={`hour-block ${data.cssClass}`}>
                        {data.isOccupied && (
                            <div className="heatmap-tooltip">
                                <div className="tt-title">{data.resData.className}</div>
                                <div className="tt-docente">👤 {data.resData.userName}</div>
                                <div className="tt-hora">⏱ {format(data.resData.start, 'HH:mm')} - {format(data.resData.end, 'HH:mm')}</div>
                            </div>
                        )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="heatmap-legend">
            <span>Libre</span>
            <div className="legend-bar"></div>
            <span>Ocupado</span>
          </div>
        </div>
      ) : (
        <div className="empty-heatmap">
            <h3>Seleccione un espacio del buscador</h3>
            <p>Escriba el número de aula o laboratorio para ver su ocupación en la sede {currentSede}.</p>
        </div>
      )}
    </div>
  );
}