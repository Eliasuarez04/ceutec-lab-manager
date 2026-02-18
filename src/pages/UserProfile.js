// src/pages/UserProfile.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { updateProfile } from 'firebase/auth';
import { doc, updateDoc, getDoc, collection, query, where, getDocs, limit, orderBy, getCountFromServer } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import toast from 'react-hot-toast';
import { Link, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import es from 'date-fns/locale/es';
import './styles/UserProfile.css'; 

const CITIES_LIST = ["San Pedro Sula", "Tegucigalpa", "La Ceiba"];
const FACULTADES_LIST = [
  "Ingeniería", "Ciencias de la Salud", "Ciencias Administrativas y Contables", 
  "Diseño y Comunicación", "Derecho", "Postgrado"
];

const UserProfile = () => {
  const { currentUser, userData } = useAuth();
  const [searchParams] = useSearchParams();
  const currentSede = searchParams.get('sede') || userData?.sede || "";

  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Campos del perfil
  const [displayName, setDisplayName] = useState('');
  const [faculty, setFaculty] = useState('');
  const [city, setCity] = useState('');
  const [th, setTh] = useState('');

  // Estadísticas
  const [recentReservations, setRecentReservations] = useState([]);
  const [stats, setStats] = useState({ totalReservations: 0, activeReservations: 0 });

  // ¿Es SuperAdmin?
  const isSuperAdmin = userData?.role === 'superadmin';

  useEffect(() => {
    const fetchProfileData = async () => {
      if (!currentUser?.uid) return;
      try {
        const userDocRef = doc(db, "users", currentUser.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
            const data = userDoc.data();
            setDisplayName(data.displayName || currentUser.displayName || '');
            
            // Cargamos datos. Si existen, ya no se podrán cambiar (salvo admin)
            setFaculty(data.faculty || '');
            setCity(data.city || '');
            setTh(data.th || '');
            
            // Si falta algún dato crítico, forzamos la edición
            if (!data.city || !data.th || !data.faculty) {
                setIsEditing(true);
            }
        }

        // Stats y Reservas
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
    
    if (!city || !th || !faculty) {
        toast.error("Todos los campos marcados con * son obligatorios.");
        return;
    }

    setLoading(true);
    try {
      await updateProfile(currentUser, { displayName });
      await updateDoc(doc(db, "users", currentUser.uid), { 
          displayName, 
          faculty,
          city, 
          th 
      });
      toast.success("Perfil guardado y asegurado.");
      setIsEditing(false);
    } catch (error) { 
        console.error(error);
        toast.error("Error al actualizar"); 
    } finally { 
        setLoading(false); 
    }
  };

  // COMPONENTE AUXILIAR PARA CAMPOS BLOQUEADOS
  const LockedField = ({ label, value, note }) => (
    <div className="form-group-profile">
        <label>{label}</label>
        <div className="locked-field-display" style={{
            background: '#e9ecef', padding: '10px', borderRadius: '8px', 
            border: '1px solid #ced4da', color: '#495057', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
            <span style={{fontWeight: '600'}}>{value}</span>
            <span title="Campo bloqueado permanentemente" style={{cursor: 'help'}}>🔒</span>
        </div>
        <small style={{color: '#6c757d', fontSize: '0.8rem'}}>
            {note || "Este dato no se puede modificar. Contacte al administrador."}
        </small>
    </div>
  );

  return (
    <div className="dashboard-wrapper">
      <div className="profile-container">
        
        <div className="profile-header-nav">
            <Link to={`/dashboard?sede=${currentSede}`} className="back-link-simple">
               ← Volver al Dashboard
            </Link>
        </div>

        <div className="profile-main-grid fade-in">
          
          {/* --- COLUMNA IZQUIERDA (DATOS) --- */}
          <div className="profile-info-column">
            <div className="profile-card-hero">
              <div className="profile-avatar-row">
                <div className="profile-avatar-big">
                    {displayName ? displayName.charAt(0).toUpperCase() : "U"}
                </div>
                <div className="profile-title-info">
                  <h1>{displayName || 'Usuario'}</h1>
                  <p>{currentUser?.email}</p>
                  <span className="role-badge-profile">{userData?.role?.toUpperCase()}</span>
                </div>
              </div>

              {isEditing ? (
                <form onSubmit={handleUpdate} className="edit-profile-form">
                  <div className="form-group-profile">
                    <label>Nombre Completo</label>
                    <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
                  </div>

                  {/* LOGICA DE CIUDAD: Si ya existe y no es admin, BLOQUEADO */}
                  {(userData?.city && !isSuperAdmin) ? (
                    <LockedField label="Ciudad Base" value={userData.city} />
                  ) : (
                    <div className="form-group-profile">
                        <label>Ciudad Base <span style={{color:'red'}}>*</span></label>
                        <select value={city} onChange={(e) => setCity(e.target.value)} required>
                            <option value="">Selecciona tu ciudad...</option>
                            {CITIES_LIST.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        {!userData?.city && <small className="warning-text">⚠️ Una vez guardada, no podrás cambiarla.</small>}
                    </div>
                  )}

                  {/* LOGICA DE TH: Si ya existe y no es admin, BLOQUEADO */}
                  {(userData?.th && !isSuperAdmin) ? (
                    <LockedField label="No. Empleado (TH)" value={userData.th} />
                  ) : (
                    <div className="form-group-profile">
                        <label>No. Empleado (TH) <span style={{color:'red'}}>*</span></label>
                        <input type="text" value={th} onChange={(e) => setTh(e.target.value)} required placeholder="Ej: 123456" />
                        {!userData?.th && <small className="warning-text">⚠️ Asegúrate de ingresarlo correctamente.</small>}
                    </div>
                  )}

                  {/* LOGICA DE FACULTAD: Si ya existe y no es admin, BLOQUEADO */}
                  {(userData?.faculty && !isSuperAdmin) ? (
                    <LockedField label="Facultad" value={userData.faculty} />
                  ) : (
                    <div className="form-group-profile">
                        <label>Facultad <span style={{color:'red'}}>*</span></label>
                        <select value={faculty} onChange={(e) => setFaculty(e.target.value)} required>
                            <option value="">Selecciona tu facultad...</option>
                            {FACULTADES_LIST.map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                    </div>
                  )}

                  <div className="profile-form-actions">
                    {(userData?.city && userData?.th && userData?.faculty) && (
                        <button type="button" onClick={() => setIsEditing(false)} className="btn-secondary-card">Cancelar</button>
                    )}
                    <button type="submit" disabled={loading} className="btn-primary-card">Confirmar Datos</button>
                  </div>
                </form>
              ) : (
                <div className="profile-details-view">
                  <div className="details-grid-profile">
                    <div className="detail-item-box">
                      <label>Ciudad</label>
                      <p>📍 {city}</p>
                    </div>
                    <div className="detail-item-box">
                      <label>TH</label>
                      <p>🆔 {th}</p>
                    </div>
                    <div className="detail-item-box">
                      <label>Facultad</label>
                      <p>🎓 {faculty}</p>
                    </div>
                  </div>
                  <button onClick={() => setIsEditing(true)} className="btn-edit-profile-trigger">
                    ✏️ Editar Perfil
                  </button>
                </div>
              )}
            </div>
            
            {/* Actividad Reciente */}
            <div className="dashboard-card recent-activity-card" style={{marginTop: '30px'}}>
              <h3>Actividad Reciente</h3>
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
              ) : <p className="empty-text">Sin reservas recientes.</p>}
            </div>
          </div>

          {/* --- COLUMNA DERECHA (ESTADÍSTICAS Y ACCESOS) --- */}
          <div className="profile-stats-column">
            <div className="dashboard-card stat-card-profile total-res">
              <span className="stat-value">{stats.totalReservations}</span>
              <span className="stat-label">Reservas Totales</span>
            </div>
            <div className="dashboard-card stat-card-profile active-res">
              <span className="stat-value">{stats.activeReservations}</span>
              <span className="stat-label">Pendientes</span>
            </div>

            {/* AQUI ESTAN LOS ACCESOS RÁPIDOS RESTAURADOS */}
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