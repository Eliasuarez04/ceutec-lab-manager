// src/pages/Dashboard.js
import React from 'react';
import { Link, useSearchParams, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './styles/Dashboard.css';

export default function Dashboard() {
  const { userData } = useAuth();
  const [searchParams] = useSearchParams();
  
  // Leemos la sede de la URL
  const currentSede = searchParams.get('sede');

  // SI NO HAY SEDE EN LA URL, MANDAR AL SELECTOR (OBLIGATORIO)
  if (!currentSede) {
    return <Navigate to="/seleccionar-sede" replace />;
  }

  // --- VISTA PARA ADMINISTRADORES / COORDINADORES ---
  if (userData?.role === 'superadmin' || userData?.role.includes('coord')) {
    return (
      <div className="dashboard-wrapper">
         <div className="dashboard-hero">
            <div className="hero-content-wrapper">
                <div className="hero-text-side">
                    <h1>Panel Administrativo 🛡️</h1>
                    <p>Gestionando recursos globales en: <strong>{currentSede}</strong></p>
                </div>
                <div className="hero-action-side">
                    <Link to="/seleccionar-sede" className="btn-change-sede-new">
                       <span className="icon">📍</span> Cambiar Sede
                    </Link>
                </div>
            </div>
         </div>
         
         <div className="admin-placeholder-grid">
            <div className="teacher-card">
                <h3>Gestión Global</h3>
                <p>Accede a las herramientas de administración para {currentSede}.</p>
                <div className="card-actions-row">
                    <Link to="/admin/usuarios" className="btn-secondary-card">Usuarios</Link>
                    <Link to="/reportes" className="btn-primary-card">Reportes</Link>
                </div>
            </div>
         </div>
      </div>
    );
  }

  // --- VISTA PARA DOCENTES ---
  return (
    <div className="dashboard-wrapper">
      <div className="teacher-dashboard-container fade-in">
        
        <div className="dashboard-hero">
            <div className="hero-content-wrapper">
                <div className="hero-text-side">
                    <h1>Gestionando: {currentSede}</h1>
                    <p>Selecciona una categoría para comenzar tu reserva.</p>
                </div>
                <div className="hero-action-side">
                    <Link to="/seleccionar-sede" className="btn-change-sede-new">
                       <span className="icon">📍</span> Cambiar de Sede
                    </Link>
                </div>
            </div>
        </div>

        <div className="teacher-card-grid">
          <div className="teacher-card">
            <div className="card-top">
              <div className="card-icon-wrapper bg-blue">🏫</div>
              <h3>Aulas Teóricas</h3>
              <p>Espacios para clases magistrales en {currentSede}.</p>
            </div>
            <div className="card-actions-row">
               <Link to={`/espacios?tipo=Aula&sede=${currentSede}`} className="btn-secondary-card">Ver Todas</Link>
               <Link to={`/reservas?tipo=Aula&sede=${currentSede}`} className="btn-primary-card">Reservar Aula</Link>
            </div>
          </div>

          <div className="teacher-card">
            <div className="card-top">
              <div className="card-icon-wrapper bg-purple">🔬</div>
              <h3>Laboratorios</h3>
              <p>Espacios técnicos en {currentSede}.</p>
            </div>
            <div className="card-actions-row">
               <Link to={`/espacios?tipo=Laboratorio&sede=${currentSede}`} className="btn-secondary-card">Ver Todos</Link>
               <Link to={`/reservas?tipo=Laboratorio&sede=${currentSede}`} className="btn-primary-card">Reservar Lab</Link>
            </div>
          </div>

          <Link to={`/mis-reservas?sede=${currentSede}`} className="teacher-card clickable-card">
            <div className="card-top">
              <div className="card-icon-wrapper bg-green">📋</div>
              <h3>Mis Reservas</h3>
              <p>Historial y seguimiento de tus solicitudes en esta sede.</p>
            </div>
            <span className="card-cta">Ver mis registros &rarr;</span>
          </Link>

          <Link to={`/perfil?sede=${currentSede}`} className="teacher-card clickable-card">
            <div className="card-top">
              <div className="card-icon-wrapper bg-orange">👤</div>
              <h3>Mi Perfil</h3>
              <p>Configuración y estadísticas de uso del portal.</p>
            </div>
            <span className="card-cta">Ir al perfil &rarr;</span>
          </Link>
        </div>
      </div>
    </div>
  );
}