// src/pages/Admin/SpaceManager.js
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { db } from '../../firebaseConfig';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, setDoc } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { Link, useSearchParams } from 'react-router-dom';
import Modal from '../../components/Modal'; 
import '../styles/SpaceManager.css';
import '../../pages/styles/Dashboard.css';
import toast from 'react-hot-toast';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

const MySwal = withReactContent(Swal);

const REGION_MAPPING = {
  "San Pedro Sula": ["Ceutec SPS Norte", "Ceutec SPS Central"],
  "Tegucigalpa": ["Ceutec TGU (Prado)", "Ceutec TGU (Centroamerica)"],
  "La Ceiba": ["Ceutec LCE"]
};

// --- COMPONENTE: FILA DE INVENTARIO ---
const InventoryRow = ({ item, onUpdate, onDelete, canEdit }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedItem, setEditedItem] = useState({ ...item });

  const handleUpdate = () => { onUpdate(item.id, editedItem); setIsEditing(false); };

  if (isEditing) {
    return (
      <tr className="editing-row-pro">
        <td><input type="text" className="edit-input" value={editedItem.name} onChange={(e) => setEditedItem({ ...editedItem, name: e.target.value })} /></td>
        <td>
            <input type="text" className="edit-input" placeholder="Marca" value={editedItem.brand || ''} onChange={(e) => setEditedItem({ ...editedItem, brand: e.target.value })} />
            <input type="text" className="edit-input mt-5" placeholder="Modelo" value={editedItem.model || ''} onChange={(e) => setEditedItem({ ...editedItem, model: e.target.value })} />
        </td>
        <td><input type="number" className="edit-input" value={editedItem.quantity} onChange={(e) => setEditedItem({ ...editedItem, quantity: Number(e.target.value) })} /></td>
        <td><input type="text" className="edit-input" value={editedItem.location || ''} onChange={(e) => setEditedItem({ ...editedItem, location: e.target.value })} /></td>
        <td>
          <select className="edit-select" value={editedItem.status} onChange={(e) => setEditedItem({ ...editedItem, status: e.target.value })}>
            <option value="Disponible">Disponible</option>
            <option value="En Reparación">En Reparación</option>
            <option value="Dañado">Dañado</option>
          </select>
        </td>
        <td className="actions-cell">
          <button onClick={handleUpdate} className="btn-icon save">💾</button>
          <button onClick={() => setIsEditing(false)} className="btn-icon cancel">✖</button>
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td className="font-bold">{item.name}</td>
      <td>
          <div className="brand-text">{item.brand || '---'}</div>
          <div className="model-text">{item.model || ''}</div>
      </td>
      <td>{item.quantity}</td>
      <td><div className="loc-text">{item.location || '---'}</div></td>
      <td><span className={`status-pill ${(item.status || 'disponible').toLowerCase().replace(/\s+/g, '-')}`}>{item.status || 'Disponible'}</span></td>
      <td className="actions-cell">
        {canEdit && (
          <div className="actions-btns-flex">
            <button onClick={() => setIsEditing(true)} className="btn-icon edit">✏️</button>
            <button onClick={() => onDelete(item.id, item.name)} className="btn-icon delete">🗑️</button>
          </div>
        )}
      </td>
    </tr>
  );
};

export default function SpaceManager() {
  const { userData } = useAuth();
  const [searchParams] = useSearchParams();
  const currentSede = searchParams.get('sede') || "";

  const [spaces, setSpaces] = useState([]);
  const [selectedSpace, setSelectedSpace] = useState(null);
  const [equipment, setEquipment] = useState([]);
  const [activeType, setActiveType] = useState('Aula'); 
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [itemSearch, setItemSearch] = useState(''); 
  const [isEditingSpace, setIsEditingSpace] = useState(false);
  const [isNewSpaceModalOpen, setIsNewSpaceModalOpen] = useState(false);

  const [newEquipment, setNewEquipment] = useState({ 
    name: '', brand: '', model: '', quantity: 1, location: '', observations: '', status: 'Disponible' 
  });

  // 🔴 V2.3: Agregamos el campo 'tags' al estado inicial
  const [newSpaceData, setNewSpaceData] = useState({
      name: '', building: '', floor: '', capacity: 20, type: 'Laboratorio', status: 'Disponible', tags: []
  });

  const isUserInHisCity = useMemo(() => {
    if (userData?.role === 'superadmin') return true;
    const allowedSedes = REGION_MAPPING[userData?.city] || [];
    const normalizedSede = currentSede.toLowerCase().replace('ceutec', '').replace(/[()]/g, '').trim();
    return allowedSedes.some(s => s.toLowerCase().includes(normalizedSede));
  }, [userData, currentSede]);

  const userManagedType = useMemo(() => {
    if (userData?.role === 'coord_labs') return 'Laboratorio';
    if (userData?.role === 'coord_aulas') return 'Aula';
    return null;
  }, [userData]);

  const canManageSpace = (space) => {
    if (!userData || !space) return false;
    if (userData.role === 'superadmin') return true;
    if (!isUserInHisCity) return false;
    if (userData.role === 'coordinador') return true;
    if (userData.role === 'coord_labs' && space.type === 'Laboratorio') return true;
    if (userData.role === 'coord_aulas' && space.type === 'Aula') return true;
    return false;
  };

  const fetchSpaces = useCallback(async () => {
    try {
      const snap = await getDocs(collection(db, 'spaces'));
      const searchTarget = currentSede.toLowerCase().replace('ceutec', '').replace(/[()]/g, '').trim();
      
      const filtered = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(s => {
          const sSede = (s.sede || s.campus || "").toLowerCase();
          return sSede.includes(searchTarget) || searchTarget.includes(sSede);
      });
      setSpaces(filtered);
    } catch (error) { toast.error("Error al sincronizar"); }
  }, [currentSede]);

  useEffect(() => { fetchSpaces(); }, [fetchSpaces]);

  const handleOpenNewSpaceModal = () => {
      if (!isUserInHisCity) {
          return toast.error(`⛔ No puedes crear espacios en ${currentSede} porque tu ciudad base es ${userData.city}`);
      }
      setNewSpaceData({
          name: '', building: '', floor: '', capacity: 20, 
          type: userManagedType || 'Laboratorio', 
          status: 'Disponible',
          tags: []
      });
      setIsNewSpaceModalOpen(true);
  };

  const visibleSpaces = useMemo(() => {
      return spaces
        .filter(s => s.type === activeType)
        .filter(s => (s.name || "").toLowerCase().includes(sidebarSearch.toLowerCase()));
  }, [spaces, activeType, sidebarSearch]);

  const filteredEquipment = useMemo(() => {
      return equipment.filter(item => 
        item.name.toLowerCase().includes(itemSearch.toLowerCase()) ||
        (item.brand && item.brand.toLowerCase().includes(itemSearch.toLowerCase()))
      );
  }, [equipment, itemSearch]);

  const fetchInventory = useCallback(async (spaceId) => {
    const q = query(collection(db, 'spaces', spaceId, 'equipment'), orderBy('name'));
    const snap = await getDocs(q);
    setEquipment(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  }, []);

  const handleSelectSpace = (space) => {
    setSelectedSpace(space);
    setIsEditingSpace(false);
    setItemSearch('');
    fetchInventory(space.id);
  };

  const handleCreateSpace = async (e) => {
      e.preventDefault();
      if (!isUserInHisCity) return toast.error("Acción denegada por región.");
      try {
          const finalType = userManagedType || newSpaceData.type;
          const customId = `SPACE-${Math.floor(1000 + Math.random() * 9000)}`;
          await setDoc(doc(db, 'spaces', customId), {
              ...newSpaceData, type: finalType, id: customId, sede: currentSede, updatedAt: new Date()
          });
          toast.success("Espacio creado con éxito");
          setIsNewSpaceModalOpen(false);
          fetchSpaces();
      } catch (e) { toast.error("Error al crear el espacio"); }
  };

  const handleUpdateSpace = async (e) => {
    e.preventDefault();
    if (!isUserInHisCity) return toast.error("No tienes permisos en esta ciudad.");
    try {
        await updateDoc(doc(db, 'spaces', selectedSpace.id), selectedSpace);
        toast.success("Información actualizada");
        setIsEditingSpace(false);
        fetchSpaces();
    } catch (e) { toast.error("Error al actualizar"); }
  };

  const handleDeleteSpace = () => {
    if (!isUserInHisCity) return toast.error("Acción denegada por región.");
    MySwal.fire({
        title: `¿Eliminar ${selectedSpace.name}?`,
        icon: 'warning', showCancelButton: true, confirmButtonColor: '#c8102e', confirmButtonText: 'Sí, eliminar'
    }).then(async (result) => {
        if (result.isConfirmed) {
            await deleteDoc(doc(db, 'spaces', selectedSpace.id));
            toast.success("Espacio eliminado");
            setSelectedSpace(null);
            fetchSpaces();
        }
    });
  };

  const handleAddEquipment = async (e) => {
    e.preventDefault();
    if (!canManageSpace(selectedSpace)) return;
    await addDoc(collection(db, 'spaces', selectedSpace.id, 'equipment'), { ...newEquipment, labName: selectedSpace.name, createdAt: new Date() });
    toast.success("Ítem agregado");
    setNewEquipment({ name: '', brand: '', model: '', quantity: 1, location: '', observations: '', status: 'Disponible' });
    fetchInventory(selectedSpace.id);
  };

  return (
    <div className="dashboard-wrapper">
      <div className="manager-top-header">
        <Link to={`/dashboard?sede=${currentSede}`} className="back-btn-modern">← Dashboard</Link>
        <div className="header-actions-main">
            <button className="btn-add-space-manual" onClick={handleOpenNewSpaceModal}>➕ Nuevo Espacio</button>
            <Link to={`/admin/importar-inventario?sede=${currentSede}`} className="btn-import-excel">📥 Carga Masiva</Link>
        </div>
      </div>

      <div className="manager-layout-grid">
        <aside className="sidebar-pro">
          <div className="sidebar-top-tabs">
            <button className={activeType === 'Aula' ? 'active' : ''} onClick={() => setActiveType('Aula')}>Aulas</button>
            <button className={activeType === 'Laboratorio' ? 'active' : ''} onClick={() => setActiveType('Laboratorio')}>Labs</button>
          </div>
          <div className="sidebar-search">
            <input type="text" placeholder="🔍 Buscar espacio..." value={sidebarSearch} onChange={e => setSidebarSearch(e.target.value)} />
          </div>
          <ul className="space-items-list">
            {visibleSpaces.map(s => (
              <li key={s.id} className={selectedSpace?.id === s.id ? 'active' : ''} onClick={() => handleSelectSpace(s)}>
                <div className="item-main">{s.name}</div>
                <div className="item-sub">{s.building} • {isUserInHisCity ? '✅ Tu Ciudad' : '🔒 Solo Lectura'}</div>
              </li>
            ))}
          </ul>
        </aside>

        <main className="content-pro">
          {selectedSpace ? (
            <div className="fade-in">
              <div className="space-master-header floating-card">
                <div className="info">
                    <span className={`status-pill-big ${selectedSpace.status?.toLowerCase().replace(/\s+/g, '-')}`}>
                        {selectedSpace.status}
                    </span>
                    <h2>{selectedSpace.name}</h2>
                    <p>Sede: {currentSede} • Capacidad: {selectedSpace.capacity}</p>
                </div>
                {canManageSpace(selectedSpace) && (
                    <button className="btn-edit-space" onClick={() => setIsEditingSpace(!isEditingSpace)}>
                        {isEditingSpace ? 'Cerrar Edición' : '⚙️ Gestionar Espacio'}
                    </button>
                )}
              </div>

              {isEditingSpace && (
                <div className="edit-space-card floating-card fade-in">
                    <h3 style={{ color: '#c8102e', fontWeight: '900' }}>Configuración del Recurso</h3>
                    <form onSubmit={handleUpdateSpace} className="edit-grid-pro">
                        <div className="field"><label>Nombre</label><input type="text" value={selectedSpace.name} onChange={e => setSelectedSpace({...selectedSpace, name: e.target.value})} /></div>
                        <div className="field"><label>Edificio</label><input type="text" value={selectedSpace.building} onChange={e => setSelectedSpace({...selectedSpace, building: e.target.value})} /></div>
                        <div className="field"><label>Piso</label><input type="number" value={selectedSpace.floor} onChange={e => setSelectedSpace({...selectedSpace, floor: e.target.value})} /></div>
                        <div className="field"><label>Capacidad</label><input type="number" value={selectedSpace.capacity} onChange={e => setSelectedSpace({...selectedSpace, capacity: e.target.value})} /></div>
                        
                        <div className="field">
                            <label>Estado</label>
                            <select value={selectedSpace.status} onChange={e => setSelectedSpace({...selectedSpace, status: e.target.value})}>
                                <option value="Disponible">Disponible</option>
                                <option value="En Mantenimiento">En Mantenimiento</option>
                            </select>
                        </div>

                        {/* 🔴 V2.3: CAMPO DE ETIQUETAS PARA BUSCADOR INTELIGENTE */}
                        <div className="field" style={{ gridColumn: 'span 3' }}>
                            <label style={{ color: '#c8102e' }}>Atributos / Tags (Separados por coma)</label>
                            <input 
                                type="text" 
                                placeholder="Ej: Proyector, Macs, Adobe Suite, AC"
                                value={selectedSpace.tags?.join(', ') || ''} 
                                onChange={e => setSelectedSpace({
                                    ...selectedSpace, 
                                    tags: e.target.value.split(',').map(tag => tag.trim()) 
                                })} 
                            />
                        </div>

                        <div className="btn-row-space">
                            <button type="submit" className="btn-confirm">Guardar Cambios</button>
                            {userData?.role === 'superadmin' && <button type="button" className="btn-danger" onClick={handleDeleteSpace}>Eliminar</button>}
                        </div>
                    </form>
                </div>
              )}

              <div className="inventory-section">
                <div className="section-header-pro">
                    <h3>Inventario de Activos</h3>
                    <div className="search-box-items">
                        <span className="search-icon-inside">🔍</span>
                        <input type="text" className="item-search-bar" placeholder="Filtrar insumos..." value={itemSearch} onChange={e => setItemSearch(e.target.value)} />
                    </div>
                </div>

                {canManageSpace(selectedSpace) ? (
                    <div className="add-item-panel-pro">
                        <h4>Añadir Ítem Manualmente</h4>
                        <form onSubmit={handleAddEquipment} className="add-item-grid-pro">
                            <div className="field"><label>Nombre</label><input type="text" value={newEquipment.name} onChange={e => setNewEquipment({...newEquipment, name: e.target.value})} required /></div>
                            <div className="field"><label>Marca</label><input type="text" value={newEquipment.brand} onChange={e => setNewEquipment({...newEquipment, brand: e.target.value})} /></div>
                            <div className="field"><label>Modelo</label><input type="text" value={newEquipment.model} onChange={e => setNewEquipment({...newEquipment, model: e.target.value})} /></div>
                            <div className="field"><label>Cant.</label><input type="number" value={newEquipment.quantity} onChange={e => setNewEquipment({...newEquipment, quantity: Number(e.target.value)})} /></div>
                            <div className="field"><label>Ubicación</label><input type="text" value={newEquipment.location} onChange={e => setNewEquipment({...newEquipment, location: e.target.value})} /></div>
                            <div className="field"><label>Notas</label><input type="text" value={newEquipment.observations} onChange={e => setNewEquipment({...newEquipment, observations: e.target.value})} /></div>
                            <button type="submit" className="btn-add-item-final">Agregar</button>
                        </form>
                    </div>
                ) : (
                    <div className="read-only-notice-box" style={{background: '#f1f5f9', padding: '15px', borderRadius: '12px', borderLeft: '4px solid #94a3b8', marginBottom: '20px'}}>
                        <p style={{margin:0, fontSize: '0.9rem', color: '#475569'}}>🔒 Modo lectura para <strong>{currentSede}</strong>.</p>
                    </div>
                )}

                <div className="table-wrapper-pro">
                    <table className="inventory-table-pro">
                        <thead>
                            <tr><th>Recurso</th><th>Marca/Modelo</th><th>Cant.</th><th>Ubicación</th><th>Estado</th><th>Acciones</th></tr>
                        </thead>
                        <tbody>
                            {filteredEquipment.length > 0 ? filteredEquipment.map(item => (
                                <InventoryRow key={item.id} item={item} canEdit={canManageSpace(selectedSpace)} onUpdate={async (id, data) => {
                                    await updateDoc(doc(db, 'spaces', selectedSpace.id, 'equipment', id), data);
                                    fetchInventory(selectedSpace.id);
                                    toast.success("Actualizado");
                                }} onDelete={async (id) => {
                                    MySwal.fire({ title: '¿Borrar?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Sí' })
                                    .then(async (res) => { if(res.isConfirmed) { await deleteDoc(doc(db, 'spaces', selectedSpace.id, 'equipment', id)); fetchInventory(selectedSpace.id); }})
                                }} />
                            )) : <tr><td colSpan="6" style={{textAlign:'center', padding:'30px', color:'#94a3b8'}}>No hay insumos que coincidan.</td></tr>}
                        </tbody>
                    </table>
                </div>
              </div>
            </div>
          ) : <div className="no-selection-pro"><h2>Selecciona un recurso académico 👈</h2></div>}
        </main>
      </div>

      {/* MODAL NUEVO ESPACIO ACTUALIZADO V2.3 */}
      <Modal isOpen={isNewSpaceModalOpen} onClose={() => setIsNewSpaceModalOpen(false)} title="Crear Nuevo Recurso">
          <form onSubmit={handleCreateSpace} className="academic-form-pro">
              <div className="form-row-pro">
                  <div className="field-group">
                      <label>Nombre del Espacio</label>
                      <input type="text" required value={newSpaceData.name} onChange={e => setNewSpaceData({...newSpaceData, name: e.target.value})} placeholder="Ej: Laboratorio 10" />
                  </div>
                  <div className="field-group">
                      <label>Tipo</label>
                      {userData?.role === 'superadmin' ? (
                          <select value={newSpaceData.type} onChange={e => setNewSpaceData({...newSpaceData, type: e.target.value})}>
                              <option value="Laboratorio">Laboratorio</option>
                              <option value="Aula">Aula</option>
                          </select>
                      ) : (
                          <input type="text" value={userManagedType} disabled className="locked-input" style={{background: '#f8fafc', color: '#64748b'}} />
                      )}
                  </div>
              </div>

              <div className="form-row-pro" style={{marginTop:'15px'}}>
                  <div className="field-group">
                      <label>Edificio</label>
                      <input type="text" required value={newSpaceData.building} onChange={e => setNewSpaceData({...newSpaceData, building: e.target.value})} placeholder="Ej: Edificio 2" />
                  </div>
                  <div className="field-group">
                      <label>Piso</label>
                      <input type="number" required value={newSpaceData.floor} onChange={e => setNewSpaceData({...newSpaceData, floor: e.target.value})} placeholder="Ej: 1" />
                  </div>
              </div>

              <div className="form-row-pro" style={{marginTop:'15px'}}>
                  <div className="field-group" style={{ flex: 1 }}>
                      <label>Capacidad (Personas)</label>
                      <input type="number" required value={newSpaceData.capacity} onChange={e => setNewSpaceData({...newSpaceData, capacity: Number(e.target.value)})} min="1" />
                  </div>
                  <div className="field-group" style={{ flex: 2 }}>
                      <label style={{ color: '#c8102e' }}>Tags (Proyector, Macs, etc.)</label>
                      <input 
                          type="text" 
                          placeholder="Separados por coma"
                          onChange={e => setNewSpaceData({
                              ...newSpaceData, 
                              tags: e.target.value.split(',').map(tag => tag.trim()) 
                          })} 
                      />
                  </div>
              </div>

              <div className="modal-footer-pro" style={{marginTop:'30px', borderTop: '1px solid #eee', paddingTop: '20px'}}>
                  <button type="submit" className="btn-save-pro" style={{width: '100%'}}>
                      Crear {userManagedType || 'Espacio'} en {currentSede}
                  </button>
              </div>
          </form>
      </Modal>
    </div>
  );
}