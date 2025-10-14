// src/pages/Laboratories.js
import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs, query, orderBy, where, Timestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import './styles/Laboratories.css';

// ===================================================================================
// Helper: Componente para el badge de estado
// Determina el estado actual de un laboratorio y muestra el badge correspondiente.
// ===================================================================================
const LabStatusBadge = ({ lab, reservations }) => {
  // El estado de mantenimiento tiene la máxima prioridad.
  if (lab.status === 'Mantenimiento') {
    return <span className="status-badge-lab status-mantenimiento">Mantenimiento</span>;
  }

  const now = new Date();
  // Comprueba si hay alguna reserva activa para este laboratorio en este momento.
  const isOccupied = reservations.some(res => 
    res.labId === lab.id &&
    now >= res.startTime.toDate() && 
    now < res.endTime.toDate()
  );

  if (isOccupied) {
    return <span className="status-badge-lab status-ocupado">Ocupado</span>;
  }

  // Si no está en mantenimiento ni ocupado, está disponible.
  return <span className="status-badge-lab status-disponible">Disponible</span>;
};


// ===================================================================================
// Componente Principal: Laboratories
// Muestra la lista de laboratorios con búsqueda y estado en tiempo real.
// ===================================================================================
export default function Laboratories() {
  const [labs, setLabs] = useState([]);
  const [reservations, setReservations] = useState([]); // Estado para todas las reservas
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState(''); // Estado para la búsqueda

  useEffect(() => {
    const fetchData = async () => {
      try {
        setError('');
        setLoading(true);
        
        // 1. Cargar todos los laboratorios, ordenados por nombre.
        const labsCollection = collection(db, 'laboratories');
        const qLabs = query(labsCollection, orderBy('name'));
        const labsSnapshot = await getDocs(qLabs);
        const labsData = labsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setLabs(labsData);

        // 2. Cargar todas las reservas activas o futuras para chequear el estado.
        const now = Timestamp.fromDate(new Date());
        const reservationsCollection = collection(db, 'reservations');
        // Solo necesitamos reservas cuyo tiempo de finalización aún no ha pasado.
        const qReservations = query(reservationsCollection, where('endTime', '>=', now));
        const reservationsSnapshot = await getDocs(qReservations);
        const reservationsData = reservationsSnapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
        setReservations(reservationsData);

      } catch (err) {
        console.error("Error fetching data:", err);
        setError('No se pudieron cargar los datos. Inténtalo de nuevo más tarde.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Filtra los laboratorios basándose en el término de búsqueda usando useMemo para optimizar.
  const filteredLabs = useMemo(() => 
    labs.filter(lab => 
      lab.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lab.location.toLowerCase().includes(searchTerm.toLowerCase())
    ), [labs, searchTerm]);

  if (loading) {
    return <div className="page-container status-message">Cargando laboratorios...</div>;
  }

  if (error) {
    return <div className="page-container status-message error-message">{error}</div>;
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Laboratorios Disponibles</h1>
          <p className="page-subtitle">Explora los espacios y el equipamiento que la universidad tiene para ti.</p>
        </div>
        <div className="search-bar-container">
          <input 
            type="text"
            placeholder="Buscar por nombre o ubicación..."
            className="search-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>
      
      {filteredLabs.length === 0 ? (
        <p className="status-message">
          {searchTerm ? 'No se encontraron laboratorios que coincidan con tu búsqueda.' : 'No hay laboratorios registrados por el momento.'}
        </p>
      ) : (
        <div className="labs-grid">
          {filteredLabs.map(lab => (
            <div key={lab.id} className="lab-card-wrapper">
              <LabStatusBadge lab={lab} reservations={reservations} />
              <Link 
                to={`/laboratorios/${lab.id}`} 
                className={`lab-card-link ${lab.status !== 'Disponible' ? 'disabled-link' : ''}`}
                // Prevenir click si no está disponible (opcional)
                onClick={(e) => { if (lab.status !== 'Disponible') e.preventDefault(); }}
              >
                <div className="lab-card">
                  <div className="lab-card-icon">🔬</div>
                  <h3 className="lab-card-title">{lab.name}</h3>
                  <p className="lab-card-location">{lab.location}</p>
                  <div className="lab-card-footer">
                    <span>
                      {lab.status === 'Disponible' ? 'Ver Inventario →' : 'No disponible'}
                    </span>
                  </div>
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}