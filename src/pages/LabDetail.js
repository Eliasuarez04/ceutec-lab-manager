// src/pages/LabDetail.js
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import './styles/LabDetail.css';
import './styles/Dashboard.css'; // Para el fondo animado global

export default function LabDetail() {
  const { labId } = useParams();
  const [lab, setLab] = useState(null);
  const [equipment, setEquipment] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchLabDetails = async () => {
      try {
        setLoading(true);
        setError('');
        
        // 1. Obtener datos del laboratorio
        const labDocRef = doc(db, 'laboratories', labId);
        const labDoc = await getDoc(labDocRef);

        if (!labDoc.exists()) {
          setError('El laboratorio no fue encontrado.');
          return;
        }
        setLab({ id: labDoc.id, ...labDoc.data() });

        // 2. Obtener el equipamiento de la subcolección
        const equipmentColRef = collection(labDocRef, 'equipment');
        const equipmentSnapshot = await getDocs(equipmentColRef);
        const equipmentData = equipmentSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setEquipment(equipmentData);

      } catch (err) {
        console.error("Error fetching lab details:", err);
        setError('Ocurrió un error al cargar los detalles del laboratorio.');
      } finally {
        setLoading(false);
      }
    };

    fetchLabDetails();
  }, [labId]);

  if (loading) {
    return <div className="dashboard-wrapper"><div className="detail-container status-message">Cargando detalles...</div></div>;
  }

  if (error) {
    return <div className="dashboard-wrapper"><div className="detail-container status-message error-message">{error}</div></div>;
  }

  // Asegura que el estado se formatee correctamente para el badge
  const getStatusText = (item) => {
    if (item.status) return item.status;
    return item.quantity > 0 ? 'Disponible' : 'Agotado';
  };

  return (
    <div className="dashboard-wrapper"> {/* Aplica el fondo animado */}
      <div className="detail-container">
        
        <Link to="/laboratorios" className="back-link">
          ← Volver a la lista de laboratorios
        </Link>
        
        {lab && (
          <div className="lab-header floating-card"> {/* TARJETA FLOTANTE */}
            <span className={`lab-main-status status-${lab.status?.toLowerCase() || 'disponible'}`}>
                {lab.status || 'Disponible'}
            </span>
            <h1 className="lab-title">{lab.name}</h1>
            <p className="lab-location">{lab.location}</p>
            <p className="lab-description">{lab.description}</p>
          </div>
        )}

        <div className="inventory-section floating-card"> {/* TARJETA FLOTANTE */}
          <h2 className="inventory-title">Equipamiento Disponible</h2>
          {equipment.length === 0 ? (
            <p className="no-equipment-message">No hay equipamiento registrado para este laboratorio.</p>
          ) : (
            <table className="inventory-table">
              <thead>
                <tr>
                  <th>Equipo</th>
                  <th>Cantidad en Stock</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {equipment.map(item => (
                  <tr key={item.id}>
                    <td className="equipment-name-col">{item.name}</td>
                    <td className="quantity-col">{item.quantity}</td>
                    <td>
                      <span className={`status-badge status-${getStatusText(item).toLowerCase().replace(/ /g, '-')}`}>
                        {getStatusText(item)}
                      </span>
                    </td>
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