// src/pages/AuthPage.js
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Modal from '../components/Modal';
import './styles/AuthPage.css';
import ceutecLogoWhite from '../assets/ceutec-logo-white.png';

// --- ICONOS SVG (Para no depender de librerías externas) ---
const MailIcon = () => (
  <svg className="input-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
);
const LockIcon = () => (
  <svg className="input-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
);
const EyeIcon = ({ onClick }) => (
  <svg onClick={onClick} className="toggle-password" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
);
const EyeOffIcon = ({ onClick }) => (
  <svg onClick={onClick} className="toggle-password" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
);

// --- Componente Formulario Login ---
const LoginForm = ({ onLogin, onForgotPassword }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    onLogin(email, password);
  };

  return (
    <form onSubmit={handleSubmit} className="auth-form">
      <h1>Portal de Laboratorios</h1>
      
      <div className="input-wrapper">
        <MailIcon />
        <input 
          type="email" 
          placeholder="Correo Electrónico" 
          value={email} 
          onChange={(e) => setEmail(e.target.value)} 
          required 
        />
      </div>

      <div className="input-wrapper">
        <LockIcon />
        <input 
          type={showPassword ? "text" : "password"} 
          placeholder="Contraseña" 
          value={password} 
          onChange={(e) => setPassword(e.target.value)} 
          required 
        />
        {showPassword ? 
          <EyeOffIcon onClick={() => setShowPassword(false)} /> : 
          <EyeIcon onClick={() => setShowPassword(true)} />
        }
      </div>

      <span className="forgot-password-link" onClick={onForgotPassword}>
        ¿Olvidaste tu contraseña?
      </span>
      <button type="submit" className="auth-button">Ingresar</button>
    </form>
  );
};

// --- Componente Formulario Registro ---
const RegisterForm = ({ onRegister }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    onRegister(email, password, confirmPassword);
  };

  return (
    <form onSubmit={handleSubmit} className="auth-form">
      <h1>Registro de Docentes</h1>
      
      <div className="input-wrapper">
        <MailIcon />
        <input 
          type="email" 
          placeholder="Correo Institucional" 
          value={email} 
          onChange={(e) => setEmail(e.target.value)} 
          required 
        />
      </div>

      <div className="input-wrapper">
        <LockIcon />
        <input 
          type={showPassword ? "text" : "password"} 
          placeholder="Contraseña" 
          value={password} 
          onChange={(e) => setPassword(e.target.value)} 
          required 
        />
        {showPassword ? 
          <EyeOffIcon onClick={() => setShowPassword(false)} /> : 
          <EyeIcon onClick={() => setShowPassword(true)} />
        }
      </div>

      <div className="input-wrapper">
        <LockIcon />
        <input 
          type={showPassword ? "text" : "password"} 
          placeholder="Confirmar Contraseña" 
          value={confirmPassword} 
          onChange={(e) => setConfirmPassword(e.target.value)} 
          required 
        />
      </div>

      <button type="submit" className="auth-button">Registrar</button>
    </form>
  );
};

// --- Pagina Principal ---
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
      setLoading(false);
      return toast.error(`Usa tu correo ${requiredDomain}`);
    }
    if (password !== confirmPassword) {
      setLoading(false);
      return toast.error('Las contraseñas no coinciden.');
    }
    setLoading(true);
    try {
      const promise = signup(email, password);
      await toast.promise(promise, {
        loading: 'Creando cuenta...',
        success: '¡Cuenta creada! Revisa tu correo.',
        error: (err) => err.message.includes('email-already-in-use') ? 'El correo ya existe.' : 'Error al registrar.'
      });
      navigate('/verificar-email');
    } catch (err) {}
    setLoading(false);
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    if (!resetEmail) return toast.error('Ingresa tu correo.');
    setIsResetModalOpen(false);
    const promise = resetPassword(resetEmail);
    toast.promise(promise, {
      loading: 'Enviando enlace...',
      success: 'Enlace enviado. Revisa tu correo.',
      error: 'Error al enviar enlace.'
    });
    setResetEmail('');
  };

  return (
    <>
      <Modal isOpen={isResetModalOpen} onClose={() => setIsResetModalOpen(false)} title="Recuperar Contraseña">
        <form onSubmit={handlePasswordReset} className="modal-form">
          <p>Ingresa tu correo institucional para recibir un enlace de recuperación.</p>
          <div className="input-wrapper">
            <MailIcon />
            <input 
              type="email" 
              value={resetEmail} 
              onChange={(e) => setResetEmail(e.target.value)} 
              placeholder="nombre@unitec.edu.hn"
              style={{ width: '100%', padding: '10px 10px 10px 35px', borderRadius: '5px', border: '1px solid #ccc' }}
              required 
            />
          </div>
          <div className="modal-actions">
            <button type="button" className="action-btn cancel-btn" onClick={() => setIsResetModalOpen(false)}>Cancelar</button>
            <button type="submit" className="action-btn save-btn">Enviar</button>
          </div>
        </form>
      </Modal>

      <div className="auth-body">
        {/* Orbes Decorativos de Fondo */}
        <div className="background-shape shape-1"></div>
        <div className="background-shape shape-2"></div>
        <div className="background-shape shape-3"></div>

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
                <h1>¡Bienvenido!</h1>
                <p>Para gestionar tus reservas de laboratorio, inicia sesión con tu cuenta.</p>
                <button className="auth-button ghost" onClick={() => setIsPanelActive(false)}>Iniciar Sesión</button>
              </div>
              <div className="overlay-panel overlay-right">
                <img src={ceutecLogoWhite} alt="Logo" className="overlay-logo" />
                <h1>¡Hola, Docente!</h1>
                <p>Regístrate para acceder al sistema de gestión de laboratorios.</p>
                <button className="auth-button ghost" onClick={() => setIsPanelActive(true)}>Registrarse</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}