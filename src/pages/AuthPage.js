// src/pages/AuthPage.js
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Modal from '../components/Modal';
import './styles/AuthPage.css';
import ceutecLogoWhite from '../assets/ceutec-logo-white.png';

// --- ICONOS RESTAURADOS ---
const MailIcon = () => (
  <svg className="input-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
);
const LockIcon = () => (
  <svg className="input-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
);
const UserIcon = () => (
  <svg className="input-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
);
const IDIcon = () => (
  <svg className="input-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"></rect><line x1="7" y1="8" x2="17" y2="8"></line><line x1="7" y1="12" x2="17" y2="12"></line><line x1="7" y1="16" x2="12" y2="16"></line></svg>
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

// --- FORMULARIO LOGIN ---
const LoginForm = ({ onLogin, onForgotPassword }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  return (
    <form onSubmit={(e) => { e.preventDefault(); onLogin(email, password); }} className="auth-form">
      <h1>SpaceOne</h1>
      <div className="input-wrapper">
        <MailIcon /><input type="email" placeholder="Correo Institucional" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div className="input-wrapper">
        <LockIcon />
        <input type={showPassword ? "text" : "password"} placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {showPassword ? <EyeOffIcon onClick={() => setShowPassword(false)} /> : <EyeIcon onClick={() => setShowPassword(true)} />}
      </div>
      <span className="forgot-password-link" onClick={onForgotPassword}>¿Olvidaste tu contraseña?</span>
      <button type="submit" className="auth-button">Ingresar</button>
    </form>
  );
};

// --- FORMULARIO REGISTRO ---
const RegisterForm = ({ onRegister }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [th, setTh] = useState('');
  const [selectedRole, setSelectedRole] = useState('docente');
  const [showPassword, setShowPassword] = useState(false);

  const isHN = email.toLowerCase().endsWith('@unitec.edu.hn');

  return (
    <form onSubmit={(e) => { e.preventDefault(); onRegister(email, password, confirmPassword, name, th, selectedRole); }} className="auth-form">
      <h1>Crea tu Cuenta</h1>
      <div className="input-wrapper">
        <MailIcon /><input type="email" placeholder="Correo @unitec.edu o .hn" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div className="input-wrapper">
        <UserIcon /><input type="text" placeholder="Nombre Completo" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="input-wrapper">
        <IDIcon /><input type="text" placeholder="No. Empleado (TH)" value={th} onChange={(e) => setTh(e.target.value)} required />
      </div>
      {isHN && (
        <div className="input-wrapper">
          <BriefcaseIcon />
          <select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)} className="auth-input-select">
            <option value="coordinador">Coordinador Académico</option>
            <option value="it_staff">Soporte Técnico / IT</option>
            <option value="admin_staff">Personal Administrativo</option>
          </select>
          <span className="select-arrow">▼</span>
        </div>
      )}
      <div className="input-wrapper">
        <LockIcon />
        <input type={showPassword ? "text" : "password"} placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {showPassword ? <EyeOffIcon onClick={() => setShowPassword(false)} /> : <EyeIcon onClick={() => setShowPassword(true)} />}
      </div>
      <div className="input-wrapper">
        <LockIcon /><input type="password" placeholder="Confirmar Contraseña" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
      </div>
      <button type="submit" className="auth-button">Registrar y Validar</button>
    </form>
  );
};

export default function AuthPage() {
  const { login, signup, resetPassword } = useAuth();
  const navigate = useNavigate();
  const [isPanelActive, setIsPanelActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');

  const handleLogin = async (email, password) => {
    setLoading(true);
    try { await login(email, password); navigate('/'); } catch (err) {
      if (err.message.includes("user_not_active")) toast.error("Acceso denegado. No eres docente activo.");
      else toast.error("Error en credenciales.");
    }
    setLoading(false);
  };

  const handleRegister = async (email, password, confirm, name, th, role) => {
    if (password !== confirm) return toast.error("Contraseñas no coinciden");
    setLoading(true);
    try {
      await signup(email, password, name, th, role);
      toast.success("Registro procesado exitosamente."); navigate('/verificar-email');
    } catch (err) { toast.error(err.message); }
    setLoading(false);
  };

  return (
    <>
      <Modal isOpen={isResetModalOpen} onClose={() => setIsResetModalOpen(false)} title="Recuperar Contraseña">
        <div className="recovery-modal-content">
          <p className="recovery-text">Ingresa tu correo institucional y te enviaremos un enlace seguro.</p>
          <form onSubmit={async (e) => { e.preventDefault(); await resetPassword(resetEmail); setIsResetModalOpen(false); toast.success("Enlace enviado."); }} className="auth-form-recovery">
            <div className="input-wrapper">
              <MailIcon /><input type="email" placeholder="nombre@unitec.edu" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} required />
            </div>
            <button type="submit" className="auth-button full-width">Enviar Enlace</button>
          </form>
        </div>
      </Modal>

      <div className="auth-body">
        <div className="background-shape shape-1"></div>
        <div className="background-shape shape-2"></div>
        <div className={`auth-container ${isPanelActive ? 'right-panel-active' : ''}`}>
          <div className="form-container sign-up-container"><RegisterForm onRegister={handleRegister} /></div>
          <div className="form-container sign-in-container"><LoginForm onLogin={handleLogin} onForgotPassword={() => setIsResetModalOpen(true)} /></div>
          <div className="overlay-container">
            <div className="overlay">
              <div className="overlay-panel overlay-left">
                <img src={ceutecLogoWhite} className="overlay-logo" alt="logo" />
                <h1>¡Bienvenido!</h1>
                <button className="auth-button ghost" onClick={() => setIsPanelActive(false)}>Login</button>
              </div>
              <div className="overlay-panel overlay-right">
                <img src={ceutecLogoWhite} className="overlay-logo" alt="logo" />
                <h1>¿Eres Docente?</h1>
                <button className="auth-button ghost" onClick={() => setIsPanelActive(true)}>Registro</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}