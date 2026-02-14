// src/pages/Admin/UserManagement.js
import React, { useState, useEffect } from 'react';
import { db } from '../../firebaseConfig';
import { collection, getDocs, updateDoc, doc, query, where } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

const sedesList = ["Ceutec SPS Norte", "Ceutec SPS Central", "Ceutec TGU (Prado)", "Ceutec TGU (Centroamerica)", "Ceutec LCE"];

export default function UserManagement() {
  const { userData } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estados para asignación (Superadmin)
  const [selectedSede, setSelectedSede] = useState({});
  const [selectedRole, setSelectedRole] = useState({});
  const [selectedType, setSelectedType] = useState({});

  const fetchUsers = async () => {
    setLoading(true);
    let q = query(collection(db, "users"), where("active", "==", false));
    
    // FILTRO: Coordinador Académico solo ve su facultad
    if (userData.role === 'coord_academico') {
      q = query(q, where("faculty", "==", userData.faculty), where("role", "==", "docente"));
    }

    const snap = await getDocs(q);
    setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    setLoading(false);
  };

  useEffect(() => { if (userData) fetchUsers(); }, [userData]);

  const handleApprove = async (user) => {
    const role = selectedRole[user.id] || user.role;
    const sede = selectedSede[user.id] || '';
    const type = selectedType[user.id] || '';

    if (userData.role === 'superadmin' && role.includes('coord') && !sede) {
      return toast.error("Asigna una sede al coordinador.");
    }

    try {
      await updateDoc(doc(db, "users", user.id), {
        active: true,
        role: role,
        sede: sede,
        typeAssigned: type
      });
      toast.success("Usuario activado");
      fetchUsers();
    } catch (e) { toast.error("Error al activar"); }
  };

  return (
    <div className="dashboard-wrapper">
      <div className="manager-card">
        <h1>👥 Gestión de Aprobaciones</h1>
        {loading ? <p>Cargando...</p> : (
          <table className="inventory-table-manager">
            <thead>
              <tr>
                <th>Correo</th>
                <th>Facultad</th>
                {userData.role === 'superadmin' && <th>Configuración</th>}
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td>{u.email}</td>
                  <td>{u.faculty}</td>
                  {userData.role === 'superadmin' && (
                    <td>
                      <select onChange={(e) => setSelectedRole({...selectedRole, [u.id]: e.target.value})}>
                        <option value="docente">Docente</option>
                        <option value="coord_academico">Coord. Académico</option>
                        <option value="coord_laboratorios">Coord. Laboratorios</option>
                        <option value="coord_aulas">Coord. Aulas</option>
                      </select>
                      <select onChange={(e) => setSelectedSede({...selectedSede, [u.id]: e.target.value})}>
                        <option value="">Asignar Sede...</option>
                        {sedesList.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <select onChange={(e) => setSelectedType({...selectedType, [u.id]: e.target.value})}>
                        <option value="">Tipo (Si es Coord)...</option>
                        <option value="Aula">Aulas</option>
                        <option value="Laboratorio">Laboratorios</option>
                      </select>
                    </td>
                  )}
                  <td>
                    <button className="action-btn save-btn" onClick={() => handleApprove(u)}>Aprobar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}