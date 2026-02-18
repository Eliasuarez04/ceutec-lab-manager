// src/pages/SpaceDetail.js
import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from '../context/AuthContext'; // IMPORTANTE
import './styles/SpaceDetail.css';
import './styles/Dashboard.css'; 

// Configuración de Permisos
const CITY_PERMISSIONS = {
  "San Pedro Sula": ["Ceutec SPS Norte", "Ceutec SPS Central"],
  "Tegucigalpa": ["Ceutec TGU (Prado)", "Ceutec TGU (Centroamerica)"],
  "La Ceiba": ["Ceutec LCE"]
};

export default function SpaceDetail() {
  const { spaceId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { userData } = useAuth(); // Datos del usuario
  
  const [space, setSpace] = useState(null);
  const [equipment, setEquipment] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const currentSede = searchParams.get('sede');
  const currentTipo = searchParams.get('tipo') || 'Aula';

  // --- LÓGICA DE PERMISO ---
  const userCity = userData?.city;
  const allowedSedes = CITY_PERMISSIONS[userCity] || [];
  const canReserve = userData?.role === 'superadmin' || allowedSedes.some(s => currentSede.includes(s) || s.includes(currentSede));
  // -------------------------

  useEffect(() => {
    const fetchSpaceDetails = async () => {
      try {
        setLoading(true);
        const docRef = doc(db, 'spaces', spaceId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
          setError('El espacio académico no existe.');
          setLoading(false);
          return;
        }

        const data = docSnap.data();
        setSpace({ id: docSnap.id, ...data });

        const equipRef = collection(db, 'spaces', spaceId, 'equipment');
        const equipSnap = await getDocs(equipRef);
        setEquipment(equipSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      } catch (err) {
        setError('Error de conexión con la base de datos.');
      } finally {
        setLoading(false);
      }
    };

    if (spaceId) fetchSpaceDetails();
  }, [spaceId]);

  if (loading) return <div className="dashboard-wrapper"><div className="loading-state">Cargando información...</div></div>;
  if (error) return <div className="dashboard-wrapper"><div className="error-card-detail"><h2>Oops!</h2><p>{error}</p><Link to={`/espacios?sede=${currentSede}`}>Volver al listado</Link></div></div>;

  return (
    <div className="dashboard-wrapper">
      <div className="detail-container">
        
        <div className="detail-nav">
            <Link 
                to={`/espacios?tipo=${currentTipo}&sede=${currentSede}`} 
                className="back-link-detail"
            >
            ← Volver a {currentTipo}s
            </Link>
            
            {/* BOTÓN RESERVAR CONDICIONAL */}
            {canReserve ? (
                <button 
                    className="direct-reserva-btn"
                    onClick={() => navigate(`/reservas?spaceId=${space.id}&sede=${currentSede}&tipo=${currentTipo}`)}
                >
                    📅 Reservar este espacio
                </button>
            ) : (
                <button 
                    className="direct-reserva-btn"
                    style={{background: '#95a5a6', cursor: 'not-allowed'}}
                    disabled
                >
                    ⛔ Disponible solo en {userCity}
                </button>
            )}
        </div>
        
        {space && (
          <div className="space-hero-card">
            <div className="hero-content">
                <div className="hero-main-info">
                    <span className={`type-tag ${space.type?.toLowerCase()}`}>{space.type}</span>
                    <h1>{space.name}</h1>
                    <p className="location-text">📍 {space.building} - Piso {space.floor} ({currentSede})</p>
                </div>
                <div className="capacity-badge-large">
                    <span className="cap-label">Capacidad</span>
                    <span className="cap-value">{space.capacity}</span>
                    <span className="cap-sub">Personas</span>
                </div>
            </div>
            
            <div className="space-description-box">
                <h3>Descripción del Espacio</h3>
                <p>{space.description || 'Actividades académicas generales según programación.'}</p>
            </div>
          </div>
        )}

        <div className="inventory-section floating-card">
          <h2 className="inventory-title">Equipamiento e Insumos</h2>
          {equipment.length === 0 ? (
            <div className="no-items">
                <p>No hay equipo asignado permanentemente.</p>
            </div>
          ) : (
            <table className="inventory-table-modern">
              <thead>
                <tr><th>Recurso</th><th>Cantidad</th><th>Estado</th></tr>
              </thead>
              <tbody>
                {equipment.map(item => (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td>{item.quantity} un.</td>
                    <td>{item.status || 'Disponible'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}