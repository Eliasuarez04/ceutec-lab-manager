import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Modal from '../components/Modal';
import './styles/AuthPage.css';
import ceutecLogoWhite from '../assets/ceutec-logo-white.png';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { auth, db } from '../firebaseConfig'; // CAMBIO: db agregado para actualizar ciudad del docente
import { sendEmailVerification } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore'; // CAMBIO: Importaciones de firestore

// --- ICONOS ---
const MailIcon = () => (
  <svg className="input-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <polyline points="22,6 12,13 2,6" />
  </svg>
);
const LockIcon = () => (
  <svg className="input-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);
const UserIcon = () => (
  <svg className="input-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
  </svg>
);
const IDIcon = () => (
  <svg className="input-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <line x1="7" y1="8" x2="17" y2="8" /><line x1="7" y1="12" x2="17" y2="12" /><line x1="7" y1="16" x2="12" y2="16" />
  </svg>
);
const BriefcaseIcon = () => (
  <svg className="input-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
  </svg>
);
// NUEVO ÍCONO PARA LA CIUDAD
const MapIcon = () => (
  <svg className="input-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

const EyeIcon = ({ onClick }) => (
  <svg onClick={onClick} className="toggle-password-premium" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{cursor:'pointer'}}>
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
  </svg>
);
const EyeOffIcon = ({ onClick }) => (
  <svg onClick={onClick} className="toggle-password-premium" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{cursor:'pointer'}}>
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

export default function AuthPage() {
  const { login, signup, resetPassword } = useAuth();
  const navigate = useNavigate();
  const [isPanelActive, setIsPanelActive] = useState(false);
  const[isResetModalOpen, setIsResetModalOpen] = useState(false);
  const[resetEmail, setResetEmail] = useState('');

  // ESTADOS DE REGISTRO
  const [regEmail, setRegEmail] = useState('');
  const [regName, setRegName] = useState('');
  const [regTh, setRegTh] = useState('');
  const [regCity, setRegCity] = useState(''); 
  const [regPassword, setRegPassword] = useState('');
  const [regConfirm, setRegConfirm] = useState('');
  
  // 🔥 CORRECCIÓN: Inicializamos en 'superadmin' para que empate con la primera opción del menú
  const [selectedRole, setSelectedRole] = useState('superadmin'); 
  
  const [showRegPass, setShowRegPass] = useState(false);
  const [regPin, setRegPin] = useState('');

  // ESTADOS DE LOGIN
  const [loginEmail, setLoginEmail] = useState('');
  const[loginPassword, setLoginPassword] = useState('');
  const [showLoginPass, setShowLoginPass] = useState(false);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    const loadingToast = toast.loading("Autenticando...");
    try {
      const userCredential = await login(loginEmail, loginPassword);
      const user = userCredential.user;

      if (!user.emailVerified) {
        toast.dismiss(loadingToast);
        navigate('/verificar-email'); 
      } else {
        toast.success("Bienvenido", { id: loadingToast });
        navigate('/'); 
      }
    } catch (err) {
      if (err.message.includes("user_not_active")) {
        toast.error("Acceso denegado. Contacte al administrador.", { id: loadingToast });
      } else {
        toast.error("Credenciales incorrectas o error de conexión", { id: loadingToast });
      }
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if (regPassword !== regConfirm) return toast.error("Las contraseñas no coinciden");
    const loadingToast = toast.loading("Validando...");
    
    try {
      const isStaff = regEmail.toLowerCase().endsWith('@unitec.edu.hn');
      
      if (isStaff) {
        const functions = getFunctions();
        const registerStaffSecure = httpsCallable(functions, 'registerStaffSecure');
        await registerStaffSecure({
          email: regEmail, password: regPassword, name: regName, th: regTh, role: selectedRole, pin: regPin, city: regCity
        });
        
        const userCred = await login(regEmail, regPassword);
        await sendEmailVerification(userCred.user);

        toast.success("Registro Exitoso como Staff", { id: loadingToast });
        navigate('/verificar-email'); 

      } else {
        await signup(regEmail, regPassword, regName, regTh, 'docente');
        
        // CAMBIO: Aseguramos que la ciudad del docente se guarde al momento de registrarse
        if (auth.currentUser) {
          await updateDoc(doc(db, 'users', auth.currentUser.uid), { city: regCity });
        }

        toast.success("Registro Exitoso", { id: loadingToast });
        navigate('/verificar-email');
      }
    } catch (err) { 
      toast.error(err.message, { id: loadingToast }); 
    }
  };

  return (
    <div className="modern-auth-body">
      {/* Estilo inyectado para el scroll interno de los campos y evitar desbordamiento */}
      <style>
        {`
          .scrollable-form-container {
            width: 100%;
            max-height: 320px;
            overflow-y: auto;
            overflow-x: hidden;
            padding-right: 8px;
            margin-bottom: 10px;
          }
          .scrollable-form-container::-webkit-scrollbar { width: 6px; }
          .scrollable-form-container::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 10px; }
          .scrollable-form-container::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
          .scrollable-form-container::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
          @media (max-height: 700px) { .scrollable-form-container { max-height: 250px; } }
        `}
      </style>

      <div className="star-field"></div>
      
      <div className="brand-header-external">
         <div className="spaceone-brand-text">SPACEONE</div>
         <div className="brand-sub-text">GESTIÓN ACADÉMICA</div>
      </div>

      <div className={`auth-card-container ${isPanelActive ? 'right-panel-active' : ''}`}>
        
        {/* PANEL REGISTRO */}
        <div className="form-container-modern sign-up-container">
          <form onSubmit={handleRegisterSubmit} className="auth-form-modern">
            <h1 className="form-internal-title">Crear Cuenta</h1>
            <p className="subtitle-internal">VALIDACIÓN POR TH DOCENTE</p>
            
            {/* CONTENEDOR CON SCROLL PARA LOS CAMPOS */}
            <div className="scrollable-form-container">
              <div className="input-group-modern">
                  <MailIcon /><input type="email" placeholder="Correo institucional" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} required />
              </div>
              <div className="input-group-modern">
                  <UserIcon /><input type="text" placeholder="Nombre Completo" value={regName} onChange={(e) => setRegName(e.target.value)} required />
              </div>
              <div className="input-group-modern">
                  <IDIcon /><input type="text" placeholder="No. Empleado (TH)" value={regTh} onChange={(e) => setRegTh(e.target.value)} required />
              </div>

              {/* CAMBIO: Ciudad disponible para todos (Docentes y Staff) */}
              <div className="input-group-modern">
                  <MapIcon />
                  <select value={regCity} onChange={(e) => setRegCity(e.target.value)} required className="premium-select">
                      <option value="" disabled hidden>Ciudad / Sede Central</option>
                      <option value="San Pedro Sula">San Pedro Sula</option>
                      <option value="Tegucigalpa">Tegucigalpa</option>
                      <option value="La Ceiba">La Ceiba</option>
                  </select>
                  <span className="select-arrow-premium">▼</span>
              </div>

              {regEmail.toLowerCase().endsWith('@unitec.edu.hn') && (
                <>
                  <div className="input-group-modern">
                    <BriefcaseIcon />
                    <select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)} className="premium-select">
                      <option value="superadmin">Super Administrador</option>
                      <option value="coordinador">Coordinador Académico</option>
                      <option value="coord_labs">Coordinador de Laboratorios</option>
                      <option value="coord_aulas">Coordinador de Aulas</option>
                      <option value="it_staff">Personal IT / Soporte</option>
                      <option value="admin_staff">Personal Administrativo</option>
                    </select>
                    <span className="select-arrow-premium">▼</span>
                  </div>
                  <div className="input-group-modern">
                      <LockIcon /><input type="password" placeholder="PIN de Autorización" value={regPin} onChange={(e) => setRegPin(e.target.value)} required />
                  </div>
                </>
              )}

              <div className="input-group-modern">
                <LockIcon />
                <input type={showRegPass ? "text" : "password"} placeholder="Contraseña" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} required />
                {showRegPass ? <EyeOffIcon onClick={() => setShowRegPass(false)} /> : <EyeIcon onClick={() => setShowRegPass(true)} />}
              </div>
              <div className="input-group-modern">
                <LockIcon /><input type={showRegPass ? "text" : "password"} placeholder="Confirmar" value={regConfirm} onChange={(e) => setRegConfirm(e.target.value)} required />
              </div>
            </div>

            <button type="submit" className="btn-modern main">Registrar</button>
            <p className="mobile-switch-link" onClick={() => setIsPanelActive(false)}>
                ¿Ya tienes cuenta? <span>Inicia Sesión</span>
            </p>
          </form>
        </div>

        {/* PANEL LOGIN */}
        <div className="form-container-modern sign-in-container">
          <form onSubmit={handleLoginSubmit} className="auth-form-modern">
            <h1 className="form-internal-title">Bienvenido</h1>
            <p className="subtitle-internal">INGRESA TUS CREDENCIALES</p>
            <div className="input-group-modern">
                <MailIcon /><input type="email" placeholder="Correo institucional" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} required />
            </div>
            <div className="input-group-modern">
              <LockIcon />
              <input type={showLoginPass ? "text" : "password"} placeholder="Contraseña" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required />
              {showLoginPass ? <EyeOffIcon onClick={() => setShowLoginPass(false)} /> : <EyeIcon onClick={() => setShowLoginPass(true)} />}
            </div>
            <span onClick={() => setIsResetModalOpen(true)} className="recovery-link">¿Olvidaste tu contraseña?</span>
            <button type="submit" className="btn-modern main">Ingresar</button>
            <p className="mobile-switch-link" onClick={() => setIsPanelActive(true)}>
                ¿No tienes cuenta? <span>Regístrate aquí</span>
            </p>
          </form>
        </div>

        {/* OVERLAY */}
        <div className="overlay-container-modern">
          <div className="overlay-modern">
            <div className="overlay-panel-modern overlay-left">
              <img src={ceutecLogoWhite} className="logo-overlay" alt="logo" />
              <h2>¿Ya tienes cuenta?</h2>
              <p>Inicia sesión con tus credenciales institucionales.</p>
              <button className="btn-modern ghost" onClick={() => setIsPanelActive(false)}>Ir al Login</button>
            </div>
            <div className="overlay-panel-modern overlay-right">
              <img src={ceutecLogoWhite} className="logo-overlay" alt="logo" />
              <h2>¿Docente Nuevo?</h2>
              <p>Regístrate para obtener acceso automatizado a tus reservas académicas.</p>
              <button className="btn-modern ghost" onClick={() => setIsPanelActive(true)}>Comenzar Registro</button>
            </div>
          </div>
        </div>
      </div>

      <Modal isOpen={isResetModalOpen} onClose={() => setIsResetModalOpen(false)} title="Recuperar Acceso">
        <div className="recovery-content">
          <p>Se enviará un enlace a tu correo institucional para restablecer tu contraseña.</p>
          <div className="input-group-modern" style={{maxWidth: '100%'}}>
              <MailIcon />
              <input type="email" placeholder="nombre@unitec.edu" className="input-modern-simple" onChange={(e) => setResetEmail(e.target.value)} />
          </div>
          <button className="btn-modern main" style={{width: '100%', marginTop: '20px'}} onClick={async () => { await resetPassword(resetEmail); setIsResetModalOpen(false); toast.success("Enlace enviado."); }}>Enviar Enlace</button>
        </div>
      </Modal>
    </div>
  );
}