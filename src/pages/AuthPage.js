// src/pages/AuthPage.js
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Modal from '../components/Modal';
import './styles/AuthPage.css';
import ceutecLogoWhite from '../assets/ceutec-logo-white.png';

const faculties = ["Ingeniería", "Salud", "Negocios", "Arte y Diseño", "Ciencias Sociales", "Gastronomía"];

// --- DEFINICIÓN DE ICONOS ---
const MailIcon = () => (
  <svg className="input-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
);

const LockIcon = () => (
  <svg className="input-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
);

const BriefcaseIcon = () => (
  <svg className="input-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
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

  return (
    <form onSubmit={(e) => { e.preventDefault(); onLogin(email, password); }} className="auth-form">
      <h1>CEUTEC-UNITEC SpaceOne</h1>
      <div className="input-wrapper">
        <MailIcon />
        <input type="email" placeholder="Correo Institucional" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div className="input-wrapper">
        <LockIcon />
        <input type={showPassword ? "text" : "password"} placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {showPassword ? <EyeOffIcon onClick={() => setShowPassword(false)} /> : <EyeIcon onClick={() => setShowPassword(true)} />}
      </div>
      {/* BOTÓN OLVIDASTE CONTRASEÑA VINCULADO */}
      <span className="forgot-password-link" onClick={onForgotPassword}>¿Olvidaste tu contraseña?</span>
      <button type="submit" className="auth-button">Ingresar</button>
    </form>
  );
};

// --- Componente Formulario Registro ---
const RegisterForm = ({ onRegister }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [faculty, setFaculty] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form onSubmit={(e) => { e.preventDefault(); onRegister(email, password, confirmPassword, faculty); }} className="auth-form">
      <h1>Crea tu Cuenta</h1>
      
      <div className="input-wrapper">
        <MailIcon />
        <input type="email" placeholder="Correo @unitec.edu o .hn" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>

      <div className="input-wrapper">
        <BriefcaseIcon />
        <select 
          value={faculty} 
          onChange={(e) => setFaculty(e.target.value)} 
          required 
          className="auth-input-select"
        >
          <option value="" disabled>Selecciona tu Facultad...</option>
          {faculties.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        <span className="select-arrow">▼</span>
      </div>

      <div className="input-wrapper">
        <LockIcon />
        <input type={showPassword ? "text" : "password"} placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {showPassword ? <EyeOffIcon onClick={() => setShowPassword(false)} /> : <EyeIcon onClick={() => setShowPassword(true)} />}
      </div>

      <div className="input-wrapper">
        <LockIcon />
        <input type={showPassword ? "text" : "password"} placeholder="Confirmar Contraseña" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
      </div>

      <button type="submit" className="auth-button">Registrar</button>
    </form>
  );
};

// --- Componente Principal ---
export default function AuthPage() {
  const { login, signup, resetPassword } = useAuth();
  const navigate = useNavigate();
  const [isPanelActive, setIsPanelActive] = useState(false);
  const [loading, setLoading] = useState(false);

  // Estados para el Modal de Recuperación
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');

  const handleLogin = async (email, password) => {
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      if (err.message.includes("user_not_active")) {
        toast.error("Tu cuenta espera aprobación del Coordinador.");
      } else if (err.message.includes("verify_email_first")) {
        toast.error("Verifica tu correo electrónico para poder ingresar.");
      } else {
        toast.error("Credenciales incorrectas o cuenta inexistente.");
      }
    }
    setLoading(false);
  };

  const handleRegister = async (email, password, confirm, faculty) => {
    if (password !== confirm) return toast.error("Contraseñas no coinciden");
    if (!faculty) return toast.error("Selecciona tu facultad");
    
    setLoading(true);
    try {
      await signup(email, password, faculty);
      toast.success("Registro enviado con éxito.");
      navigate('/verificar-email');
    } catch (err) {
      toast.error("Error al registrar: " + err.message);
    }
    setLoading(false);
  };

  // Función para manejar el restablecimiento de contraseña
  const handlePasswordReset = async (e) => {
    e.preventDefault();
    if (!resetEmail) return toast.error("Por favor, ingresa tu correo institucional.");

    setLoading(true);
    try {
      await resetPassword(resetEmail);
      toast.success("Enlace de recuperación enviado. Revisa tu correo.", { duration: 6000 });
      setIsResetModalOpen(false);
      setResetEmail('');
    } catch (err) {
      toast.error("Error al enviar el correo. Verifica los datos.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* MODAL DE RECUPERACIÓN DE CONTRASEÑA */}
      <Modal 
        isOpen={isResetModalOpen} 
        onClose={() => setIsResetModalOpen(false)} 
        title="Recuperar Contraseña"
      >
        <form onSubmit={handlePasswordReset} className="modal-form-academic">
          <p style={{marginBottom: '20px', color: '#666', fontSize: '0.9rem', textAlign: 'center'}}>
            Ingresa tu correo institucional y te enviaremos un enlace seguro para restablecer tu contraseña.
          </p>
          <div className="input-wrapper">
            <MailIcon />
            <input 
              type="email" 
              placeholder="nombre@unitec.edu" 
              value={resetEmail} 
              onChange={(e) => setResetEmail(e.target.value)} 
              required 
              style={{width: '100%', padding: '12px 12px 12px 45px', borderRadius: '10px', border: '1px solid #ddd'}}
            />
          </div>
          <div className="modal-footer-pro" style={{marginTop: '25px', display: 'flex', gap: '10px', justifyContent: 'center'}}>
            <button type="button" onClick={() => setIsResetModalOpen(false)} className="btn-cancel-pro">Cancelar</button>
            <button type="submit" disabled={loading} className="btn-save-pro">
              {loading ? 'Enviando...' : 'Enviar Enlace'}
            </button>
          </div>
        </form>
      </Modal>

      <div className="auth-body">
        {/* Orbes decorativos */}
        <div className="background-shape shape-1"></div>
        <div className="background-shape shape-2"></div>
        <div className="background-shape shape-3"></div>

        <div className={`auth-container ${isPanelActive ? 'right-panel-active' : ''}`}>
          <div className="form-container sign-up-container">
            <RegisterForm onRegister={handleRegister} />
          </div>
          <div className="form-container sign-in-container">
            <LoginForm 
              onLogin={handleLogin} 
              onForgotPassword={() => setIsResetModalOpen(true)} 
            />
          </div>
          
          <div className="overlay-container">
            <div className="overlay">
              <div className="overlay-panel overlay-left">
                <img src={ceutecLogoWhite} className="overlay-logo" alt="logo" />
                <h1>¡Bienvenido!</h1>
                <p>Para gestionar tus reservas, inicia sesión con tu cuenta institucional.</p>
                <button className="auth-button ghost" onClick={() => setIsPanelActive(false)}>Iniciar Sesión</button>
              </div>
              <div className="overlay-panel overlay-right">
                <img src={ceutecLogoWhite} className="overlay-logo" alt="logo" />
                <h1>¿Eres Docente?</h1>
                <p>Regístrate ahora y comienza a gestionar tus laboratorios y aulas.</p>
                <button className="auth-button ghost" onClick={() => setIsPanelActive(true)}>Registrarse</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}