// src/pages/SedeSelector.js
import React from 'react';
import { useNavigate } from 'react-router-dom';
import './styles/Dashboard.css';

const sedesConfig = [
  { name: "Ceutec SPS Norte", color: "linear-gradient(135deg, #c8102e 0%, #8a0b20 100%)", icon: "🏙️", desc: "Campus Norte" },
  { name: "Ceutec SPS Central", color: "linear-gradient(135deg, #6a11cb 0%, #2575fc 100%)", icon: "🏢", desc: "Campus Central" },
  { name: "Ceutec TGU (Prado)", color: "linear-gradient(135deg, #007adf 0%, #00ecbc 100%)", icon: "🚋", desc: "Tegucigalpa Prado" },
  { name: "Ceutec TGU (Centroamerica)", color: "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)", icon: "🌳", desc: "TGU Centroamérica" },
  { name: "Ceutec LCE", color: "linear-gradient(135deg, #f857a6 0%, #ff5858 100%)", icon: "🌊", desc: "La Ceiba" }
];

export default function SedeSelector() {
  const navigate = useNavigate();

  const handleSelect = (sedeName) => {
    navigate(`/?sede=${encodeURIComponent(sedeName)}`);
  };

  return (
    <div className="dashboard-wrapper">
      <div className="sede-selector-container fade-in">
        <div className="selector-header">
          <h1>¡Bienvenido! 👋</h1>
          <p>Selecciona la sede donde gestionarás espacios hoy:</p>
        </div>
        
        <div className="sedes-grid-container">
          {sedesConfig.map((sede) => (
            <div 
              key={sede.name} 
              className="sede-card-big" 
              onClick={() => handleSelect(sede.name)}
              style={{ background: sede.color }}
            >
              <div className="sede-card-icon">{sede.icon}</div>
              <div className="sede-card-info">
                <h3>{sede.desc}</h3>
                <span>{sede.name}</span>
              </div>
              <div className="sede-card-arrow">➜</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}