import React, { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { db } from '../../firebaseConfig';
import { collection, getDocs, updateDoc, doc, query, where, orderBy } from 'firebase/firestore';
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

  const getAllowedSedes = (userCity) => {
    const cityKey = userCity || userData?.city;
    return REGION_MAPPING[cityKey] || ALL_SEDES;
  };

  const fetchUsers = async () => {
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
  };

  useEffect(() => {
    if (userData) fetchUsers();
  }, [userData]);

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