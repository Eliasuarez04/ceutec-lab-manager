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
    <div className="navbar">
      <div className="navbar-logo-container">
        <Link to="/">
          <img src={ceutecLogo} alt="Ceutec Logo" className="navbar-logo" />
        </Link>
      </div>
      {currentUser && (
        <div className="navbar-user-info">
          <span>{currentUser.email}</span>
          <button onClick={handleLogout} className="logout-button">Cerrar Sesión</button>
        </div>
      )}
    </div>
  );
}