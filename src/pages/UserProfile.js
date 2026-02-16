import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { updateProfile } from 'firebase/auth';
import { doc, updateDoc, getDoc, collection, query, where, getDocs, limit, orderBy, getCountFromServer } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import toast from 'react-hot-toast';
import { Link, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import es from 'date-fns/locale/es';
import './styles/UserProfile.css'; // <--- IMPORTACIÓN DEL NUEVO CSS

const facultadesList = [
  "Ingeniería", "Ciencias de la Salud", "Ciencias Administrativas y Contables", 
  "Diseño y Comunicación", "Derecho", "Postgrado"
];

const UserProfile = () => {
  const { currentUser, userData } = useAuth();
  const [searchParams] = useSearchParams();
  const currentSede = searchParams.get('sede') || userData?.sede || "";

  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [displayName, setDisplayName] = useState(currentUser?.displayName || '');
  const [faculty, setFaculty] = useState('');
  const [recentReservations, setRecentReservations] = useState([]);
  const [stats, setStats] = useState({ totalReservations: 0, activeReservations: 0 });

  useEffect(() => {
    const fetchProfileData = async () => {
      if (!currentUser?.uid) return;
      try {
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        if (userDoc.exists()) setFaculty(userDoc.data().faculty || '');

        const resRef = collection(db, "reservations");
        const qTotal = query(resRef, where("userId", "==", currentUser.uid));
        const snapTotal = await getCountFromServer(qTotal);
        
        const qActive = query(resRef, where("userId", "==", currentUser.uid), where("fulfillmentStatus", "==", "Pendiente"));
        const snapActive = await getCountFromServer(qActive);

        setStats({
          totalReservations: snapTotal.data().count,
          activeReservations: snapActive.data().count
        });

        const qRecent = query(resRef, where("userId", "==", currentUser.uid), orderBy("startTime", "desc"), limit(3));
        const snapRecent = await getDocs(qRecent);
        setRecentReservations(snapRecent.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (error) { console.error(error); }
    };
    fetchProfileData();
  }, [currentUser]);

  const handleUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await updateProfile(currentUser, { displayName });
      await updateDoc(doc(db, "users", currentUser.uid), { displayName, faculty });
      toast.success("Perfil actualizado");
      setIsEditing(false);
    } catch (error) { toast.error("Error al actualizar"); }
    finally { setLoading(false); }
  };

  return (
    <div className="dashboard-wrapper">
      <div className="profile-container">
        
        <div className="profile-header-nav">
            <Link to={`/dashboard?sede=${currentSede}`} className="back-link-simple">
               ← Volver al Dashboard
            </Link>
        </div>

        <div className="profile-main-grid fade-in">
          
          {/* COLUMNA IZQUIERDA */}
          <div className="profile-info-column">
            <div className="profile-card-hero">
              <div className="profile-avatar-row">
                <div className="profile-avatar-big">
                  {displayName ? displayName.charAt(0).toUpperCase() : "?"}
                </div>
                <div className="profile-title-info">
                  <h1>{displayName || 'Docente Portal'}</h1>
                  <p>{currentUser?.email}</p>
                  <span className="role-badge-profile">{userData?.role?.replace('_', ' ') || 'DOCENTE'}</span>
                </div>
              </div>

              {isEditing ? (
                <form onSubmit={handleUpdate} className="edit-profile-form">
                  <div className="form-group-profile">
                    <label>Nombre Completo</label>
                    <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
                  </div>
                  <div className="form-group-profile">
                    <label>Facultad Asignada</label>
                    <select value={faculty} onChange={(e) => setFaculty(e.target.value)}>
                      <option value="">Selecciona facultad...</option>
                      {facultadesList.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                  <div className="card-actions-row">
                    <button type="button" onClick={() => setIsEditing(false)} className="btn-secondary-card">Cancelar</button>
                    <button type="submit" disabled={loading} className="btn-primary-card">Guardar Perfil</button>
                  </div>
                </form>
              ) : (
                <div className="profile-details-view">
                  <div className="details-grid-profile">
                    <div className="detail-item-box">
                      <label>Facultad / Depto</label>
                      <p>{faculty || 'No especificada'}</p>
                    </div>
                    <div className="detail-item-box">
                      <label>ID de Registro</label>
                      <p><code>{currentUser?.uid.substring(0, 12)}...</code></p>
                    </div>
                  </div>
                  <button onClick={() => setIsEditing(true)} className="btn-edit-profile-trigger">
                    ✏️ Editar Información
                  </button>
                </div>
              )}
            </div>

            {/* ACTIVIDAD RECIENTE */}
            <div className="dashboard-card recent-activity-card" style={{marginTop: '30px'}}>
              <h3 style={{fontWeight: '800', marginBottom: '20px'}}>Actividad Reciente</h3>
              {recentReservations.length > 0 ? (
                <div className="activity-list">
                  {recentReservations.map(res => (
                    <div key={res.id} className="activity-item">
                      <div className="activity-info">
                        <strong>{res.labName}</strong>
                        <small>{format(res.startTime.toDate(), "d 'de' MMMM", { locale: es })}</small>
                      </div>
                      <span className={`status-dot ${res.fulfillmentStatus?.toLowerCase()}`}></span>
                    </div>
                  ))}
                </div>
              ) : <p className="empty-text">Sin reservas recientes en esta sede.</p>}
            </div>
          </div>

          {/* COLUMNA DERECHA */}
          <div className="profile-stats-column">
            <div className="dashboard-card stat-card-profile total-res">
              <span className="stat-value">{stats.totalReservations}</span>
              <span className="stat-label">Reservas Totales</span>
            </div>

            <div className="dashboard-card stat-card-profile active-res">
              <span className="stat-value">{stats.activeReservations}</span>
              <span className="stat-label">Pendientes</span>
            </div>

            <div className="dashboard-card quick-links-card">
              <h3>Accesos Rápidos</h3>
              <div className="quick-links-stack">
                  <Link to={`/mis-reservas?sede=${currentSede}`} className="nav-link-profile">
                      <span className="nav-icon">📋</span>
                      <div className="nav-text">
                        <h4>Mi Historial</h4>
                        <p>Ver mis registros</p>
                      </div>
                  </Link>
                  <Link to={`/reservas?tipo=Aula&sede=${currentSede}`} className="nav-link-profile">
                      <span className="nav-icon">🏫</span>
                      <div className="nav-text">
                        <h4>Reservar Aula</h4>
                        <p>Espacios teóricos</p>
                      </div>
                  </Link>
                  <Link to={`/reservas?tipo=Laboratorio&sede=${currentSede}`} className="nav-link-profile">
                      <span className="nav-icon">🧪</span>
                      <div className="nav-text">
                        <h4>Reservar Lab</h4>
                        <p>Talleres técnicos</p>
                      </div>
                  </Link>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default UserProfile;