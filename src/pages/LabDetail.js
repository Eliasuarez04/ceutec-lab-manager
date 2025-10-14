// src/pages/LabDetail.js
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import './styles/LabDetail.css';

export default function LabDetail() {
  const { labId } = useParams(); // Obtiene el ID del laboratorio desde la URL
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
    return <div className="page-container status-message">Cargando detalles...</div>;
  }

  if (error) {
    return <div className="page-container status-message error-message">{error}</div>;
  }

  return (
    <div className="page-container">
      <Link to="/laboratorios" className="back-link">← Volver a la lista de laboratorios</Link>
      
      {lab && (
        <div className="lab-header">
          <h1>{lab.name}</h1>
          <p className="lab-location">{lab.location}</p>
          <p className="lab-description">{lab.description}</p>
        </div>
      )}

      <div className="inventory-section">
        <h2>Equipamiento Disponible</h2>
        {equipment.length === 0 ? (
          <p>No hay equipamiento registrado para este laboratorio.</p>
        ) : (
          <table className="inventory-table">
            <thead>
              <tr>
                <th>Equipo</th>
                <th>Cantidad</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {equipment.map(item => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>{item.quantity}</td>
                  <td>
                    <span className={`status-badge status-${item.status?.toLowerCase()}`}>
                      {item.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

       {/* Futuro: Aquí puedes añadir otra tabla para "Insumos" */}
    </div>
  );
}