// src/pages/Dashboard.js
import React, { useState, useEffect } from 'react';
import { Link, useSearchParams, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebaseConfig';
import { collection, query, where, onSnapshot, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import './styles/Dashboard.css';
import QRScanner from '../components/QRScanner';
import Modal from '../components/Modal';

export default function Dashboard() {
  const { userData } = useAuth();
  const [searchParams] = useSearchParams();
  const currentSede = searchParams.get('sede');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [activeRes, setActiveRes] = useState(null);

  // 1. EFECTO: Tracker Proactivo de Clase Actual (V2.3)
  useEffect(() => {
    if (!userData?.uid || !currentSede) return;
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
        const windowStart = new Date(start.getTime() - 20 * 60000); 
        return now >= windowStart && now <= end;
      });
      setActiveRes(current);
    });
    return () => unsub();
  }, [userData, currentSede]);

  // 2. LÓGICA: Registro de Asistencia (V2.3 / V2.4)
  const handleQuickCheck = async (type) => {
    try {
      const resRef = doc(db, 'reservations', activeRes.id);
      if (type === 'checkin') {
        await updateDoc(resRef, { checkInTime: Timestamp.now(), fulfillmentStatus: 'En Progreso' });
        toast.success("¡Bienvenido! Clase iniciada.");
      } else {
        await updateDoc(resRef, { checkOutTime: Timestamp.now(), fulfillmentStatus: 'Completada' });
        toast.success("Espacio liberado correctamente.");
      }
    } catch (e) { toast.error("Error en la operación."); }
  };

  const handleScanComplete = async (decodedText) => {
    if (decodedText === activeRes.labId) {
      setIsScannerOpen(false);
      try {
        const resRef = doc(db, 'reservations', activeRes.id);
        await updateDoc(resRef, { 
          checkInTime: Timestamp.now(), 
          fulfillmentStatus: 'En Progreso', 
          verificationMethod: 'QR_Room_Static' 
        });
        toast.success(`¡Presencia confirmada en ${activeRes.labName}!`);
      } catch (e) { toast.error("Error al registrar entrada."); }
    } else {
      toast.error("⚠️ Error: El código QR no corresponde a este salón.");
    }
  };

  if (!currentSede) return <Navigate to="/seleccionar-sede" replace />;

  // --- MATRIZ DE PERMISOS V2.4 (Blindada) ---
  const role = userData?.role;
  const isAdmin = role === 'superadmin';
  const isAcademic = role === 'coordinador';
  const isLabCoord = role === 'coord_labs';
  const isAulaCoord = role === 'coord_aulas';
  const isIT = role === 'it_staff';
  const isGlobalStaff = role === 'admin_staff';

  const hasManagementAccess = isAdmin || isAcademic || isLabCoord || isAulaCoord || isIT || isGlobalStaff;
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
                <Link to="/seleccionar-sede" className="btn-change-sede-new">📍 Cambiar de Sede</Link>
            </div>
        </div>

        {/* --- TRACKER DE ACCIÓN RÁPIDA --- */}
        {activeRes && (
          <div className={`active-class-tracker-card ${activeRes.checkInTime ? 'in-progress' : 'upcoming'}`}>
            <div className="tracker-header">
                <span className="live-badge">● EN VIVO</span>
                <p>{activeRes.checkInTime ? 'Clase actualmente activa' : 'Tu clase está por iniciar'}</p>
            </div>
            <div className="tracker-body">
                <div className="res-info">
                    <h2>{activeRes.labName}</h2>
                    <h3>{activeRes.className}</h3>
                    <p>⏱ {format(activeRes.startTime.toDate(), 'HH:mm')} - {format(activeRes.endTime.toDate(), 'HH:mm')}</p>
                </div>
                <div className="res-actions">
                    {!activeRes.checkInTime ? (
                        <button className="btn-tracker-checkin" onClick={() => setIsScannerOpen(true)}>
                           📷 Escanear QR para Iniciar
                        </button>
                    ) : (
                        <button className="btn-tracker-checkout" onClick={() => handleQuickCheck('checkout')}>
                           🏁 Finalizar Clase
                        </button>
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
              <p>Consulta y reserva espacios teóricos en {currentSede}.</p>
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
              <p>Talleres técnicos y especializados en {currentSede}.</p>
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
              <p>Historial y seguimiento de tus solicitudes personales.</p>
            </div>
            <span className="card-cta">Ver mis registros &rarr;</span>
          </Link>

          <Link to={`/perfil?${sedeParam}`} className="teacher-card clickable-card">
            <div className="card-top">
              <div className="card-icon-wrapper bg-orange">👤</div>
              <h3>Mi Perfil</h3>
              <p>Configuración de cuenta, ciudad base y facultad.</p>
            </div>
            <span className="card-cta">Ir al perfil &rarr;</span>
          </Link>
        </div>

        {/* --- SECCIÓN 2: ADMINISTRACIÓN --- */}
        {hasManagementAccess && (
          <>
            <h2 className="section-title-dash admin-section-title">Herramientas Administrativas</h2>
            <div className="teacher-card-grid admin-grid">
              
              <Link to={`/admin/live-status?${sedeParam}`} className="teacher-card management-card">
                <div className="card-top">
                  <div className="card-icon-wrapper bg-dark">📡</div>
                  <h3>Monitor en Vivo</h3>
                  <p>Radar de ocupación y asistencia real en {currentSede}.</p>
                </div>
                <span className="card-cta">Ver Radar &rarr;</span>
              </Link>

              {/* MAPA DE CALOR NUEVO */}
              {(isAdmin || isAulaCoord) && (
                <Link to={`/admin/mapa-calor?${sedeParam}`} className="teacher-card management-card">
                  <div className="card-top">
                    <div className="card-icon-wrapper bg-purple">🗺️</div>
                    <h3>Mapa de Calor</h3>
                    <p>Visualiza la saturación de espacios por semana.</p>
                  </div>
                  <span className="card-cta">Ver Heatmap &rarr;</span>
                </Link>
              )}

              {(isAdmin) && (
                <Link to={`/admin/usuarios?${sedeParam}`} className="teacher-card management-card">
                  <div className="card-top">
                    <div className="card-icon-wrapper bg-dark">👥</div>
                    <h3>Gestión de Usuarios</h3>
                    <p>Aprobación de docentes y roles académicos.</p>
                  </div>
                  <span className="card-cta">Administrar &rarr;</span>
                </Link>
              )}

              {(isAdmin || isLabCoord || isAulaCoord) && (
                <Link to={`/admin/inventario?${sedeParam}`} className="teacher-card management-card">
                  <div className="card-top">
                    <div className="card-icon-wrapper bg-dark">⚙️</div>
                    <h3>Infraestructura</h3>
                    <p>Gestionar {isLabCoord ? 'Laboratorios' : isAulaCoord ? 'Aulas' : 'Espacios'} y QR.</p>
                  </div>
                  <span className="card-cta">Gestionar &rarr;</span>
                </Link>
              )}

              {(isAdmin || isIT || isLabCoord) && (
                <Link to={`/admin/soporte-tecnico?${sedeParam}`} className="teacher-card management-card">
                  <div className="card-top">
                    <div className="card-icon-wrapper bg-orange">🛠️</div>
                    <h3>Soporte Técnico</h3>
                    <p>Atender reportes de fallas técnicas en {currentSede}.</p>
                  </div>
                  <span className="card-cta">Ver Tickets &rarr;</span>
                </Link>
              )}

              {(isAdmin || isGlobalStaff || isAcademic || isIT) && (
                <Link to={`/admin/analitica?${sedeParam}`} className="teacher-card management-card">
                  <div className="card-top">
                    <div className="card-icon-wrapper bg-blue">📈</div>
                    <h3>Analítica Ejecutiva</h3>
                    <p>Métricas de uso, puntualidad y eficiencia del campus.</p>
                  </div>
                  <span className="card-cta">Ver KPIs &rarr;</span>
                </Link>
              )}

              <Link to={`/reportes?${sedeParam}`} className="teacher-card management-card">
                <div className="card-top">
                  <div className="card-icon-wrapper bg-dark">📊</div>
                  <h3>Reportes Globales</h3>
                  <p>Historial completo y exportación de datos de {currentSede}.</p>
                </div>
                <span className="card-cta">Ir a Reportes &rarr;</span>
              </Link>

            </div>
          </>
        )}
      </div>

      <Modal isOpen={isScannerOpen} onClose={() => setIsScannerOpen(false)} title="Validación Física de Presencia">
          <QRScanner 
            targetRoomName={activeRes?.labName} 
            onScanSuccess={handleScanComplete} 
            onScanError={(err) => console.log(err)} 
          />
      </Modal>
    </div>
  );
}