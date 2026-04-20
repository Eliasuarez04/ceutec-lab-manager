import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import './styles/VerificarEmail.css';

export default function VerificarEmail() {
  const { userData, currentUser, logout, loading } = useAuth();
  const navigate = useNavigate();

  if (loading) return <div className="auth-body"><h1 style={{color: 'white'}}>Cargando...</h1></div>;

  const userEmail = currentUser?.email || "";
  const isDocenteDomain = userEmail.toLowerCase().endsWith('@unitec.edu');
  const isPendingApproval = isDocenteDomain && (userData?.active === false || !userData);

  return (
    <div className="auth-body">
      <div className="background-shape shape-1"></div>
      <div className="background-shape shape-2"></div>

      <div className="verification-card">
        {isPendingApproval ? (
          <>
            <span className="status-icon">⏳</span>
            <h1>Solicitud en Revisión</h1>
            <p>Hemos registrado tu cuenta con el correo:</p>
            <div className="user-email-display">{userEmail}</div>
            <div className="info-box">
              <p style={{margin: 0}}>
                <strong>Estado: Pendiente de Aprobación.</strong><br/>
                Un Coordinador Académico debe validar tu perfil antes de permitirte el acceso.
              </p>
            </div>
            <p style={{fontSize: '0.9rem', color: '#666'}}>
              Recibirás un correo una vez que seas aprobado.
            </p>
          </>
        ) : (
          <>
            <span className="status-icon">📧</span>
            <h1>Verifica tu Correo</h1>
            <p>Enviamos un enlace de activación a:</p>
            <div className="user-email-display">{userEmail}</div>
            <p>
              Revisa tu bandeja de entrada (y carpetas de spam/no deseado) para activar tu acceso.
            </p>
          </>
        )}

        <button onClick={async () => { await logout(); navigate('/login'); }} className="auth-button">
          Volver al Inicio
        </button>
      </div>
    </div>
  );
}