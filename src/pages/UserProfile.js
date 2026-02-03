import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { updateProfile } from 'firebase/auth';
import { doc, updateDoc, getDoc, collection, query, where, getCountFromServer } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import './styles/Dashboard.css'; // Reusamos estilos del dashboard

const UserProfile = () => {
  const { currentUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Estados de datos
  const [displayName, setDisplayName] = useState(currentUser?.displayName || '');
  const [department, setDepartment] = useState('');
  const [role, setRole] = useState('Docente');
  
  // Estadísticas
  const [stats, setStats] = useState({ totalReservations: 0, activeReservations: 0 });

  useEffect(() => {
    const fetchUserData = async () => {
      if (!currentUser?.uid) return;

      try {
        // 1. Obtener datos extendidos del usuario
        const userDocRef = doc(db, "users", currentUser.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          const data = userDoc.data();
          setDepartment(data.department || '');
          setRole(data.role || 'Docente');
        }

        // 2. Obtener estadísticas (Mejora solicitada)
        const reservationsRef = collection(db, "reservations");
        
        // Contar total histórico
        const qTotal = query(reservationsRef, where("userId", "==", currentUser.uid));
        const snapshotTotal = await getCountFromServer(qTotal);
        
        // Contar activas (Pendientes o Aprobadas que aún no terminan)
        // Nota: Simplificado para conteo rápido
        const qActive = query(
            reservationsRef, 
            where("userId", "==", currentUser.uid),
            where("endTime", ">=", new Date())
        );
        const snapshotActive = await getCountFromServer(qActive);

        setStats({
          totalReservations: snapshotTotal.data().count,
          activeReservations: snapshotActive.data().count
        });

      } catch (error) {
        console.error("Error cargando perfil:", error);
      }
    };
    fetchUserData();
  }, [currentUser]);

  const handleUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Actualizar Auth
      await updateProfile(currentUser, { displayName });

      // Actualizar Firestore
      const userRef = doc(db, "users", currentUser.uid);
      await updateDoc(userRef, {
        displayName, // Aseguramos consistencia
        department
      });

      toast.success("Perfil actualizado correctamente");
      setIsEditing(false);
    } catch (error) {
      console.error(error);
      toast.error("Error al actualizar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard-wrapper">
      <h1 className="dashboard-title">Mi Perfil</h1>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '2rem' }}>
        
        {/* COLUMNA IZQUIERDA: Formulario e Info */}
        <div className="dashboard-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '30px', borderBottom: '1px solid #eee', paddingBottom: '20px' }}>
            <div style={{ 
              width: '80px', height: '80px', borderRadius: '50%', background: '#c8102e', color: 'white', 
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem', fontWeight: 'bold'
            }}>
              {displayName.charAt(0)?.toUpperCase()}
            </div>
            <div>
              <h2 style={{ margin: 0 }}>{displayName}</h2>
              <p style={{ color: '#666', margin: '5px 0' }}>{currentUser?.email}</p>
              <span style={{ background: '#eee', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                {role.toUpperCase()}
              </span>
            </div>
          </div>

          {isEditing ? (
            <form onSubmit={handleUpdate}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Nombre Completo</label>
                <input 
                  type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                  style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '5px' }}
                />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Departamento / Facultad</label>
                <input 
                  type="text" value={department} onChange={(e) => setDepartment(e.target.value)}
                  placeholder="Ej. Facultad de Ingeniería"
                  style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '5px' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="button" onClick={() => setIsEditing(false)} style={{ padding: '10px 20px', border: 'none', background: '#ccc', borderRadius: '5px', cursor: 'pointer' }}>Cancelar</button>
                <button type="submit" disabled={loading} style={{ padding: '10px 20px', border: 'none', background: '#c8102e', color: 'white', borderRadius: '5px', cursor: 'pointer' }}>{loading ? 'Guardando...' : 'Guardar Cambios'}</button>
              </div>
            </form>
          ) : (
            <div>
              <p><strong>Departamento:</strong> {department || 'No especificado (Edita tu perfil para agregar)'}</p>
              <p><strong>ID Usuario:</strong> <span style={{ fontFamily: 'monospace', color: '#888' }}>{currentUser?.uid}</span></p>
              
              <button 
                onClick={() => setIsEditing(true)}
                style={{ marginTop: '20px', padding: '10px 20px', background: '#333', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
              >
                ✏️ Editar Información
              </button>
            </div>
          )}
        </div>

        {/* COLUMNA DERECHA: Estadísticas (Mejora) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            
            <div className="dashboard-card" style={{ textAlign: 'center', padding: '2rem' }}>
                <div style={{ fontSize: '3rem', fontWeight: 'bold', color: '#c8102e' }}>{stats.totalReservations}</div>
                <div style={{ color: '#666' }}>Reservas Totales</div>
            </div>

            <div className="dashboard-card" style={{ textAlign: 'center', padding: '2rem' }}>
                <div style={{ fontSize: '3rem', fontWeight: 'bold', color: '#1565c0' }}>{stats.activeReservations}</div>
                <div style={{ color: '#666' }}>Reservas Activas / Futuras</div>
            </div>

            <div className="dashboard-card">
                <h3>Accesos Rápidos</h3>
                <Link to="/mis-reservas" style={{ display: 'block', padding: '10px', textDecoration: 'none', color: '#333', borderBottom: '1px solid #eee' }}>
                    📋 Ver mi Historial
                </Link>
                <Link to="/reservas" style={{ display: 'block', padding: '10px', textDecoration: 'none', color: '#333' }}>
                    📅 Crear Nueva Reserva
                </Link>
            </div>

        </div>

      </div>
    </div>
  );
};

export default UserProfile;