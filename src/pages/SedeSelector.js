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
      
      {/* 🔥 ESTILOS INYECTADOS PARA HACERLO 100% RESPONSIVO 🔥 */}
      <style>
        {`
          .main-selection-layout {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 30px;
            max-width: 1200px;
            margin: 0 auto;
            align-items: start;
          }
          .column-group {
            display: flex;
            flex-direction: column;
            gap: 25px;
          }
          .card-sede-estilizada {
            margin: 0;
            width: 100%;
            min-height: 280px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            padding: 40px 20px;
          }
          .icono-sede {
            font-size: 3.5rem;
          }
          .titulo-sede {
            line-height: 1.2;
            margin-bottom: 8px;
          }

          /* 📱 MAGIA RESPONSIVA PARA MÓVILES Y TABLETS 📱 */
          @media (max-width: 900px) {
            .main-selection-layout {
              grid-template-columns: 1fr; /* Convierte a 1 sola columna */
              gap: 15px;
            }
            .column-group {
              gap: 15px; /* Reduce el espacio entre tarjetas del mismo grupo */
            }
            .card-sede-estilizada {
              min-height: 160px; /* Las hace más compactas en móvil */
              padding: 25px 20px;
            }
            .icono-sede {
              font-size: 2.5rem !important; /* Ícono más pequeño */
              margin-bottom: 5px;
            }
            .titulo-sede {
              font-size: 1.3rem !important; /* Forzamos texto legible que no se desborde */
            }
          }
        `}
      </style>

      <div className="sede-selector-container fade-in">
        
        <div className="selector-header">
          <h1>¡Bienvenido! 👋</h1>
          <p>Selecciona la sede para gestionar espacios académicos:</p>
        </div>
        
        <div className="main-selection-layout">
          
          {sedesPorCiudad.map((grupo) => (
            <div key={grupo.ciudad} className="column-group">
              {grupo.sedes.map((sede) => (
                <div 
                  key={sede.name} 
                  className="sede-card-big card-sede-estilizada" 
                  onClick={() => handleSelect(sede.name)}
                  style={{ background: sede.color }}
                >
                  <div className="sede-card-icon icono-sede">{sede.icon}</div>
                  <div className="sede-card-info">
                    <h3 className="titulo-sede" style={{ 
                        fontSize: sede.name.length > 20 ? '1.4rem' : '1.7rem'
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