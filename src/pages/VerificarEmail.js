// src/pages/VerificarEmail.js
import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import './styles/VerificarEmail.css';

export default function VerificarEmail() {
  const { userData, currentUser, logout, loading } = useAuth();
  const navigate = useNavigate();

  const handleBackToLogin = async () => {
    await logout();
    navigate('/login');
  };

  // --- LÓGICA DE DETECCIÓN ROBUSTA ---
  // 1. Si todavía está cargando el AuthContext, no mostramos nada erróneo
  if (loading) return <div className="auth-body"><h1>Cargando...</h1></div>;

  // 2. Detectamos por el correo actual (que siempre está disponible en currentUser)
  const userEmail = currentUser?.email || "";
  const isDocenteDomain = userEmail.toLowerCase().endsWith('@unitec.edu');
  const isStaffDomain = userEmail.toLowerCase().endsWith('@unitec.edu.hn');

  // Un docente está pendiente si tiene el dominio .edu Y (aún no hay userData o active es false)
  const isPendingApproval = isDocenteDomain && (userData?.active === false || !userData);

  return (
    <div className="auth-body">
      <div className="background-shape shape-1"></div>
      <div className="background-shape shape-2"></div>

      <div className="verification-card">
        <div className="verification-content">
          
          {isPendingApproval ? (
            /* --- VISTA PARA DOCENTES (@unitec.edu) --- */
            <>
              <div className="status-icon waiting">⏳</div>
              <h1>Solicitud en Revisión</h1>
              <p>
                Hemos registrado tu cuenta con el correo:
              </p>
              <h2 className="user-email-display">{userEmail}</h2>
              <div className="info-box">
                <p>
                  <strong>Estado: Pendiente de Aprobación.</strong><br/>
                  Para seguridad del portal, un Coordinador Académico debe validar tu perfil de docente antes de permitirte el acceso.
                </p>
              </div>
              <p className="subtext">
                Recibirás un correo de verificación una vez que un coordinador apruebe tu registro.
              </p>
            </>
          ) : (
            /* --- VISTA PARA COORDINADORES (@unitec.edu.hn) --- */
            <>
              <div className="status-icon email">📧</div>
              <h1>Verifica tu Correo</h1>
              <p>Hemos enviado un enlace de verificación a:</p>
              <h2 className="user-email-display">{userEmail}</h2>
              <p>
                Como <strong>Coordinador</strong>, puedes activar tu cuenta tú mismo. 
                Haz clic en el enlace que enviamos a tu bandeja de entrada (revisa <strong>spam</strong> si no lo ves).
              </p>
            </>
          )}

          <button onClick={handleBackToLogin} className="auth-button">
            Volver al Inicio
          </button>
        </div>
      </div>
    </div>
  );
}