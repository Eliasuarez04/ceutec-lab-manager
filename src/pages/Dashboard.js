// src/pages/Dashboard.js
import React, { useState, useEffect } from 'react';
import { Link, useSearchParams, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebaseConfig';
import { collection, query, where, onSnapshot, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import './styles/Dashboard.css';

export default function Dashboard() {
  const { userData } = useAuth();
  const [searchParams] = useSearchParams();
  const currentSede = searchParams.get('sede');
  
  // Estados para v2.3
  const [activeRes, setActiveRes] = useState(null);

  // 1. REGLA DE HOOKS: Los efectos siempre van al inicio
  useEffect(() => {
    if (!userData?.uid || !currentSede) return;

    // Tracker proactivo: Busca clases del usuario que estén por iniciar o activas
    const q = query(
      collection(db, 'reservations'),
      where('userId', '==', userData.uid),
      where('fulfillmentStatus', 'in', ['Pendiente', 'En Progreso'])
    );

    const unsub = onSnapshot(q, (snap) => {
      const now = new Date();
      const current = snap.docs.map(d => ({ id: d.id, ...d.data() })).find(res => {
        const start = res.startTime.toDate();
        const end = res.endTime.toDate();
        // Visible desde 20 min antes hasta el final de la clase
        const windowStart = new Date(start.getTime() - 20 * 60000); 
        return now >= windowStart && now <= end;
      });
      setActiveRes(current);
    });

    return () => unsub();
  }, [userData, currentSede]);

  // Manejador de Check-in / Check-out rápido (v2.3)
  const handleQuickCheck = async (type) => {
    try {
      const resRef = doc(db, 'reservations', activeRes.id);
      if (type === 'checkin') {
        await updateDoc(resRef, { 
          checkInTime: Timestamp.now(), 
          fulfillmentStatus: 'En Progreso' 
        });
        toast.success("¡Bienvenido! Clase iniciada correctamente.");
      } else {
        await updateDoc(resRef, { 
          checkOutTime: Timestamp.now(), 
          fulfillmentStatus: 'Completada' 
        });
        toast.success("Clase finalizada. El espacio ha sido liberado.");
      }
    } catch (e) { 
        console.error(e);
        toast.error("Error al procesar el cambio de estado."); 
    }
  };

  // 2. SI NO HAY SEDE EN LA URL, MANDAR AL SELECTOR (Obligatorio)
  if (!currentSede) {
    return <Navigate to="/seleccionar-sede" replace />;
  }

  // Permisos según el rol
  const isAdmin = userData?.role === 'superadmin';
  const isCoord = userData?.role === 'coordinador';
  const isLabCoord = userData?.role === 'coord_labs';
  const isAulaCoord = userData?.role === 'coord_aulas';
  const hasManagementAccess = isAdmin || isCoord || isLabCoord || isAulaCoord;

  const sedeParam = `sede=${encodeURIComponent(currentSede)}`;

  return (
    <div className="dashboard-wrapper">
      <div className="teacher-dashboard-container fade-in">
        
        {/* HERO SECCIÓN */}
        <div className="dashboard-hero">
            <div className="hero-content-wrapper">
                <div className="hero-text-side">
                    <h1>{hasManagementAccess ? 'Panel de Gestión' : 'Mi Portal'} - {currentSede}</h1>
                    <p>Bienvenido, <strong>{userData?.displayName || userData?.email.split('@')[0]}</strong>.</p>
                </div>
                <div className="hero-action-side">
                    <Link to="/seleccionar-sede" className="btn-change-sede-new">
                       <span className="icon">📍</span> Cambiar de Sede
                    </Link>
                </div>
            </div>
        </div>

        {/* --- TRACKER DE CLASE ACTUAL (v2.3) --- */}
        {activeRes && (
          <div className={`active-class-tracker-card ${activeRes.checkInTime ? 'in-progress' : 'upcoming'}`}>
            <div className="tracker-header">
                <span className="live-badge">● EN VIVO</span>
                <p>{activeRes.checkInTime ? 'Tu clase está activa ahora' : 'Tu clase está por iniciar'}</p>
            </div>
            <div className="tracker-body">
                <div className="res-info">
                    <h2>{activeRes.labName}</h2>
                    <h3>{activeRes.className}</h3>
                    <p>⏱ {format(activeRes.startTime.toDate(), 'HH:mm')} - {format(activeRes.endTime.toDate(), 'HH:mm')}</p>
                </div>
                <div className="res-actions">
                    {!activeRes.checkInTime ? (
                        <button className="btn-tracker-checkin" onClick={() => handleQuickCheck('checkin')}>▶ Iniciar Clase</button>
                    ) : (
                        <button className="btn-tracker-checkout" onClick={() => handleQuickCheck('checkout')}>🏁 Finalizar Clase</button>
                    )}
                </div>
            </div>
          </div>
        )}

        {/* --- SECCIÓN 1: OPERACIONES --- */}
        <h2 className="section-title-dash">Reservas y Consultas</h2>
        <div className="teacher-card-grid">
          
          <div className="teacher-card">
            <div className="card-top">
              <div className="card-icon-wrapper bg-blue">🏫</div>
              <h3>Aulas Teóricas</h3>
              <p>Visualiza y reserva espacios para clases en {currentSede}.</p>
            </div>
            <div className="card-actions-row">
               <Link to={`/espacios?tipo=Aula&${sedeParam}`} className="btn-secondary-card">Ver Todas</Link>
               <Link to={`/reservas?tipo=Aula&${sedeParam}`} className="btn-primary-card">Reservar</Link>
            </div>
          </div>

          <div className="teacher-card">
            <div className="card-top">
              <div className="card-icon-wrapper bg-purple">🔬</div>
              <h3>Laboratorios</h3>
              <p>Acceso a laboratorios técnicos y especializados en {currentSede}.</p>
            </div>
            <div className="card-actions-row">
               <Link to={`/espacios?tipo=Laboratorio&${sedeParam}`} className="btn-secondary-card">Ver Todos</Link>
               <Link to={`/reservas?tipo=Laboratorio&${sedeParam}`} className="btn-primary-card">Reservar</Link>
            </div>
          </div>

          <Link to={`/mis-reservas?${sedeParam}`} className="teacher-card clickable-card">
            <div className="card-top">
              <div className="card-icon-wrapper bg-green">📋</div>
              <h3>Mis Reservas</h3>
              <p>Historial personal y seguimiento de tus solicitudes enviadas.</p>
            </div>
            <span className="card-cta">Ver mis registros &rarr;</span>
          </Link>

          <Link to={`/perfil?${sedeParam}`} className="teacher-card clickable-card">
            <div className="card-top">
              <div className="card-icon-wrapper bg-orange">👤</div>
              <h3>Mi Perfil</h3>
              <p>Configuración de cuenta, facultad y estadísticas de uso.</p>
            </div>
            <span className="card-cta">Ir al perfil &rarr;</span>
          </Link>
        </div>

        {/* --- SECCIÓN 2: ADMINISTRACIÓN --- */}
        {hasManagementAccess && (
          <>
            <h2 className="section-title-dash admin-section-title">Herramientas Administrativas</h2>
            <div className="teacher-card-grid admin-grid">
              
              {/* Monitor en Vivo (Radar Central) */}
              <Link to={`/admin/live-status?${sedeParam}`} className="teacher-card management-card live-monitor-card">
                <div className="card-top">
                  <div className="card-icon-wrapper bg-dark">📡</div>
                  <h3>Monitor en Vivo</h3>
                  <p>Estado de ocupación y asistencia en tiempo real de {currentSede}.</p>
                </div>
                <span className="card-cta">Ver radar central &rarr;</span>
              </Link>

              {(isAdmin || isCoord) && (
                <Link to={`/admin/usuarios?${sedeParam}`} className="teacher-card management-card">
                  <div className="card-top">
                    <div className="card-icon-wrapper bg-dark">👥</div>
                    <h3>Gestión de Usuarios</h3>
                    <p>Aprobar docentes y roles de la facultad {userData?.faculty}.</p>
                  </div>
                  <span className="card-cta">Administrar &rarr;</span>
                </Link>
              )}

              {(isAdmin || isLabCoord || isAulaCoord) && (
                <Link to={`/admin/inventario?${sedeParam}`} className="teacher-card management-card">
                  <div className="card-top">
                    <div className="card-icon-wrapper bg-dark">⚙️</div>
                    <h3>Infraestructura</h3>
                    <p>Configurar aulas, laboratorios e inventario de {currentSede}.</p>
                  </div>
                  <span className="card-cta">Gestionar Espacios &rarr;</span>
                </Link>
              )}

              <Link to={`/reportes?${sedeParam}`} className="teacher-card management-card">
                <div className="card-top">
                  <div className="card-icon-wrapper bg-dark">📊</div>
                  <h3>Reportes Globales</h3>
                  <p>Estadísticas de uso y ocupación de recursos en {currentSede}.</p>
                </div>
                <span className="card-cta">Ver Reportes &rarr;</span>
              </Link>

            </div>
          </>
        )}
      </div>
    </div>
  );
}