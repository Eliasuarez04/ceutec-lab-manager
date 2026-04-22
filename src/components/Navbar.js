// src/components/Navbar.js
import React from 'react';
import { useAuth } from '../context/AuthContext';
import './styles/Navbar.css';
import ceutecLogo from '../assets/ceutec-logo.png';
import { useNavigate, Link } from 'react-router-dom';

export default function Navbar() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Failed to log out', error);
    }
  };

  return (
    <>
      {/* 🔥 ESTILOS ULTRA PREMIUM (GLASSMORPHISM + GLOW) 🔥 */}
      <style>
        {`
          .navbar-modern {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 15px 40px;
            background: rgba(255, 255, 255, 0.75);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border-bottom: 1px solid rgba(255, 255, 255, 0.4);
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.05);
            position: sticky;
            top: 0;
            z-index: 1000;
            transition: all 0.3s ease;
          }
          
          .navbar-logo {
            height: 45px;
            object-fit: contain;
            filter: drop-shadow(0 4px 6px rgba(0,0,0,0.08));
            transition: transform 0.3s ease;
          }
          
          .navbar-logo:hover {
            transform: scale(1.05);
          }

          .navbar-user-info-modern {
            display: flex;
            align-items: center;
            gap: 20px;
            font-weight: 700;
            color: #1e293b;
            background: linear-gradient(135deg, rgba(248, 250, 252, 0.9), rgba(241, 245, 249, 0.9));
            padding: 8px 8px 8px 24px;
            border-radius: 50px;
            border: 1px solid rgba(226, 232, 240, 0.9);
            box-shadow: inset 0 2px 4px rgba(255,255,255,0.5), 0 4px 10px rgba(0,0,0,0.02);
          }

          .user-email-text {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 0.95rem;
          }

          .logout-button-modern {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            background: linear-gradient(135deg, #c8102e 0%, #9f0b23 100%);
            color: white;
            border: none;
            padding: 10px 24px;
            border-radius: 40px;
            font-weight: 800;
            font-size: 0.9rem;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 0 4px 15px rgba(200, 16, 46, 0.3); /* Glow Rojo */
          }

          .logout-button-modern:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(200, 16, 46, 0.45);
          }
          
          /* 📱 MAGIA RESPONSIVA PARA MÓVILES (EL BOOM VISUAL) 📱 */
          @media (max-width: 768px) {
            .navbar-modern {
              flex-direction: column;
              padding: 15px 20px;
              gap: 20px;
            }
            .navbar-logo {
              height: 40px;
            }
            /* Transformamos la píldora en una tarjeta de perfil elegante */
            .navbar-user-info-modern {
              width: 100%;
              flex-direction: column; /* Apila el correo y el botón verticalmente */
              padding: 20px;
              border-radius: 24px;
              gap: 15px;
              background: rgba(255, 255, 255, 0.9);
              box-shadow: 0 10px 25px rgba(0,0,0,0.05);
            }
            .user-email-text {
              width: 100%;
              justify-content: center; /* Centra el correo */
              font-size: 0.9rem;
              color: #334155;
              /* Quitamos el truncado para que se vea completo, si es muy largo bajará de línea naturalmente */
              white-space: normal; 
              word-break: break-word;
              text-align: center;
            }
            .logout-button-modern {
              width: 100%; /* Botón grande y fácil de tocar */
              padding: 14px;
              font-size: 1rem;
              border-radius: 16px;
            }
          }
        `}
      </style>

      <div className="navbar-modern">
        <div className="navbar-logo-container">
          <Link to="/">
            <img src={ceutecLogo} alt="Ceutec Logo" className="navbar-logo" />
          </Link>
        </div>
        {currentUser && (
          <div className="navbar-user-info-modern fade-in">
            <span className="user-email-text">
              {/* Ícono de Usuario */}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{color: '#c8102e'}}>
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
              {currentUser.email}
            </span>
            <button onClick={handleLogout} className="logout-button-modern">
              Cerrar Sesión
              {/* Ícono de Salida */}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
            </button>
          </div>
        )}
      </div>
    </>
  );
}