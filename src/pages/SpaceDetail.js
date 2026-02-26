// src/pages/SpaceDetail.js
import React, { useState, useEffect, useMemo } from 'react'; // 🔴 Añadimos useMemo
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from '../context/AuthContext'; 
import './styles/SpaceDetail.css';
import './styles/Dashboard.css'; 

const CITY_PERMISSIONS = {
  "San Pedro Sula": ["Ceutec SPS Norte", "Ceutec SPS Central"],
  "Tegucigalpa": ["Ceutec TGU (Prado)", "Ceutec TGU (Centroamerica)"],
  "La Ceiba": ["Ceutec LCE"]
};

export default function SpaceDetail() {
  const { spaceId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { userData } = useAuth(); 
  
  const [space, setSpace] = useState(null);
  const [equipment, setEquipment] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // 🔴 NUEVO ESTADO PARA LA BÚSQUEDA
  const [searchTerm, setSearchTerm] = useState('');

  const currentSede = searchParams.get('sede');
  const currentTipo = searchParams.get('tipo') || 'Aula';

  const userCity = userData?.city;
  const allowedSedes = CITY_PERMISSIONS[userCity] || [];
  const canReserve = userData?.role === 'superadmin' || allowedSedes.some(s => currentSede.includes(s) || s.includes(currentSede));

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

  // 🔴 LÓGICA DE FILTRADO EN TIEMPO REAL
  const filteredEquipment = useMemo(() => {
    return equipment.filter(item => 
      item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.brand?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [equipment, searchTerm]);

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
          {/* 🔴 CABECERA CON BUSCADOR */}
          <div className="inventory-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
            <h2 className="inventory-title" style={{ margin: 0 }}>Equipamiento e Insumos</h2>
            
            <div className="search-box-inventory" style={{ position: 'relative', width: '300px' }}>
               <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>🔍</span>
               <input 
                 type="text" 
                 placeholder="Buscar por nombre o marca..." 
                 value={searchTerm}
                 onChange={(e) => setSearchTerm(e.target.value)}
                 style={{
                   width: '100%',
                   padding: '10px 15px 10px 40px',
                   borderRadius: '12px',
                   border: '1.5px solid #edf2f7',
                   outline: 'none',
                   fontSize: '0.9rem',
                   transition: '0.3s'
                 }}
                 className="inventory-search-input"
               />
            </div>
          </div>

          {equipment.length === 0 ? (
            <div className="no-items">
                <p>No hay equipo asignado permanentemente.</p>
            </div>
          ) : filteredEquipment.length === 0 ? (
            /* 🔴 MENSAJE SI NO HAY RESULTADOS EN LA BÚSQUEDA */
            <div className="no-results-inventory" style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                <p>No se encontraron recursos que coincidan con "<strong>{searchTerm}</strong>".</p>
            </div>
          ) : (
            <table className="inventory-table-modern">
              <thead>
                <tr><th>Recurso</th><th>Cantidad</th><th>Estado</th></tr>
              </thead>
              <tbody>
                {filteredEquipment.map(item => (
                  <tr key={item.id}>
                    <td>
                        <div style={{ fontWeight: '700' }}>{item.name}</div>
                        {item.brand && <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: '500' }}>{item.brand} {item.model}</div>}
                    </td>
                    <td>{item.quantity} un.</td>
                    <td><span className={`status-badge-small ${item.status?.toLowerCase().replace(/\s+/g, '-') || 'disponible'}`}>{item.status || 'Disponible'}</span></td>
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