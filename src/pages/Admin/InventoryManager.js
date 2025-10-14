// src/pages/Admin/InventoryManager.js
import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../../firebaseConfig';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, writeBatch, getDoc, Timestamp } from 'firebase/firestore';
import '../styles/InventoryManager.css'; // Asegúrate que la ruta a tu CSS es correcta
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/Modal';
import toast from 'react-hot-toast';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

const MySwal = withReactContent(Swal);

// ===================================================================================
// Helper: Componente para una fila de la tabla de inventario
// ===================================================================================
const formatStatusClass = (status) => status?.toLowerCase().replace(/\s+/g, '-') || '';

const InventoryRow = ({ item, onUpdate, onDelete }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedItem, setEditedItem] = useState({ ...item });

  const handleUpdate = () => {
    if (JSON.stringify(item) !== JSON.stringify(editedItem)) {
      onUpdate(item.id, editedItem);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedItem({ ...item });
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <tr>
        <td><input type="text" value={editedItem.name} onChange={(e) => setEditedItem({ ...editedItem, name: e.target.value })} /></td>
        <td><input type="number" min="0" value={editedItem.quantity} onChange={(e) => setEditedItem({ ...editedItem, quantity: Number(e.target.value) })} /></td>
        <td>
          <select value={editedItem.status} onChange={(e) => setEditedItem({ ...editedItem, status: e.target.value })}>
            <option value="Disponible">Disponible</option>
            <option value="En Mantenimiento">En Mantenimiento</option>
            <option value="Fuera de Servicio">Fuera de Servicio</option>
          </select>
        </td>
        <td className="actions-cell">
          <button onClick={handleUpdate} className="action-btn save-btn">Guardar</button>
          <button onClick={handleCancel} className="action-btn cancel-btn">Cancelar</button>
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td>{item.name}</td>
      <td>{item.quantity}</td>
      <td>
        <span className={`status-badge status-${formatStatusClass(item.status)}`}>
          {item.status}
        </span>
      </td>
      <td className="actions-cell">
        <button onClick={() => setIsEditing(true)} className="action-btn edit-btn">Editar</button>
        {/* PASAMOS EL ID Y EL NOMBRE A LA FUNCIÓN DE ELIMINACIÓN */}
        <button onClick={() => onDelete(item.id, item.name)} className="action-btn delete-btn">Eliminar</button>
      </td>
    </tr>
  );
};


// ===================================================================================
// Componente Principal: InventoryManager
// ===================================================================================
export default function InventoryManager() {
  // Estados para laboratorios e inventario
  const [labs, setLabs] = useState([]);
  const [selectedLab, setSelectedLab] = useState(null);
  const [equipment, setEquipment] = useState([]);
  const [newEquipment, setNewEquipment] = useState({ name: '', quantity: 1, status: 'Disponible' });
  const [isLoadingLabs, setIsLoadingLabs] = useState(false);
  const [isLoadingInventory, setIsLoadingInventory] = useState(false);

  // Estados para los modales y el formulario de laboratorio
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add' o 'edit'
  const [currentLabData, setCurrentLabData] = useState({ name: '', location: '', description: '' });
  const { currentUser } = useAuth();

  // Cargar la lista de laboratorios
  const fetchLabs = useCallback(async () => {
    setIsLoadingLabs(true);
    const q = query(collection(db, 'laboratories'), orderBy('name'));
    const querySnapshot = await getDocs(q);
    const labsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setLabs(labsData);
    setIsLoadingLabs(false);
  }, []);

  useEffect(() => {
    fetchLabs();
  }, [fetchLabs]);

  // Cargar inventario al seleccionar un laboratorio
  const fetchInventory = useCallback(async (labId) => {
    if (!labId) return;
    setIsLoadingInventory(true);
    const equipmentColRef = collection(db, 'laboratories', labId, 'equipment');
    const q = query(equipmentColRef, orderBy('name'));
    const equipmentSnapshot = await getDocs(q);
    const equipmentData = equipmentSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setEquipment(equipmentData);
    setIsLoadingInventory(false);
  }, []);

  const handleSelectLab = (lab) => {
    setSelectedLab(lab);
    fetchInventory(lab.id);
  };

  // --- Funciones CRUD para EQUIPOS ---
  const handleAddEquipment = async (e) => {
    e.preventDefault();
    if (!selectedLab || !newEquipment.name) return;
    const equipmentColRef = collection(db, 'laboratories', selectedLab.id, 'equipment');
    const docRef = await addDoc(equipmentColRef, newEquipment);
    
    // --- AÑADIR LOG ---
    const logData = {
      labId: selectedLab.id, labName: selectedLab.name, itemId: docRef.id,
      itemName: newEquipment.name, userEmail: currentUser.email, changeType: 'Añadido',
      quantityChange: newEquipment.quantity, newQuantity: newEquipment.quantity,
      timestamp: Timestamp.now()
    };
    await addDoc(collection(db, 'inventory_logs'), logData);
    
    setNewEquipment({ name: '', quantity: 1, status: 'Disponible' });
    fetchInventory(selectedLab.id);
  };


  const handleUpdateEquipment = async (itemId, updatedData) => {
    const itemDocRef = doc(db, 'laboratories', selectedLab.id, 'equipment', itemId);
    
    // --- AÑADIR LOG (requiere leer el estado anterior) ---
    const docBefore = await getDoc(itemDocRef);
    if (docBefore.exists()) {
      const oldData = docBefore.data();
      const logData = {
        labId: selectedLab.id, labName: selectedLab.name, itemId: itemId,
        itemName: updatedData.name, userEmail: currentUser.email, changeType: 'Actualizado',
        quantityChange: updatedData.quantity - oldData.quantity, newQuantity: updatedData.quantity,
        timestamp: Timestamp.now()
      };
      await addDoc(collection(db, 'inventory_logs'), logData);
    }

    await updateDoc(itemDocRef, updatedData);
    fetchInventory(selectedLab.id);
  };
  
  // FUNCIÓN CORREGIDA: Acepta itemId e itemName
  const handleDeleteEquipment = (itemId, itemName) => {
    MySwal.fire({
      title: `¿Eliminar "${itemName}"?`, // Usa itemName
      text: "Esta acción no se puede revertir.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#c8102e',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then(async (result) => {
      if (result.isConfirmed) {
        const itemDocRef = doc(db, 'laboratories', selectedLab.id, 'equipment', itemId);
        const docBefore = await getDoc(itemDocRef);
        
        const promise = deleteDoc(itemDocRef);
        toast.promise(promise, {
          loading: 'Eliminando equipo...',
          success: `"${itemName}" eliminado correctamente.`,
          error: 'Error al eliminar el equipo.'
        });
        
        if (docBefore.exists()) {
          const oldData = docBefore.data();
          const logData = {
            labId: selectedLab.id, labName: selectedLab.name, itemId: itemId,
            itemName: oldData.name, userEmail: currentUser.email, changeType: 'Eliminado',
            quantityChange: -oldData.quantity, newQuantity: 0,
            timestamp: Timestamp.now()
          };
          await addDoc(collection(db, 'inventory_logs'), logData);
        }
        fetchInventory(selectedLab.id);
      }
    });
  };

  // --- Funciones para el MODAL de Laboratorios ---
  const openAddLabModal = () => {
    setModalMode('add');
    setCurrentLabData({ name: '', location: '', description: '' });
    setIsModalOpen(true);
  };
  
  const openEditLabModal = (lab) => {
    setModalMode('edit');
    setCurrentLabData({ ...lab });
    setIsModalOpen(true);
  };

  const handleLabFormSubmit = async (e) => {
    e.preventDefault();
    if (!currentLabData.name.trim() || !currentLabData.location.trim()) return;

    const processedData = {
        name: currentLabData.name.trim(),
        location: currentLabData.location.trim(),
        description: currentLabData.description.trim(),
        status: currentLabData.status || 'Disponible'
    };

    if (modalMode === 'add') {
      await addDoc(collection(db, 'laboratories'), processedData);
    } else {
      const labDocRef = doc(db, 'laboratories', currentLabData.id);
      const { id, ...dataToUpdate } = currentLabData; 
      await updateDoc(labDocRef, {
        name: dataToUpdate.name.trim(),
        location: dataToUpdate.location.trim(),
        description: dataToUpdate.description.trim(),
        status: dataToUpdate.status || 'Disponible'
      });
    }
    
    setIsModalOpen(false);
    await fetchLabs(); 
  };

  // FUNCIÓN CORREGIDA: Acepta labId y labName
  const handleDeleteLab = (labId, labName) => {
    MySwal.fire({
      title: `¿Eliminar el laboratorio "${labName}"?`, // Usa labName
      html: "¡ADVERTENCIA! Esta acción también eliminará <b>TODO</b> su inventario y es irreversible.",
      icon: 'error',
      showCancelButton: true,
      confirmButtonColor: '#c8102e',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Sí, entiendo el riesgo, eliminar',
      cancelButtonText: 'Cancelar'
    }).then(async (result) => {
      if (result.isConfirmed) {
        const deletingToast = toast.loading(`Eliminando "${labName}" y todo su contenido...`);
        const labDocRef = doc(db, 'laboratories', labId);
        
        // Eliminar subcolecciones
        const equipmentColRef = collection(labDocRef, 'equipment');
        const equipmentSnapshot = await getDocs(equipmentColRef);
        const batch = writeBatch(db);
        equipmentSnapshot.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();

        // Eliminar el laboratorio principal
        await deleteDoc(labDocRef);
        
        toast.dismiss(deletingToast);
        toast.success(`Laboratorio "${labName}" eliminado.`);
        
        setSelectedLab(null);
        fetchLabs();
      }
    });
  };
  

  return (
    <>
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={modalMode === 'add' ? 'Añadir Nuevo Laboratorio' : 'Editar Laboratorio'}>
        <form onSubmit={handleLabFormSubmit} className="modal-form">
          <div className="form-group">
            <label htmlFor="labName">Nombre del Laboratorio</label>
            <input id="labName" type="text" value={currentLabData.name} onChange={(e) => setCurrentLabData({...currentLabData, name: e.target.value})} required />
          </div>
          <div className="form-group">
            <label htmlFor="labLocation">Ubicación</label>
            <input id="labLocation" type="text" value={currentLabData.location} onChange={(e) => setCurrentLabData({...currentLabData, location: e.target.value})} required />
          </div>
          <div className="form-group">
            <label htmlFor="labDescription">Descripción (Opcional)</label>
            <textarea id="labDescription" value={currentLabData.description || ''} onChange={(e) => setCurrentLabData({...currentLabData, description: e.target.value})} rows="3"></textarea>
          </div>
          <div className="form-group">
          <label htmlFor="labStatus">Estado General del Laboratorio</label>
          {/* --- ENVOLVER EL SELECT CON EL NUEVO DIV --- */}
          <div className="select-wrapper">
          <select id="labStatus" value={currentLabData.status || 'Disponible'} onChange={(e) => setCurrentLabData({...currentLabData, status: e.target.value})}>
          <option value="Disponible">Disponible</option>
          <option value="Mantenimiento">Mantenimiento</option>
          </select>
          </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="action-btn cancel-btn" onClick={() => setIsModalOpen(false)}>Cancelar</button>
            <button type="submit" className="action-btn save-btn">{modalMode === 'add' ? 'Crear Laboratorio' : 'Guardar Cambios'}</button>
          </div>
        </form>
      </Modal>

      <div className="manager-layout">
        <aside className="sidebar">
          <div className="sidebar-header">
            <h2 className="sidebar-title">Laboratorios</h2>
            <button className="add-lab-btn" onClick={openAddLabModal}>+ Nuevo</button>
          </div>
          {isLoadingLabs ? <p>Cargando...</p> : (
            <ul className="lab-selector-list">
              {labs.map(lab => (
                <li key={lab.id} className={selectedLab?.id === lab.id ? 'active' : ''} onClick={() => handleSelectLab(lab)}>
                  {lab.name}
                </li>
              ))}
            </ul>
          )}
        </aside>

        <main className="main-content">
          {selectedLab ? (
            <>
              <div className="content-header">
                <div>
                  <h1>Gestionando: {selectedLab.name}</h1>
                  <p>{selectedLab.location}</p>
                </div>
                <div className="header-actions">
                  <button className="action-btn edit-btn" onClick={() => openEditLabModal(selectedLab)}>Editar</button>
                  {/* PASAMOS EL ID Y EL NOMBRE AL CLICKEAR ELIMINAR LAB */}
                  <button className="action-btn delete-btn" onClick={() => handleDeleteLab(selectedLab.id, selectedLab.name)}>Eliminar</button>
                </div>
              </div>

              <div className="manager-card">
                <h3 className="card-title">Añadir Nuevo Equipo</h3>
                <form onSubmit={handleAddEquipment} className="add-item-form">
                  <input type="text" placeholder="Nombre del equipo" value={newEquipment.name} onChange={(e) => setNewEquipment({ ...newEquipment, name: e.target.value })} required />
                  <input type="number" min="1" value={newEquipment.quantity} onChange={(e) => setNewEquipment({ ...newEquipment, quantity: Number(e.target.value) })} required />
                  <select value={newEquipment.status} onChange={(e) => setNewEquipment({ ...newEquipment, status: e.target.value })}>
                    <option value="Disponible">Disponible</option>
                    <option value="En Mantenimiento">En Mantenimiento</option>
                    <option value="Fuera de Servicio">Fuera de Servicio</option>
                  </select>
                  <button type="submit">Añadir</button>
                </form>
              </div>

              <div className="manager-card">
                <h3 className="card-title">Inventario de Equipamiento</h3>
                {isLoadingInventory ? <p>Cargando inventario...</p> : (
                  <table className="inventory-table-manager">
                    <thead>
                      <tr>
                        <th>Equipo</th>
                        <th>Cantidad</th>
                        <th>Estado</th>
                        <th className="actions-header">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {equipment.length > 0 ? equipment.map(item => (
                        <InventoryRow 
                          key={item.id} 
                          item={item} 
                          onUpdate={handleUpdateEquipment} 
                          onDelete={handleDeleteEquipment} // Aquí InventoryRow llama a la función con los argumentos correctos
                        />
                      )) : (
                        <tr>
                          <td colSpan="4" className="no-items-message">No hay equipos registrados en este laboratorio.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          ) : (
            <div className="placeholder-content">
              <h2>Selecciona un laboratorio</h2>
              <p>Elige un laboratorio de la lista para empezar a gestionar su inventario o crea uno nuevo.</p>
            </div>
          )}
        </main>
      </div>
    </>
  );
}