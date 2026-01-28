// src/pages/VerificarEmail.js
import React from 'react';
import { useNavigate } from 'react-router-dom';
import './styles/VerificarEmail.css';
import { useAuth } from '../context/AuthContext';

export default function VerificarEmail() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="verify-container">
      <div className="verify-card">
        <h1>Verifica tu Correo Electrónico</h1>
        <p>
          Hemos enviado un enlace de verificación a:
          <br />
          <strong>{currentUser?.email}</strong>
        </p>
        <p>
          Por favor, haz clic en el enlace de ese correo para activar tu cuenta. Si no lo encuentras, revisa tu carpeta de spam.
        </p>
        <p className="resend-info">
          Una vez verificado, puedes iniciar sesión.
        </p>
        <button onClick={handleLogout} className="login-button-verify">
          Volver a Inicio de Sesión
        </button>
      </div>
    </div>
  );
}