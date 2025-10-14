// src/pages/AuthPage.js
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import './styles/AuthPage.css'; // Asegúrate que la ruta a tu CSS es correcta
import ceutecLogoWhite from '../assets/ceutec-logo-white.png';
import toast from 'react-hot-toast';
import Modal from '../components/Modal';

// Componente para el formulario de Login
const LoginForm = ({ onLogin, onForgotPassword }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onLogin(email, password);
  };

  return (
    <form onSubmit={handleSubmit} className="auth-form">
      <h1>Portal de Laboratorios</h1>
      <div className="input-group">
        <input type="email" placeholder="Correo Electrónico" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div className="input-group">
        <input type="password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </div>
      <span className="forgot-password-link" onClick={onForgotPassword}>
        ¿Olvidaste tu contraseña?
      </span>
      <button type="submit" className="auth-button">Ingresar</button>
    </form>
  );
};

// Componente para el formulario de Registro
const RegisterForm = ({ onRegister }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onRegister(email, password, confirmPassword);
  };

  return (
    <form onSubmit={handleSubmit} className="auth-form">
      <h1>Registro de Docentes</h1>
      <div className="input-group">
        <input type="email" placeholder="Correo Institucional" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div className="input-group">
        <input type="password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </div>
      <div className="input-group">
        <input type="password" placeholder="Confirmar Contraseña" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
      </div>
      <button type="submit" className="auth-button">Registrar</button>
    </form>
  );
};


// Componente Principal
export default function AuthPage() {
  const [isPanelActive, setIsPanelActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const { login, signup, resetPassword } = useAuth();
  const navigate = useNavigate();
  const requiredDomain = '@unitec.edu.hn';

  const handleLogin = async (email, password) => {
    if (loading) return;
    setLoading(true);
    try {
      await login(email, password);
      toast.success('¡Bienvenido de nuevo!');
      navigate('/');
    } catch (err) {
      toast.error('Credenciales incorrectas o correo no verificado.');
    }
    setLoading(false);
  };

  const handleRegister = async (email, password, confirmPassword) => {
    if (loading) return;

    if (!email.toLowerCase().endsWith(requiredDomain)) {
      return toast.error(`El registro solo es para dominios ${requiredDomain}.`);
    }
    if (password !== confirmPassword) {
      return toast.error('Las contraseñas no coinciden.');
    }

    setLoading(true);
    try {
      const promise = signup(email, password);
      await toast.promise(promise, {
        loading: 'Creando cuenta...',
        success: '¡Cuenta creada! Revisa tu correo para verificarla.',
        error: (err) => `Error: ${err.message.includes('email-already-in-use') ? 'El correo ya está en uso.' : 'Ocurrió un error.'}`
      });
      navigate('/verificar-email');
    } catch (err) {
      // El toast ya maneja el error
    }
    setLoading(false);
  };

  // --- SOLUCIÓN: LA FUNCIÓN HA SIDO MOVIDA AQUÍ ---
  // Ahora está en el scope correcto, al mismo nivel que handleLogin y handleRegister.
  const handlePasswordReset = async (e) => {
    e.preventDefault();
    if (!resetEmail) {
      return toast.error('Por favor, ingresa tu correo electrónico.');
    }
    
    const promise = resetPassword(resetEmail);
    
    toast.promise(promise, {
      loading: 'Enviando enlace...',
      success: '¡Enlace enviado! Revisa tu correo (y la carpeta de spam).',
      error: (err) => `Error: ${err.message.includes('user-not-found') ? 'El correo no está registrado.' : 'Ocurrió un error.'}`
    }).then(() => {
      setIsResetModalOpen(false);
      setResetEmail('');
    }).catch(() => {
      // El error ya se muestra en el toast, no necesitamos hacer nada más
    });
  };

  return (
    <>
      <Modal isOpen={isResetModalOpen} onClose={() => setIsResetModalOpen(false)} title="Restablecer Contraseña">
        <form onSubmit={handlePasswordReset} className="modal-form">
          <p>Ingresa tu correo electrónico institucional y te enviaremos un enlace para restablecer tu contraseña.</p>
          <div className="form-group">
            <label htmlFor="reset-email">Correo Electrónico</label>
            <input 
              id="reset-email" 
              type="email" 
              value={resetEmail} 
              onChange={(e) => setResetEmail(e.target.value)} 
              placeholder="nombre.apellido@unitec.edu.hn"
              required 
            />
          </div>
          <div className="modal-actions">
            <button type="button" className="action-btn cancel-btn" onClick={() => setIsResetModalOpen(false)}>Cancelar</button>
            <button type="submit" className="action-btn save-btn">Enviar Enlace</button>
          </div>
        </form>
      </Modal>

      <div className="auth-body">
        <div className={`auth-container ${isPanelActive ? 'right-panel-active' : ''}`} id="container">
          <div className="form-container sign-up-container">
            <RegisterForm onRegister={handleRegister} />
          </div>
          <div className="form-container sign-in-container">
            <LoginForm onLogin={handleLogin} onForgotPassword={() => setIsResetModalOpen(true)} />
          </div>
          <div className="overlay-container">
            <div className="overlay">
              <div className="overlay-panel overlay-left">
                <img src={ceutecLogoWhite} alt="Logo" className="overlay-logo" />
                <h1>¡Bienvenido de Nuevo!</h1>
                <p>Para mantenerte conectado con nosotros, por favor inicia sesión con tu información personal</p>
                <button className="auth-button ghost" onClick={() => setIsPanelActive(false)}>
                  Iniciar Sesión
                </button>
              </div>
              <div className="overlay-panel overlay-right">
                <img src={ceutecLogoWhite} alt="Logo" className="overlay-logo" />
                <h1>¡Hola, Docente!</h1>
                <p>Ingresa tus datos personales y comienza tu viaje con nosotros</p>
                <button className="auth-button ghost" onClick={() => setIsPanelActive(true)}>
                  Registrarse
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}