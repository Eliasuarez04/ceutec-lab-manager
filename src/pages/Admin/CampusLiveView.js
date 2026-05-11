// src/pages/Admin/CampusLiveView.js
import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, doc, updateDoc, Timestamp, query, where } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { useSearchParams, Link } from 'react-router-dom';
import { format, isWithinInterval, isAfter, startOfDay, endOfDay } from 'date-fns';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import '../styles/CampusLiveView.css';

const MySwal = withReactContent(Swal);

export default function CampusLiveView() {
  const { userData } = useAuth(); 
  const [searchParams] = useSearchParams();
  const currentSede = searchParams.get('sede') || "";
  const [spaces, setSpaces] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [now, setNow] = useState(new Date());

  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("TODOS");

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!currentSede) return;
    const searchTarget = currentSede.toLowerCase().replace('ceutec', '').replace(/[()]/g, '').trim();

    // 1. Obtener los espacios (aulas y labs)
    const unsubSpaces = onSnapshot(collection(db, 'spaces'), (snap) => {
      setSpaces(snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .filter(s => {
          const sSede = (s.sede || s.campus || "").toLowerCase();
          return sSede.includes(searchTarget) || searchTarget.includes(sSede);
        }));
    });

    // 2. 🔥 CÓDIGO OPTIMIZADO PARA AHORRAR LECTURAS EN FIREBASE 🔥
    const hoyI = Timestamp.fromDate(startOfDay(new Date()));
    const hoyF = Timestamp.fromDate(endOfDay(new Date()));

    const qRes = query(
      collection(db, 'reservations'),
      where('startTime', '>=', hoyI),
      where('startTime', '<=', hoyF)
    );

    const unsubRes = onSnapshot(qRes, (snap) => {
      setReservations(snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .filter(r => {
          const rSede = (r.sede || "").toLowerCase();
          // La base de datos ya filtró la fecha, solo filtramos la ciudad en el navegador
          return (rSede.includes(searchTarget) || searchTarget.includes(rSede));
        }));
    });

    return () => { unsubSpaces(); unsubRes(); };
  }, [currentSede]);

  // 🔥 VALIDACIÓN CORREGIDA: Exclusiva para Coord. de Aulas y por Ciudad Estricta 🔥
  const canManageAttendance = () => {
    if (!userData) return false;
    if (userData.role === 'superadmin') return true;

    // 1. Exclusividad de Rol: Solo el coordinador de aulas hace el recorrido
    if (userData.role !== 'coord_aulas') return false;

    // 2. Validación Estricta de Ciudad
    const userCity = (userData.city || "").toLowerCase().trim();
    const currentSedeLower = currentSede.toLowerCase().trim();

    if (userCity.includes('san pedro') || userCity.includes('sps') || userCity.includes('pedro')) {
        if (currentSedeLower.includes('sps') || currentSedeLower.includes('norte') || currentSedeLower.includes('central') || currentSedeLower.includes('pedro')) return true;
    } else if (userCity.includes('tegucigalpa') || userCity.includes('tgu')) {
        if (currentSedeLower.includes('tgu') || currentSedeLower.includes('prado') || currentSedeLower.includes('centro') || currentSedeLower.includes('tegucigalpa')) return true;
    } else if (userCity.includes('ceiba') || userCity.includes('lce')) {
        if (currentSedeLower.includes('lce') || currentSedeLower.includes('ceiba')) return true;
    }

    return false;
  };

  const handleAdminRelease = async (resId, labName) => {
    const { isConfirmed } = await MySwal.fire({
      title: `¿Liberar ${labName}?`,
      text: "La clase actual se marcará como completada y desaparecerá del monitor.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#c8102e',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, liberar espacio',
      cancelButtonText: 'Cancelar',
      borderRadius: '12px'
    });

    if (!isConfirmed) return;

    try {
      await updateDoc(doc(db, 'reservations', resId), { 
        checkOutTime: Timestamp.now(), 
        fulfillmentStatus: 'Completada (Admin)' 
      });
      toast.success("Espacio liberado con éxito.");
    } catch (e) { 
      toast.error("Error al liberar espacio."); 
    }
  };

  const handleMarkAttendance = async (res, status) => {
    let reason = "N/A";

    if (status === 'Ausente') {
      const { value: text, isDismissed } = await MySwal.fire({
        title: 'Reportar Inasistencia',
        input: 'textarea',
        inputLabel: `Motivo de ausencia del docente ${res.userName}:`,
        inputPlaceholder: 'Ej: Aula cerrada, Reportó tráfico, etc.',
        showCancelButton: true,
        confirmButtonColor: '#c8102e',
        confirmButtonText: 'Guardar Reporte',
        cancelButtonText: 'Cancelar'
      });

      if (isDismissed) return;
      if (!text) return toast.error("Debes ingresar un motivo para justificar la inasistencia.");
      reason = text;
    }

    const toastId = toast.loading("Guardando registro...");

    try {
      const resRef = doc(db, 'reservations', res.id);
      
      await updateDoc(resRef, {
        attendance: {
          status: status,
          markedAt: Timestamp.now(),
          markedBy: userData?.name || userData?.email || "Admin",
          markedById: userData?.uid || "N/A", 
          reason: reason
        },
        fulfillmentStatus: status === 'Presente' ? 'Completada' : 'No asistió',
        checkInTime: status === 'Presente' ? Timestamp.now() : null 
      });

      toast.success(`Registro exitoso: ${status}`, { id: toastId });
    } catch (error) {
      console.error(error);
      toast.error("Error al guardar asistencia", { id: toastId });
    }
  };

  const liveStatus = useMemo(() => {
    const baseList = spaces.map(space => {
      const todayRes = reservations
        .filter(res => res.labId === space.id && !res.checkOutTime)
        .sort((a, b) => a.startTime - b.startTime);
      
      const currentRes = todayRes.find(res => isWithinInterval(now, { start: res.startTime.toDate(), end: res.endTime.toDate() }));
      const nextRes = todayRes.filter(res => isAfter(res.startTime.toDate(), now) && res.id !== currentRes?.id);

      let visualState = 'free';
      if (space.status === 'En Mantenimiento') visualState = 'maint';
      else if (currentRes) {
        if (currentRes.attendance?.status === 'Presente' || currentRes.checkInTime) {
          visualState = 'active'; 
        } else if (currentRes.attendance?.status === 'Ausente') {
          visualState = 'late'; 
        } else {
          visualState = 'waiting'; 
        }
      }
      return { ...space, currentRes, nextRes, visualState };
    });

    return baseList
      .filter(item => {
        let matchesTab = false;
        if (filterType === "TODOS") matchesTab = true;
        else if (filterType === "AULA") matchesTab = item.type?.toUpperCase() === "AULA";
        else if (filterType === "LABORATORIO") matchesTab = item.type?.toUpperCase() === "LABORATORIO";
        else if (filterType === "PENDIENTES") matchesTab = item.currentRes && !item.currentRes.attendance;

        const matchesSearch = item.name?.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesTab && matchesSearch;
      })
      .sort((a, b) => a.name.localeCompare(b.name, undefined, {numeric: true}));
  }, [spaces, reservations, now, filterType, searchTerm]);

  return (
    <div className="dashboard-wrapper">
      <div className="radar-container-glass fade-in">
        <header className="radar-header-pro">
          <div className="radar-title-area">
            <Link to={`/dashboard?sede=${currentSede}`} className="back-link-radar">← Dashboard</Link>
            <h1>Monitor Operativo: <span className="red-text">{currentSede}</span></h1>
            <p>V2.5.3 - Control de Asistencia Exclusivo</p>
          </div>
          <div className="radar-clock-box">
             <div className="digital-time">{format(now, "HH:mm:ss")}</div>
             <div className="digital-date">{format(now, "dd MMM yyyy")}</div>
          </div>
        </header>

        <div className="radar-filters-bar">
            <div className="radar-tabs">
                <button className={filterType === "TODOS" ? "active" : ""} onClick={() => setFilterType("TODOS")}>TODOS</button>
                <button className={filterType === "AULA" ? "active" : ""} onClick={() => setFilterType("AULA")}>AULAS</button>
                <button className={filterType === "LABORATORIO" ? "active" : ""} onClick={() => setFilterType("LABORATORIO")}>LABS</button>
                <button 
                  className={filterType === "PENDIENTES" ? "active" : ""} 
                  onClick={() => setFilterType("PENDIENTES")}
                  style={{ color: filterType === "PENDIENTES" ? 'white' : '#c8102e', borderColor: '#c8102e' }}
                >
                  ⏳ PENDIENTES
                </button>
            </div>
            
            <div className="radar-search-input-wrapper">
                <span className="search-icon-radar">🔍</span>
                <input 
                    type="text" 
                    placeholder="Buscar salón por nombre..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
        </div>

        <div className="radar-legend-bar">
            <div className="leg-item"><span className="dot bg-free"></span> Disponible</div>
            <div className="leg-item"><span className="dot bg-waiting"></span> Pendiente Revisión</div>
            <div className="leg-item"><span className="dot bg-active pulse"></span> Ocupada (Llegó)</div>
            <div className="leg-item"><span className="dot bg-late"></span> Ausente Confirmado</div>
        </div>

        <div className="radar-grid-layout">
          {liveStatus.length === 0 ? (
            <div className="radar-empty-state">
              <span className="icon">📡</span>
              <p>No se encontraron resultados para tu búsqueda o filtro actual.</p>
            </div>
          ) : (
            liveStatus.map(item => (
              <div key={item.id} className={`radar-card-pro ${item.visualState}`}>
                <div className="card-top-pro">
                  <span className="tag-type">{item.type}</span>
                  <span className="tag-cap">👥 {item.capacity}</span>
                </div>
                <h2 className="room-name-pro">{item.name}</h2>
                
                <div className="card-status-info">
                  {item.visualState === 'free' && <div className="msg-free">✅ DISPONIBLE</div>}
                  {item.currentRes && (
                    <div className="active-res-box">
                      <div className={`type-badge-mini ${item.currentRes.reservationType}`}>
                        {item.currentRes.reservationType === 'academic_load' ? '📚 CARGA' : '👤 MANUAL'}
                      </div>
                      <p className="c-name">{item.currentRes.className}</p>
                      <p className="d-name">{item.currentRes.userName}</p>
                      <p className="t-range">{format(item.currentRes.startTime.toDate(), 'HH:mm')} - {format(item.currentRes.endTime.toDate(), 'HH:mm')}</p>
                      
                      {/* 🔥 AHORA VALIDAMOS SOLO EL ROL Y LA CIUDAD, NO EL TIPO DE AULA 🔥 */}
                      {canManageAttendance() && (
                        <>
                          {!item.currentRes.attendance ? (
                              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                                  <button 
                                      onClick={() => handleMarkAttendance(item.currentRes, 'Presente')} 
                                      style={{ flex: 1, background: '#22c55e', color: 'white', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}
                                  >
                                      ✅ Llegó
                                  </button>
                                  <button 
                                      onClick={() => handleMarkAttendance(item.currentRes, 'Ausente')} 
                                      style={{ flex: 1, background: '#ef4444', color: 'white', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}
                                  >
                                      ❌ Ausente
                                  </button>
                              </div>
                          ) : (
                              <div style={{ 
                                  marginTop: '12px', padding: '10px', borderRadius: '6px', 
                                  background: item.currentRes.attendance.status === 'Presente' ? '#dcfce7' : '#fee2e2', 
                                  color: item.currentRes.attendance.status === 'Presente' ? '#166534' : '#991b1b', 
                                  textAlign: 'center', border: `1px solid ${item.currentRes.attendance.status === 'Presente' ? '#bbf7d0' : '#fecaca'}` 
                              }}>
                                  <div style={{ fontWeight: '900', fontSize: '0.85rem' }}>
                                      {item.currentRes.attendance.status === 'Presente' ? '✅ DOCENTE PRESENTE' : '❌ REPORTADO AUSENTE'}
                                  </div>
                                  <div style={{ fontSize: '0.75rem', marginTop: '4px', opacity: 0.8, fontWeight: 'bold' }}>
                                      Revisado por: {item.currentRes.attendance.markedBy.split(' ')[0]}
                                  </div>
                              </div>
                          )}

                          <button onClick={() => handleAdminRelease(item.currentRes.id, item.name)} className="btn-admin-release">
                             LIBERAR ESPACIO
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
                
                <div className="upcoming-list-pro">
                  <p className="upcoming-label">SIGUIENTES:</p>
                  {item.nextRes.slice(0, 2).map((res, i) => (
                    <div key={i} className="next-item">
                      <span className="n-time">{format(res.startTime.toDate(), 'HH:mm')}</span>
                      <span className="n-title">{res.className}</span>
                    </div>
                  ))}
                  {item.nextRes.length === 0 && <div className="next-item"><span className="n-title" style={{color: '#94a3b8'}}>Sin clases próximas</span></div>}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}