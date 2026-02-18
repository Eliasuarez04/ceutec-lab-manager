// src/pages/Dashboard.js
import React from 'react';
import { Link, useSearchParams, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './styles/Dashboard.css';

export default function Dashboard() {
  const { userData } = useAuth();
  const [searchParams] = useSearchParams();
  
  // 1. Leemos la sede de la URL
  const currentSede = searchParams.get('sede');

  // 2. SI NO HAY SEDE EN LA URL, MANDAR AL SELECTOR (OBLIGATORIO PARA EVITAR ERRORES)
  if (!currentSede) {
    return <Navigate to="/seleccionar-sede" replace />;
  }

  // 3. Definimos permisos según el rol para mostrar/ocultar herramientas
  const isAdmin = userData?.role === 'superadmin';
  const isCoord = userData?.role === 'coordinador';
  const isLabCoord = userData?.role === 'coord_labs';
  const isAulaCoord = userData?.role === 'coord_aulas';
  
  // Acceso a la sección administrativa
  const hasManagementAccess = isAdmin || isCoord || isLabCoord || isAulaCoord;

  // Helper para codificar la sede y no repetir código en los Links
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

        {/* --- SECCIÓN 1: OPERACIONES (Visible para todos) --- */}
        <h2 className="section-title-dash">Reservas y Consultas</h2>
        <div className="teacher-card-grid">
          
          {/* Tarjeta Aulas */}
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

          {/* Tarjeta Laboratorios */}
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

          {/* Tarjeta Mis Reservas */}
          <Link to={`/mis-reservas?${sedeParam}`} className="teacher-card clickable-card">
            <div className="card-top">
              <div className="card-icon-wrapper bg-green">📋</div>
              <h3>Mis Reservas</h3>
              <p>Historial personal y seguimiento de tus solicitudes enviadas.</p>
            </div>
            <span className="card-cta">Ver mis registros &rarr;</span>
          </Link>

          {/* Tarjeta Mi Perfil */}
          <Link to={`/perfil?${sedeParam}`} className="teacher-card clickable-card">
            <div className="card-top">
              <div className="card-icon-wrapper bg-orange">👤</div>
              <h3>Mi Perfil</h3>
              <p>Configuración de cuenta, facultad y estadísticas de uso.</p>
            </div>
            <span className="card-cta">Ir al perfil &rarr;</span>
          </Link>
        </div>

        {/* --- SECCIÓN 2: ADMINISTRACIÓN (Condicional) --- */}
        {hasManagementAccess && (
          <>
            <h2 className="section-title-dash admin-section-title">Herramientas Administrativas</h2>
            <div className="teacher-card-grid admin-grid">
              
              {/* Opción: Gestión de Usuarios (Superadmin y Coordinadores Académicos) */}
              {(isAdmin || isCoord) && (
                <Link 
                  to={`/admin/usuarios?${sedeParam}`} 
                  className="teacher-card management-card"
                >
                  <div className="card-top">
                    <div className="card-icon-wrapper bg-dark">👥</div>
                    <h3>Gestión de Usuarios</h3>
                    <p>Aprobar nuevos docentes de la facultad {userData?.faculty}.</p>
                  </div>
                  <span className="card-cta">Entrar a Aprobaciones &rarr;</span>
                </Link>
              )}

              {/* Opción: Infraestructura (Superadmin, Coord Labs, Coord Aulas) */}
              {(isAdmin || isLabCoord || isAulaCoord) && (
                <Link 
                  to={`/admin/inventario?${sedeParam}`} 
                  className="teacher-card management-card"
                >
                  <div className="card-top">
                    <div className="card-icon-wrapper bg-dark">⚙️</div>
                    <h3>Infraestructura</h3>
                    <p>Configurar aulas, laboratorios e inventario de {currentSede}.</p>
                  </div>
                  <span className="card-cta">Gestionar Espacios &rarr;</span>
                </Link>
              )}

              {/* Opción: Reportes (Visible para todos los administrativos) */}
              <Link 
                to={`/reportes?${sedeParam}`} 
                className="teacher-card management-card"
              >
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