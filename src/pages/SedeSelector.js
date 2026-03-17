// src/pages/SedeSelector.js
import React from 'react';
import { useNavigate } from 'react-router-dom';
import './styles/Dashboard.css';

const sedesPorCiudad = [
  {
    ciudad: "SPS",
    sedes: [
      { name: "Ceutec SPS Norte", color: "linear-gradient(135deg, #c8102e 0%, #8a0b20 100%)", icon: "🏫", desc: "Sede Norte" },
      { name: "Ceutec SPS Central", color: "linear-gradient(135deg, #6a11cb 0%, #2575fc 100%)", icon: "🏢", desc: "Sede Central" },
    ]
  },
  {
    ciudad: "TGU",
    sedes: [
      { name: "Ceutec TGU (Prado)", color: "linear-gradient(135deg, #007adf 0%, #00ecbc 100%)", icon: "🏛️", desc: "Sede Prado" },
      { name: "Ceutec TGU (Centroamerica)", color: "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)", icon: "🎓", desc: "Sede Centroamérica" },
    ]
  },
  {
    ciudad: "LCE",
    sedes: [
      { name: "Ceutec LCE", color: "linear-gradient(135deg, #f857a6 0%, #ff5858 100%)", icon: "📖", desc: "Campus La Ceiba" }
    ]
  }
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
          <p>Selecciona la sede para gestionar espacios académicos:</p>
        </div>
        
        <div className="main-selection-layout" style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(3, 1fr)', 
          gap: '30px', 
          maxWidth: '1200px', 
          margin: '0 auto',
          alignItems: 'start'
        }}>
          
          {sedesPorCiudad.map((grupo) => (
            <div key={grupo.ciudad} className="column-group" style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '25px' 
            }}>
              {grupo.sedes.map((sede) => (
                <div 
                  key={sede.name} 
                  className="sede-card-big" 
                  onClick={() => handleSelect(sede.name)}
                  style={{ 
                      background: sede.color,
                      margin: '0',
                      width: '100%',
                      // 🔴 CORRECCIÓN: Altura mínima fija para homogeneizar todas las cards
                      minHeight: '280px', 
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      padding: '40px 20px' // Reducimos un poco el padding lateral
                  }}
                >
                  <div className="sede-card-icon" style={{ fontSize: '3.5rem' }}>{sede.icon}</div>
                  <div className="sede-card-info">
                    {/* 🔴 CORRECCIÓN: Tamaño de fuente dinámico para nombres largos */}
                    <h3 style={{ 
                        fontSize: sede.name.length > 20 ? '1.4rem' : '1.7rem',
                        lineHeight: '1.2',
                        marginBottom: '8px'
                    }}>
                        {sede.name}
                    </h3>
                    <span style={{ fontSize: '0.9rem', opacity: '0.8' }}>{sede.desc}</span>
                  </div>
                  <div className="sede-card-arrow" style={{ marginTop: '15px' }}>➜</div>
                </div>
              ))}
            </div>
          ))}

        </div>
      </div>
    </div>
  );
}