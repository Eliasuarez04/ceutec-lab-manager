// src/pages/Admin/SpaceManager.js
import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../../firebaseConfig';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, writeBatch, getDoc, Timestamp } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/Modal';
import { Link } from 'react-router-dom';
import '../styles/InventoryManager.css';
import '../../pages/styles/Dashboard.css';
import toast from 'react-hot-toast';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

const MySwal = withReactContent(Swal);

// --- Componente para una fila de la tabla de inventario ---
const InventoryRow = ({ item, onUpdate, onDelete, canEdit }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedItem, setEditedItem] = useState({ ...item });

  const handleUpdate = () => {
    onUpdate(item.id, editedItem);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <tr className="editing-row">
        <td><input type="text" value={editedItem.name} onChange={(e) => setEditedItem({ ...editedItem, name: e.target.value })} /></td>
        <td><input type="number" value={editedItem.quantity} onChange={(e) => setEditedItem({ ...editedItem, quantity: Number(e.target.value) })} /></td>
        <td><input type="number" value={editedItem.stockThreshold || 0} onChange={(e) => setEditedItem({ ...editedItem, stockThreshold: Number(e.target.value) })} /></td>
        <td>
          <select value={editedItem.status} onChange={(e) => setEditedItem({ ...editedItem, status: e.target.value })}>
            <option value="Disponible">Disponible</option>
            <option value="En Mantenimiento">En Mantenimiento</option>
            <option value="Fuera de Servicio">Fuera de Servicio</option>
          </select>
        </td>
        <td className="actions-cell">
          <button onClick={handleUpdate} className="action-btn save-btn">Guardar</button>
          <button onClick={() => setIsEditing(false)} className="action-btn cancel-btn">Cancelar</button>
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td>{item.name}</td>
      <td>{item.quantity}</td>
      <td><span className="threshold-badge">{item.stockThreshold || 0}</span></td>
      <td><span className={`status-badge status-${(item.status || 'disponible').toLowerCase().replace(/\s+/g, '-')}`}>{item.status || 'Disponible'}</span></td>
      <td className="actions-cell">
        {canEdit && (
          <>
            <button onClick={() => setIsEditing(true)} className="action-btn edit-btn">Editar</button>
            <button onClick={() => onDelete(item.id, item.name)} className="action-btn delete-btn">Eliminar</button>
          </>
        )}
        {!canEdit && <span style={{fontSize: '0.8rem', color: '#999'}}>Sólo lectura</span>}
      </td>
    </tr>
  );
};

// --- Componente Principal SpaceManager ---
export default function SpaceManager() {
  const { currentUser, userData } = useAuth();
  const [spaces, setSpaces] = useState([]);
  const [selectedSpace, setSelectedSpace] = useState(null);
  const [equipment, setEquipment] = useState([]);
  const [newEquipment, setNewEquipment] = useState({ name: '', quantity: 1, status: 'Disponible', stockThreshold: 0 });
  const [loading, setLoading] = useState({ spaces: false, inventory: false });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentSpaceData, setCurrentSpaceData] = useState({ name: '', location: '', description: '', status: 'Disponible', type: 'Aula', sede: '' });

  // Lógica de Permisos: ¿Puede este usuario gestionar este espacio?
  const canManageSpace = (space) => {
    if (!userData || !space) return false;
    if (userData.role === 'superadmin') return true;

    const isSameSede = space.sede === userData.sede;
    const isCorrectType = space.type === userData.typeAssigned;

    if (userData.role === 'coord_laboratorios' && isSameSede && space.type === 'Laboratorio') return true;
    if (userData.role === 'coord_aulas' && isSameSede && space.type === 'Aula') return true;

    return false;
  };

  const fetchSpaces = useCallback(async () => {
    setLoading(prev => ({ ...prev, spaces: true }));
    const q = query(collection(db, 'spaces'), orderBy('name'));
    const snap = await getDocs(q);
    setSpaces(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    setLoading(prev => ({ ...prev, spaces: false }));
  }, []);

  useEffect(() => { fetchSpaces(); }, [fetchSpaces]);

  const fetchInventory = useCallback(async (spaceId) => {
    setLoading(prev => ({ ...prev, inventory: true }));
    const q = query(collection(db, 'spaces', spaceId, 'equipment'), orderBy('name'));
    const snap = await getDocs(q);
    setEquipment(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    setLoading(prev => ({ ...prev, inventory: false }));
  }, []);

  const handleSelectSpace = (space) => {
    setSelectedSpace(space);
    fetchInventory(space.id);
  };

  const handleAddEquipment = async (e) => {
    e.preventDefault();
    if (!selectedSpace || !canManageSpace(selectedSpace)) return toast.error("No tienes permisos de edición.");
    
    const data = { ...newEquipment, name_uppercase: newEquipment.name.toUpperCase(), labName: selectedSpace.name };
    await addDoc(collection(db, 'spaces', selectedSpace.id, 'equipment'), data);
    toast.success("Equipo añadido");
    setNewEquipment({ name: '', quantity: 1, status: 'Disponible', stockThreshold: 0 });
    fetchInventory(selectedSpace.id);
  };

  const handleUpdateEquipment = async (itemId, updatedData) => {
    const docRef = doc(db, 'spaces', selectedSpace.id, 'equipment', itemId);
    await updateDoc(docRef, { ...updatedData, name_uppercase: updatedData.name.toUpperCase() });
    toast.success("Actualizado");
    fetchInventory(selectedSpace.id);
  };

  const handleDeleteEquipment = async (itemId, itemName) => {
    MySwal.fire({
      title: `¿Eliminar ${itemName}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#c8102e',
      confirmButtonText: 'Sí, eliminar'
    }).then(async (result) => {
      if (result.isConfirmed) {
        await deleteDoc(doc(db, 'spaces', selectedSpace.id, 'equipment', itemId));
        fetchInventory(selectedSpace.id);
      }
    });
  };

  return (
    <div className="dashboard-wrapper">
      {/* BOTÓN DE IMPORTACIÓN: Sólo Superadmin */}
      {userData?.role === 'superadmin' && (
        <Link to="/admin/importar-espacios" className="global-add-lab-btn">
          ⚙️ Importar Espacios Maestros
        </Link>
      )}

      <div className="manager-layout">
        <aside className="sidebar">
          <div className="sidebar-header">
            <h2 className="sidebar-title">RECURSOS</h2>
          </div>
          <ul className="lab-selector-list">
            {spaces.map(s => (
              <li 
                key={s.id} 
                className={`${selectedSpace?.id === s.id ? 'active' : ''} ${!canManageSpace(s) ? 'read-only-item' : ''}`}
                onClick={() => handleSelectSpace(s)}
              >
                <span className="type-dot">{s.type === 'Aula' ? '📖' : '🧪'}</span>
                {s.name} 
                {!canManageSpace(s) && <small> (Lectura)</small>}
              </li>
            ))}
          </ul>
        </aside>

        <main className="main-content">
          {selectedSpace ? (
            <>
              <div className="content-header floating-card">
                <div>
                    <h1>{selectedSpace.name}</h1>
                    <p>📍 {selectedSpace.sede} | {selectedSpace.location}</p>
                </div>
                {userData?.role === 'superadmin' && (
                    <div className="header-actions">
                        <button className="action-btn delete-btn" onClick={() => {/* lógica delete space */}}>Eliminar Espacio</button>
                    </div>
                )}
              </div>

              {/* FORMULARIO AÑADIR: Solo si tiene permiso */}
              {canManageSpace(selectedSpace) ? (
                <div className="manager-card">
                  <h3 className="card-title">Añadir Nuevo Equipo</h3>
                  <form onSubmit={handleAddEquipment} className="add-item-form">
                    <input type="text" placeholder="Nombre equipo" value={newEquipment.name} onChange={(e) => setNewEquipment({...newEquipment, name: e.target.value})} required />
                    <input type="number" placeholder="Cant" value={newEquipment.quantity} onChange={(e) => setNewEquipment({...newEquipment, quantity: Number(e.target.value)})} />
                    <input type="number" placeholder="Alerta" value={newEquipment.stockThreshold} onChange={(e) => setNewEquipment({...newEquipment, stockThreshold: Number(e.target.value)})} />
                    <select value={newEquipment.status} onChange={(e) => setNewEquipment({...newEquipment, status: e.target.value})}>
                      <option value="Disponible">Disponible</option>
                      <option value="En Mantenimiento">Mantenimiento</option>
                    </select>
                    <button type="submit">Añadir</button>
                  </form>
                </div>
              ) : (
                  <div className="manager-card read-only-notice">
                      <p>⚠️ Tienes acceso de <strong>Sólo Lectura</strong> para este espacio. Para modificaciones, contacta al Superadmin.</p>
                  </div>
              )}

              <div className="manager-card">
                <h3 className="card-title">Inventario Actual</h3>
                <table className="inventory-table-manager">
                  <thead>
                    <tr>
                      <th>Recurso</th>
                      <th>Cantidad</th>
                      <th>Umbral</th>
                      <th>Estado</th>
                      <th className="actions-header">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {equipment.map(item => (
                      <InventoryRow 
                        key={item.id} 
                        item={item} 
                        onUpdate={handleUpdateEquipment} 
                        onDelete={handleDeleteEquipment}
                        canEdit={canManageSpace(selectedSpace)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="placeholder-content">
              <h2>Selecciona un Recurso Académico</h2>
              <p>Elige un aula o laboratorio de la izquierda para gestionar su inventario.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}