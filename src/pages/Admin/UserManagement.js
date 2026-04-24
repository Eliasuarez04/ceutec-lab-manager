import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { db } from '../../firebaseConfig';
// 🔥 Importamos setDoc y Timestamp para la nueva función
import { collection, getDocs, updateDoc, doc, query, where, orderBy, setDoc, Timestamp } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

const REGION_MAPPING = {
  "San Pedro Sula": ["Ceutec SPS Norte", "Ceutec SPS Central"],
  "Tegucigalpa": ["Ceutec TGU (Prado)", "Ceutec TGU (Centroamerica)"],
  "La Ceiba": ["Ceutec LCE"]
};

const ALL_SEDES = [
  "Ceutec SPS Norte", "Ceutec SPS Central", "Ceutec TGU (Prado)", "Ceutec TGU (Centroamerica)", "Ceutec LCE"
];

const rolesList = [
    { id: 'docente', name: 'Docente' },
    { id: 'coordinador', name: 'Coordinador' },
    { id: 'coord_labs', name: 'Coordinador de Laboratorios' },
    { id: 'coord_aulas', name: 'Coordinador de Aulas' },
    { id: 'superadmin', name: 'Super Admin' }
];

export default function UserManagement() {
  const { userData } = useAuth();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const currentSede = queryParams.get('sede') || userData?.sede || ""; 

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editSede, setEditSede] = useState({});
  const [editRole, setEditRole] = useState({});

  // 🔥 Estados para el panel de SuperAdmin
  const [newTeacherName, setNewTeacherName] = useState('');
  const [newTeacherTH, setNewTeacherTH] = useState('');
  const [isAddingTeacher, setIsAddingTeacher] = useState(false);

  const getAllowedSedes = (userCity) => {
    const cityKey = userCity || userData?.city;
    return REGION_MAPPING[cityKey] || ALL_SEDES;
  };

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      let q;
      const usersRef = collection(db, "users");

      if (userData.role === 'superadmin') {
        q = query(usersRef, orderBy("email"));
      } else {
        // Coordinadores: Ver solo su facultad y rol docente
        q = query(
          usersRef, 
          where("faculty", "==", userData.faculty),
          where("role", "==", "docente") 
        );
      }

      const snap = await getDocs(q);
      let userList = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      // FILTRADO ESTRICTO POR CIUDAD (CLIENT-SIDE)
      if (userData.role !== 'superadmin') {
          userList = userList.filter(u => {
              // 1. Mostrar si el usuario NO tiene ciudad asignada (es nuevo, pendiente de configurar)
              if (!u.city) return true;
              
              // 2. Mostrar si el usuario tiene la MISMA ciudad que el coordinador
              return u.city === userData.city;
          });
      }

      userList.sort((a, b) => (a.active === b.active ? 0 : a.active ? 1 : -1));
      setUsers(userList);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Error al cargar usuarios.");
    }
    setLoading(false);
  }, [userData]);

  useEffect(() => {
    if (userData) fetchUsers();
  }, [fetchUsers, userData]);

  const handleUpdateUser = async (userId, currentData) => {
    const newRole = editRole[userId] || currentData.role;
    const newSede = editSede[userId] || currentData.sede;

    if (!newSede) {
      toast.error("Por favor asigna una sede al docente.");
      return;
    }

    try {
      await updateDoc(doc(db, "users", userId), {
        active: true,
        role: newRole,
        sede: newSede
      });
      toast.success("Usuario actualizado correctamente.");
      fetchUsers();
    } catch (e) {
      toast.error("Error al actualizar.");
    }
  };

  // 🔥 Nueva Función para Habilitar Docentes
  const handleAddTeacher = async (e) => {
    e.preventDefault();
    if (!newTeacherName || !newTeacherTH) return toast.error("Llena ambos campos");
    
    setIsAddingTeacher(true);
    const toastId = toast.loading("Guardando docente...");

    try {
      const thClean = newTeacherTH.trim();
      
      // Creamos el documento usando el TH como ID de documento en active_teachers_list
      await setDoc(doc(db, 'active_teachers_list', thClean), {
        th: thClean,
        name: newTeacherName.trim().toUpperCase(),
        email: "Pendiente de Registro", // Placeholder
        lastUpdate: Timestamp.now()
      });

      toast.success(`Docente ${thClean} habilitado con éxito`, { id: toastId });
      
      setNewTeacherName('');
      setNewTeacherTH('');
    } catch (err) {
      console.error(err);
      toast.error("Error al guardar en base de datos", { id: toastId });
    } finally {
      setIsAddingTeacher(false);
    }
  };

  return (
    <div className="dashboard-wrapper">
      <div style={{ maxWidth: '1400px', margin: '0 auto', width: '100%', marginBottom: '20px' }}>
        <Link 
            to={`/?sede=${encodeURIComponent(currentSede)}`} 
            className="back-link-simple"
            style={{ textDecoration: 'none', color: '#c8102e', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
        >
          ← Volver al Dashboard
        </Link>
      </div>

      <div className="manager-card fade-in">
        <header className="page-header" style={{ marginBottom: '30px', borderBottom: '1px solid #eee', paddingBottom: '20px' }}>
            <h1>👥 Gestión de Usuarios</h1>
            <p style={{ color: '#666', marginTop: '5px' }}>
                {userData?.role === 'superadmin' 
                    ? 'Panel Nacional - Control Total' 
                    : `Aprobaciones ${userData.city || ''} - Facultad ${userData?.faculty}`}
            </p>
        </header>

        {/* 🔥 PANEL EXCLUSIVO PARA SUPERADMIN: HABILITAR DOCENTES 🔥 */}
        {userData?.role === 'superadmin' && (
          <div style={{ background: 'white', padding: '25px', borderRadius: '20px', marginBottom: '35px', borderLeft: '8px solid #166534', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', border: '1px solid #edf2f7' }}>
            <h3 style={{ margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '10px', color: '#1e293b' }}>
              <span style={{ fontSize: '1.3rem' }}>👨‍🏫</span> Habilitar Docente (Malla Académica)
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.95rem', marginBottom: '20px' }}>
              Añade el Nombre y el TH de un docente inactivo para permitirle registrarse en la plataforma de forma automática.
            </p>
            
            <form onSubmit={handleAddTeacher} style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              
              <div style={{ flex: '2', minWidth: '220px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ color: '#166534', fontSize: '0.8rem', fontWeight: '800', textTransform: 'uppercase' }}>Nombre Completo</label>
                <input 
                  type="text" 
                  placeholder="Ej. MARIO LEONEL CASTILLO" 
                  value={newTeacherName} 
                  onChange={(e) => setNewTeacherName(e.target.value)} 
                  required 
                  style={{ padding: '12px 15px', borderRadius: '12px', border: '2px solid #edf2f7', outline: 'none', fontSize: '0.95rem' }}
                />
              </div>

              <div style={{ flex: '1', minWidth: '120px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ color: '#166534', fontSize: '0.8rem', fontWeight: '800', textTransform: 'uppercase' }}>No. Empleado (TH)</label>
                <input 
                  type="number" 
                  placeholder="Ej. 10411" 
                  value={newTeacherTH} 
                  onChange={(e) => setNewTeacherTH(e.target.value)} 
                  required 
                  style={{ padding: '12px 15px', borderRadius: '12px', border: '2px solid #edf2f7', outline: 'none', fontSize: '0.95rem' }}
                />
              </div>

              <button 
                type="submit" 
                disabled={isAddingTeacher}
                style={{ 
                  height: '46px', 
                  flex: '1', 
                  minWidth: '150px', 
                  background: isAddingTeacher ? '#14532d' : '#166534',
                  color: 'white',
                  fontWeight: '800',
                  border: 'none',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  transition: '0.3s'
                }}
              >
                {isAddingTeacher ? 'Guardando...' : '+ Autorizar Docente'}
              </button>
            </form>
          </div>
        )}

        {loading ? <div className="loading-state">Cargando lista de usuarios...</div> : (
          <div className="table-wrapper">
            <table className="inventory-table-manager" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '2px solid #eee' }}>
                  <th style={{ padding: '15px' }}>Usuario / Ciudad</th>
                  <th>Facultad</th>
                  <th>Estado</th>
                  <th>Configuración (Rol / Sede)</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                    <tr><td colSpan="5" style={{textAlign: 'center', padding: '50px', color: '#94a3b8'}}>No se encontraron usuarios para gestionar.</td></tr>
                ) : (
                    users.map(u => {
                        const availableSedesForUser = getAllowedSedes(u.city);
                        return (
                          <tr key={u.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '15px' }}>
                                <div style={{fontWeight: '700', color: '#1a202c'}}>{u.email}</div>
                                <div style={{fontSize: '0.8rem', color: '#64748b'}}>{u.city || "Ciudad no definida"}</div>
                            </td>
                            <td style={{ fontWeight: '600' }}>{u.faculty}</td>
                            <td>
                              <span className={`status-badge ${u.active ? 'status-disponible' : 'status-en-mantenimiento'}`}>
                                {u.active ? 'Activo' : 'Pendiente'}
                              </span>
                            </td>
                            <td>
                              <div style={{display: 'flex', flexDirection: 'column', gap: '6px', padding: '10px 0'}}>
                                  <select 
                                    value={editRole[u.id] || u.role || 'docente'} 
                                    onChange={(e) => setEditRole({...editRole, [u.id]: e.target.value})}
                                    disabled={userData.role !== 'superadmin'} 
                                    style={{ padding: '8px', borderRadius: '8px', border: '1px solid #edf2f7', fontSize: '0.85rem' }}
                                  >
                                    {rolesList.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                  </select>

                                  <select 
                                    value={editSede[u.id] || u.sede || ''} 
                                    onChange={(e) => setEditSede({...editSede, [u.id]: e.target.value})}
                                    style={{ padding: '8px', borderRadius: '8px', fontSize: '0.85rem', border: (editSede[u.id] || u.sede) ? '1px solid #edf2f7' : '2px solid #ff9800' }}
                                  >
                                    <option value="" disabled>Asignar Sede...</option>
                                    {availableSedesForUser.map(s => <option key={s} value={s}>{s}</option>)}
                                  </select>
                              </div>
                            </td>
                            <td>
                              <button className="action-btn save-btn" onClick={() => handleUpdateUser(u.id, u)} disabled={(!u.active && !editSede[u.id] && !u.sede)} style={{ background: u.active ? '#1e293b' : '#c8102e', color: 'white', padding: '10px 20px', borderRadius: '10px', border: 'none', fontWeight: 'bold', cursor: 'pointer', width: '100%' }}>
                                {u.active ? 'Guardar' : 'Aprobar'}
                              </button>
                            </td>
                          </tr>
                        );
                    })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}