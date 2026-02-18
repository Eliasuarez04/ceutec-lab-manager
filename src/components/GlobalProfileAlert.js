// src/components/GlobalProfileAlert.js
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './styles/GlobalProfileAlert.css'; // Crearemos este CSS abajo

export default function GlobalProfileAlert() {
  const { userData, loading } = useAuth();
  const location = useLocation();

  if (loading || !userData) return null;

  // Verificar si faltan campos críticos
  const missingCity = !userData.city;
  const missingTH = !userData.th;
  const missingFaculty = !userData.faculty;

  const isProfileIncomplete = missingCity || missingTH || missingFaculty;

  // Si el perfil está completo, o si ya estamos en la página de perfil, no mostramos la alerta
  if (!isProfileIncomplete || location.pathname === '/perfil') {
    return null;
  }

  return (
    <div className="global-alert-banner">
      <div className="alert-content">
        <span className="alert-icon">⚠️</span>
        <div className="alert-text">
          <strong>Acción Requerida:</strong> Para realizar reservas, debes completar tu 
          {missingCity && " Ciudad,"} {missingTH && " No. Empleado,"} {missingFaculty && " Facultad"}.
        </div>
        <Link 
          to={`/perfil?sede=${userData.sede || ''}`} 
          className="alert-button"
        >
          Completar Perfil Ahora →
        </Link>
      </div>
    </div>
  );
}