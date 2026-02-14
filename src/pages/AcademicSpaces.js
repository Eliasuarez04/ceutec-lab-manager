// src/pages/AcademicSpaces.js
import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { db } from '../firebaseConfig';
import { collection, getDocs } from 'firebase/firestore';
import './styles/AcademicSpaces.css';

export default function AcademicSpaces() {
  const [spaces, setSpaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  
  const urlTipo = queryParams.get('tipo') || 'Aula'; 
  const currentSede = queryParams.get('sede') || ""; 

  useEffect(() => {
    const fetchSpaces = async () => {
      setLoading(true);
      try {
        const snap = await getDocs(collection(db, 'spaces'));
        const rawData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const filtered = rawData.filter(s => {
            const sedeBD = (s.sede || s.campus || s.Sede || s.Campus || "").toLowerCase();
            const sedeBusqueda = currentSede.toLowerCase().replace('ceutec', '').replace('sps', '').trim();
            const tipoBD = (s.type || s.tipo || s.Type || s.Tipo || "").toLowerCase();
            const tipoBusqueda = urlTipo.toLowerCase().trim();

            const coincideSede = sedeBD.includes(sedeBusqueda) || sedeBusqueda.includes(sedeBD);
            const coincideTipo = tipoBD.includes(tipoBusqueda) || tipoBusqueda.includes(tipoBD);

            return coincideSede && coincideTipo;
        });

        filtered.sort((a, b) => (a.name || a.Nombre || "").localeCompare(b.name || b.Nombre || ""));
        setSpaces(filtered);
      } catch (error) {
        console.error("Error cargando espacios:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchSpaces();
  }, [currentSede, urlTipo]);

  const filteredSpaces = useMemo(() => {
    return spaces.filter(s => {
      const nom = (s.name || s.Nombre || s.id || "").toLowerCase();
      return nom.includes(searchTerm.toLowerCase());
    });
  }, [spaces, searchTerm]);

  const getSedeClass = (sedeName) => {
    const s = sedeName.toLowerCase();
    if (s.includes('norte')) return 'sede-norte';
    if (s.includes('prado')) return 'sede-prado';
    if (s.includes('central')) return 'sede-central';
    if (s.includes('centroamerica') || s.includes('ca')) return 'sede-ca';
    if (s.includes('lce') || s.includes('ceiba')) return 'sede-lce';
    return '';
  };

  return (
    <div className="dashboard-wrapper">
      <div className="labs-page-card">
        
        <header className="page-header-header">
          <Link to={`/dashboard?sede=${currentSede}`} className="back-link-simple">
            ← Volver al Dashboard
          </Link>
          <div className="title-area">
            <h1>{urlTipo === 'Aula' ? '🏫 Aulas' : '🔬 Laboratorios'}</h1>
            <p>Sede: <strong>{currentSede}</strong></p>
          </div>
        </header>

        <div className="filters-glass-bar">
          <div className="filter-item search-grow">
            <label>Buscador de {urlTipo}s</label>
            <div className="search-input-wrapper">
              <span className="search-icon-inside">🔍</span>
              <input 
                type="text" 
                placeholder="Nombre, número o edificio..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>

        {loading ? (
            <div className="loading-state-simple">Analizando registros de {currentSede}...</div>
        ) : (
          <div className="labs-grid">
            {filteredSpaces.length > 0 ? (
              filteredSpaces.map(space => (
                <div key={space.id} className={`lab-card-modern ${getSedeClass(currentSede)}`}>
                  <div className="sede-tag-badge">Capacidad: {space.capacity || space.Capacidad || 'N/A'}</div>
                  
                  <div className="card-icon-container">
                      {urlTipo === 'Aula' ? '📖' : '🔬'}
                  </div>
                  
                  <div className="card-body-content">
                    <h3>{space.name || space.Nombre || space.id}</h3>
                    <div className="space-meta">
                        <p>📍 {space.building || space.Edificio || 'Edificio'} - Piso {space.floor || space.Piso || '1'}</p>
                        <span className="space-id-tag">ID: {space.id}</span>
                    </div>
                  </div>

                  <div className="card-actions-row">
                    {/* CORRECCIÓN: Pasamos tipo y sede al detalle */}
                    <Link 
                      to={`/espacios/${space.id}?tipo=${urlTipo}&sede=${currentSede}`} 
                      className="btn-action-secondary"
                    >
                      Detalles
                    </Link>
                    <Link 
                      to={`/reservas?spaceId=${space.id}&sede=${currentSede}&tipo=${urlTipo}`} 
                      className="btn-action-primary"
                    >
                      Ver Calendario →
                    </Link>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-results">
                <p>No se encontraron {urlTipo}s registrados para <strong>{currentSede}</strong>.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}