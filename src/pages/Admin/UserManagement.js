import React, { useState, useEffect } from 'react';
import { db } from '../../firebaseConfig';
import { collection, getDocs, updateDoc, doc, query, where, orderBy } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

const sedesList = [
  "Ceutec SPS Norte", 
  "Ceutec SPS Central", 
  "Ceutec TGU (Prado)", 
  "Ceutec TGU (Centroamerica)", 
  "Ceutec LCE"
];

const rolesList = [
    { id: 'docente', name: 'Docente' },
    { id: 'coordinador', name: 'Coordinador' },
    { id: 'coord_labs', name: 'Coordinador de Laboratorios' },
    { id: 'superadmin', name: 'Super Admin' }
];

export default function UserManagement() {
  const { userData } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estados temporales para ediciones
  const [editSede, setEditSede] = useState({});
  const [editRole, setEditRole] = useState({});

  const fetchUsers = async () => {
    setLoading(true);
    try {
      let q;
      if (userData.role === 'superadmin') {
        // Superadmin ve a todos los usuarios para poder asignar roles especiales
        q = query(collection(db, "users"), orderBy("email"));
      } else {
        // Coordinadores solo ven docentes inactivos de su facultad para aprobar
        q = query(
          collection(db, "users"), 
          where("active", "==", false),
          where("faculty", "==", userData.faculty)
        );
      }

      const snap = await getDocs(q);
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.error(error);
      toast.error("Error al cargar usuarios");
    }
    setLoading(false);
  };

  useEffect(() => {
    if (userData) fetchUsers();
  }, [userData]);

  const handleUpdateUser = async (userId, currentData) => {
    const newRole = editRole[userId] || currentData.role;
    const newSede = editSede[userId] || currentData.sede;

    try {
      await updateDoc(doc(db, "users", userId), {
        active: true, // Al darle click, se asume activación
        role: newRole,
        sede: newSede
      });
      toast.success("Usuario actualizado correctamente");
      fetchUsers();
    } catch (e) {
      toast.error("Error al actualizar");
    }
  };

  return (
    <div className="dashboard-wrapper">
      <div className="manager-card">
        <header className="page-header">
            <h1>👥 Gestión de Usuarios</h1>
            <p>{userData.role === 'superadmin' ? 'Panel de Control Nacional' : `Aprobaciones - Facultad ${userData.faculty}`}</p>
        </header>

        {loading ? <div className="loading-state">Cargando usuarios...</div> : (
          <div className="table-wrapper">
            <table className="inventory-table-manager">
              <thead>
                <tr>
                  <th>Correo</th>
                  <th>Facultad</th>
                  <th>Estado</th>
                  <th>Rol / Sede</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td>{u.email}</td>
                    <td>{u.faculty}</td>
                    <td>
                      <span className={`status-badge ${u.active ? 'status-disponible' : 'status-en-mantenimiento'}`}>
                        {u.active ? 'Activo' : 'Pendiente'}
                      </span>
                    </td>
                    <td className="actions-cell-admin">
                      {/* Selección de Rol (Solo Superadmin puede cambiar esto) */}
                      <select 
                        defaultValue={u.role} 
                        onChange={(e) => setEditRole({...editRole, [u.id]: e.target.value})}
                        disabled={userData.role !== 'superadmin'}
                      >
                        {rolesList.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>

                      {/* Selección de Sede */}
                      <select 
                        defaultValue={u.sede} 
                        onChange={(e) => setEditSede({...editSede, [u.id]: e.target.value})}
                      >
                        <option value="">Sin Sede</option>
                        {sedesList.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td>
                      <button 
                        className="action-btn save-btn" 
                        onClick={() => handleUpdateUser(u.id, u)}
                      >
                        {u.active ? 'Actualizar' : 'Aprobar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}