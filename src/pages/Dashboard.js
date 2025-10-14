// src/pages/Dashboard.js
import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './styles/Dashboard.css';

// ===================================================================================
// Helper: Componente para las tarjetas del Dashboard
// ===================================================================================
const DashboardCard = ({ to, icon, title, description, isAdminCard = false }) => {
  return (
    <Link to={to} className={`dashboard-card-link ${isAdminCard ? 'admin-card' : ''}`}>
      <div className="card-content">
        <div className="card-icon">{icon}</div>
        <h2 className="card-title">{title}</h2>
        <p className="card-description">{description}</p>
      </div>
    </Link>
  );
};


// ===================================================================================
// Componente Principal: Dashboard
// ===================================================================================
export default function Dashboard() {
  const { userData } = useAuth();
  const isAdmin = userData?.role === 'admin';

  return (
    <div className="dashboard-wrapper">
      <h1 className="dashboard-title">Bienvenido al Portal</h1>
      <div className="dashboard-grid">
        
        {/* Tarjeta para ver Laboratorios (visible para todos) */}
        <DashboardCard 
          to="/laboratorios"
          icon="🔬"
          title="Laboratorios"
          description="Consulta los laboratorios y su equipamiento disponible."
        />

        {/* Tarjeta para Reservar Espacios (visible para todos) */}
        <DashboardCard 
          to="/reservas"
          icon="🗓️"
          title="Reservar Espacios"
          description="Consulta la disponibilidad y reserva un laboratorio para tus clases."
        />
        
       {isAdmin && (
  <>
    <DashboardCard 
      to="/admin/inventario"
      icon="⚙️"
      title="Gestionar Inventario"
      description="Administra laboratorios, equipos e insumos."
      isAdminCard={true}
    />
    {/* --- NUEVA TARJETA DE REPORTES --- */}
    <DashboardCard 
      to="/reportes"
      icon="📊"
      title="Reportes"
      description="Visualiza estadísticas de uso e historiales de cambios."
      isAdminCard={true}
    />
  </>
)}
      </div>
    </div>
  );
}