import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { db } from '../../firebaseConfig';
import { collection, getDocs, updateDoc, doc, deleteDoc, query, where, setDoc, Timestamp } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import Modal from '../../components/Modal';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import '../styles/AcademicSpaces.css';

const MySwal = withReactContent(Swal);

const CITIES_LIST = ["San Pedro Sula", "Tegucigalpa", "La Ceiba"];

const rolesList = [
    { id: 'docente', name: 'Docente' },
    { id: 'coordinador', name: 'Coordinador Académico' },
    { id: 'coord_labs', name: 'Coord. Laboratorios' },
    { id: 'coord_aulas', name: 'Coord. Aulas' },
    { id: 'it_staff', name: 'Soporte IT' },
    { id: 'admin_staff', name: 'Administrativo' },
    { id: 'superadmin', name: 'Super Admin' }
];

export default function UserManagement() {
  const { userData } = useAuth();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const currentSede = queryParams.get('sede') || userData?.sede || ""; 

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // 🔥 Estados del panel de SuperAdmin (Agregar TH)
  const [newTeacherName, setNewTeacherName] = useState('');
  const [newTeacherTH, setNewTeacherTH] = useState('');
  const [isAddingTeacher, setIsAddingTeacher] = useState(false);

  // 🔥 Estados para los FILTROS
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('ALL');

  // 🔥 ESTADOS PARA EL CRUD (Edición de Usuario)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [editForm, setEditForm] = useState({
      displayName: '',
      th: '',
      city: '',
      role: 'docente'
  });

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      let q;
      const usersRef = collection(db, "users");

      if (userData.role === 'superadmin') {
        q = query(usersRef);
      } else {
        q = query(usersRef, where("city", "==", userData.city));
      }

      const snap = await getDocs(q);
      let userList = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Ordenar alfabéticamente
      userList.sort((a, b) => (a.displayName || a.email || "").localeCompare(b.displayName || b.email || ""));

      setUsers(userList);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Error al cargar la lista de usuarios.");
    }
    setLoading(false);
  }, [userData]);

  useEffect(() => {
    if (userData) fetchUsers();
  }, [fetchUsers, userData]);

  // Motor de Búsqueda en RAM
  const filteredUsers = useMemo(() => {
      return users.filter(u => {
          const searchStr = `${u.displayName || ''} ${u.email || ''} ${u.th || ''}`.toLowerCase();
          const matchesSearch = searchStr.includes(searchTerm.toLowerCase());
          const matchesRole = filterRole === 'ALL' ? true : u.role === filterRole;

          return matchesSearch && matchesRole;
      });
  }, [users, searchTerm, filterRole]);

  // --- MÉTODOS CRUD ---

  // 1. CREATE (Pre-autorizar Docente)
  const handleAddTeacher = async (e) => {
    e.preventDefault();
    if (!newTeacherName || !newTeacherTH) return toast.error("Llena ambos campos");
    
    setIsAddingTeacher(true);
    const toastId = toast.loading("Autorizando docente...");

    try {
      const thClean = newTeacherTH.trim();
      await setDoc(doc(db, 'active_teachers_list', thClean), {
        th: thClean,
        name: newTeacherName.trim().toUpperCase(),
        email: "Pendiente de Registro",
        lastUpdate: Timestamp.now()
      });

      toast.success(`Docente ${thClean} habilitado para registrarse.`, { id: toastId });
      setNewTeacherName('');
      setNewTeacherTH('');
    } catch (err) {
      toast.error("Error al autorizar docente.", { id: toastId });
    } finally {
      setIsAddingTeacher(false);
    }
  };

  // 2. OPEN UPDATE MODAL
  const openEditModal = (user) => {
      setSelectedUser(user);
      setEditForm({
          displayName: user.displayName || '',
          th: user.th || '',
          city: user.city || '',
          role: user.role || 'docente'
      });
      setIsEditModalOpen(true);
  };

  // 3. UPDATE (Guardar Cambios)
  const handleUpdateUserSubmit = async (e) => {
      e.preventDefault();
      const toastId = toast.loading("Actualizando usuario...");
      try {
          await updateDoc(doc(db, "users", selectedUser.id), {
              displayName: editForm.displayName.toUpperCase(),
              th: editForm.th,
              city: editForm.city,
              role: editForm.role
          });
          toast.success("Usuario actualizado correctamente.", {id: toastId});
          setIsEditModalOpen(false);
          fetchUsers();
      } catch (error) {
          toast.error("Error al actualizar el usuario.", {id: toastId});
      }
  };

  // 4. DELETE (Eliminar Usuario)
  const handleDeleteUser = async (user) => {
      const { isConfirmed } = await MySwal.fire({
          title: '¿Eliminar Usuario?',
          text: `Estás a punto de eliminar el perfil de ${user.displayName || user.email}. Esta acción es irreversible.`,
          icon: 'warning',
          showCancelButton: true,
          confirmButtonColor: '#c8102e',
          cancelButtonColor: '#64748b',
          confirmButtonText: 'Sí, eliminar',
          cancelButtonText: 'Cancelar'
      });

      if (isConfirmed) {
          const toastId = toast.loading("Eliminando usuario...");
          try {
              await deleteDoc(doc(db, "users", user.id));
              toast.success("Usuario eliminado de la base de datos.", {id: toastId});
              fetchUsers();
          } catch (error) {
              toast.error("Error al eliminar el usuario.", {id: toastId});
          }
      }
  };

  const getRoleName = (roleId) => {
      const role = rolesList.find(r => r.id === roleId);
      return role ? role.name : 'Rol Desconocido';
  };

  return (
    <div className="dashboard-wrapper">
      <div style={{ maxWidth: '1400px', margin: '0 auto', width: '100%', marginBottom: '20px' }}>
        <Link 
            to={`/dashboard?sede=${encodeURIComponent(currentSede)}`} 
            className="back-link-simple"
            style={{ textDecoration: 'none', color: '#c8102e', fontWeight: 'bold', display: 'inline-block' }}
        >
          ← Volver al Dashboard
        </Link>
      </div>

      <div className="manager-card fade-in" style={{background: 'white', borderRadius: '20px', padding: '30px', boxShadow: '0 10px 30px rgba(0,0,0,0.05)'}}>
        
        <header className="page-header" style={{ marginBottom: '30px', borderBottom: '1px solid #edf2f7', paddingBottom: '20px', display: 'flex', justifyItems: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
            <div style={{flex: 1}}>
                <h1 style={{margin: '0 0 5px 0', color: '#1e293b'}}>👥 Directorio de Usuarios</h1>
                <p style={{ color: '#64748b', margin: 0, fontWeight: '600' }}>
                    {userData?.role === 'superadmin' 
                        ? 'Control Total del Sistema' 
                        : `Administración de la ciudad: ${userData.city || ''}`}
                </p>
            </div>
            <div style={{background: '#f1f5f9', padding: '10px 20px', borderRadius: '12px', textAlign: 'center'}}>
                <div style={{fontSize: '1.2rem', fontWeight: '900', color: '#1e293b'}}>{users.length}</div>
                <div style={{fontSize: '0.7rem', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase'}}>Usuarios Registrados</div>
            </div>
        </header>

        {/* Módulo Autorizar Docente (Solo Superadmin) */}
        {userData?.role === 'superadmin' && (
          <div style={{ background: '#f8fafc', padding: '25px', borderRadius: '16px', marginBottom: '35px', border: '1px solid #e2e8f0' }}>
            <h3 style={{ margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '10px', color: '#0f172a' }}>
              <span style={{ fontSize: '1.3rem' }}>👨‍🏫</span> Autorizar Nuevo Docente
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '20px' }}>
              Añade el Nombre y TH de un docente inactivo para permitirle registrarse en la plataforma y hacer reservas.
            </p>
            
            <form onSubmit={handleAddTeacher} style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: '2', minWidth: '220px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ color: '#334155', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase' }}>Nombre Completo</label>
                <input 
                  type="text" placeholder="Ej. MARIO LEONEL CASTILLO" 
                  value={newTeacherName} onChange={(e) => setNewTeacherName(e.target.value)} required 
                  style={{ padding: '12px 15px', borderRadius: '10px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.95rem' }}
                />
              </div>

              <div style={{ flex: '1', minWidth: '120px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ color: '#334155', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase' }}>No. Empleado (TH)</label>
                <input 
                  type="number" placeholder="Ej. 10411" 
                  value={newTeacherTH} onChange={(e) => setNewTeacherTH(e.target.value)} required 
                  style={{ padding: '12px 15px', borderRadius: '10px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.95rem' }}
                />
              </div>

              <button 
                type="submit" disabled={isAddingTeacher}
                style={{ 
                  height: '46px', flex: '1', minWidth: '150px', background: isAddingTeacher ? '#94a3b8' : '#0f172a',
                  color: 'white', fontWeight: '800', border: 'none', borderRadius: '10px', cursor: 'pointer', transition: '0.3s'
                }}
              >
                {isAddingTeacher ? 'Autorizando...' : '+ Autorizar Docente'}
              </button>
            </form>
          </div>
        )}

        {/* Filtros de Búsqueda */}
        <div style={{display: 'flex', flexWrap: 'wrap', gap: '15px', marginBottom: '25px', background: '#f8fafc', padding: '15px', borderRadius: '12px', border: '1px solid #edf2f7'}}>
            <div style={{flex: '2', minWidth: '250px', position: 'relative'}}>
                <span style={{position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8'}}>🔍</span>
                <input 
                    type="text" 
                    placeholder="Buscar por Nombre, Correo o TH..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{width: '100%', padding: '12px 15px 12px 40px', borderRadius: '10px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.9rem', boxSizing: 'border-box'}}
                />
            </div>
            <div style={{display: 'flex', gap: '10px', flex: '1', minWidth: '200px'}}>
                <select 
                    value={filterRole} 
                    onChange={(e) => setFilterRole(e.target.value)}
                    style={{flex: '1', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.9rem', fontWeight: '600', color: '#334155'}}
                >
                    <option value="ALL">Todos los Roles</option>
                    {rolesList.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
            </div>
        </div>

        {/* Tabla CRUD */}
        {loading ? <div className="loading-state" style={{padding: '50px 0'}}>Sincronizando directorio...</div> : (
          <div className="table-wrapper" style={{overflowX: 'auto'}}>
            <table className="inventory-table-manager" style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '2px solid #e2e8f0', background: '#f8fafc' }}>
                  <th style={{ padding: '15px', color: '#64748b', fontSize: '0.8rem', textTransform: 'uppercase' }}>Perfil del Usuario</th>
                  <th style={{ color: '#64748b', fontSize: '0.8rem', textTransform: 'uppercase' }}>Información Base</th>
                  <th style={{ color: '#64748b', fontSize: '0.8rem', textTransform: 'uppercase' }}>Rol Asignado</th>
                  <th style={{ color: '#64748b', fontSize: '0.8rem', textTransform: 'uppercase', textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                    <tr><td colSpan="4" style={{textAlign: 'center', padding: '60px 20px', color: '#94a3b8', fontSize: '1.1rem'}}>No se encontraron usuarios.</td></tr>
                ) : (
                    filteredUsers.map(u => (
                      <tr key={u.id} style={{ borderBottom: '1px solid #f1f5f9', transition: '0.2s' }}>
                        <td style={{ padding: '15px' }}>
                            <div style={{display: 'flex', alignItems: 'center', gap: '15px'}}>
                                <div style={{width: '40px', height: '40px', borderRadius: '50%', background: '#e2e8f0', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1.2rem'}}>
                                    {(u.displayName || u.email || 'U').charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <div style={{fontWeight: '800', color: '#0f172a', fontSize: '0.95rem'}}>{u.displayName || 'Sin Nombre Registrado'}</div>
                                    <div style={{fontSize: '0.8rem', color: '#64748b'}}>{u.email}</div>
                                </div>
                            </div>
                        </td>
                        
                        <td>
                            <div style={{ fontWeight: '700', color: '#334155', fontSize: '0.9rem' }}>📍 {u.city || "Ciudad no definida"}</div>
                            <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '3px' }}>🆔 TH: {u.th || 'N/A'}</div>
                        </td>
                        
                        <td>
                            <span style={{padding: '5px 12px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: '700', background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1'}}>
                                {getRoleName(u.role)}
                            </span>
                        </td>
                        
                        <td style={{paddingRight: '15px'}}>
                          <div style={{display: 'flex', gap: '10px', justifyContent: 'center'}}>
                            <button 
                                onClick={() => openEditModal(u)} 
                                style={{ background: '#1e293b', color: 'white', padding: '8px 15px', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
                            >
                                ✏️ Editar
                            </button>
                            {userData?.role === 'superadmin' && (
                                <button 
                                    onClick={() => handleDeleteUser(u)} 
                                    style={{ background: '#fef2f2', color: '#c8102e', padding: '8px 15px', borderRadius: '8px', border: '1px solid #fca5a5', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
                                >
                                    🗑️ Eliminar
                                </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 🔥 MODAL DE EDICIÓN CRUD 🔥 */}
      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Editar Información del Usuario">
        {selectedUser && (
            <form onSubmit={handleUpdateUserSubmit} style={{padding: '10px'}}>
                <div style={{display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '25px'}}>
                    
                    <div style={{display: 'flex', flexDirection: 'column', gap: '5px'}}>
                        <label style={{fontSize: '0.85rem', fontWeight: 'bold', color: '#334155'}}>Nombre Completo</label>
                        <input 
                            type="text" 
                            value={editForm.displayName} 
                            onChange={(e) => setEditForm({...editForm, displayName: e.target.value})} 
                            required 
                            style={{padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none'}}
                        />
                    </div>

                    <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px'}}>
                        <div style={{display: 'flex', flexDirection: 'column', gap: '5px'}}>
                            <label style={{fontSize: '0.85rem', fontWeight: 'bold', color: '#334155'}}>Número Empleado (TH)</label>
                            <input 
                                type="number" 
                                value={editForm.th} 
                                onChange={(e) => setEditForm({...editForm, th: e.target.value})} 
                                required 
                                style={{padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none'}}
                            />
                        </div>

                        <div style={{display: 'flex', flexDirection: 'column', gap: '5px'}}>
                            <label style={{fontSize: '0.85rem', fontWeight: 'bold', color: '#334155'}}>Ciudad Base</label>
                            <select 
                                value={editForm.city} 
                                onChange={(e) => setEditForm({...editForm, city: e.target.value})} 
                                required 
                                style={{padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none'}}
                            >
                                <option value="" disabled>Selecciona una ciudad...</option>
                                {CITIES_LIST.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                    </div>

                    <div style={{display: 'flex', flexDirection: 'column', gap: '5px'}}>
                        <label style={{fontSize: '0.85rem', fontWeight: 'bold', color: '#334155'}}>Rol del Sistema</label>
                        <select 
                            value={editForm.role} 
                            onChange={(e) => setEditForm({...editForm, role: e.target.value})} 
                            disabled={userData.role !== 'superadmin'}
                            style={{padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', background: userData.role !== 'superadmin' ? '#f1f5f9' : 'white'}}
                        >
                            {rolesList.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </select>
                    </div>

                </div>

                <div style={{display: 'flex', gap: '10px', justifyContent: 'flex-end'}}>
                    <button type="button" onClick={() => setIsEditModalOpen(false)} style={{padding: '10px 20px', borderRadius: '8px', border: 'none', background: '#f1f5f9', color: '#64748b', fontWeight: 'bold', cursor: 'pointer'}}>
                        Cancelar
                    </button>
                    <button type="submit" style={{padding: '10px 20px', borderRadius: '8px', border: 'none', background: '#c8102e', color: 'white', fontWeight: 'bold', cursor: 'pointer'}}>
                        Guardar Cambios
                    </button>
                </div>
            </form>
        )}
      </Modal>

    </div>
  );
}