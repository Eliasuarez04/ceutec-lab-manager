// src/components/ReservationModal.js
import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import Select from 'react-select';
import toast from 'react-hot-toast';
import Modal from './Modal';
import './styles/ReservationModal.css'; // Crearemos este archivo de estilos

export default function ReservationModal({ isOpen, onClose, labName, slotInfo, inventory, existingReservation, onSubmit }) {
  const [purpose, setPurpose] = useState('');
  const [selectedItems, setSelectedItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Este useEffect se encarga de pre-rellenar el formulario cuando es para editar
  useEffect(() => {
    if (existingReservation) {
      setPurpose(existingReservation.purpose || '');
      // Mapeamos los items guardados al formato que necesita nuestra 'factura'
      const preSelectedItems = existingReservation.requestedItems.map(reqItem => {
        const inventoryItem = inventory.find(invItem => invItem.id === reqItem.itemId);
        return {
          ...inventoryItem,
          id: reqItem.itemId,
          name: reqItem.itemName,
          requestQuantity: reqItem.quantity
        };
      });
      setSelectedItems(preSelectedItems);
    } else {
      // Si es para crear, nos aseguramos que esté limpio
      setPurpose('');
      setSelectedItems([]);
    }
  }, [existingReservation, inventory, isOpen]);

  const handleAddItem = (selectedOption) => {
    if (selectedItems.find(item => item.id === selectedOption.id)) return;
    setSelectedItems(prev => [...prev, { ...selectedOption, requestQuantity: 1 }]);
  };
  
  const handleQuantityChange = (itemId, value) => {
    const quantity = parseInt(value, 10);
    const item = selectedItems.find(i => i.id === itemId);
    if (isNaN(quantity) || quantity < 1) {
      setSelectedItems(prev => prev.filter(i => i.id !== itemId));
    } else if (quantity > item.quantity) {
      toast.error(`Máximo disponible para ${item.name}: ${item.quantity}.`);
      setSelectedItems(prev => prev.map(i => i.id === itemId ? { ...i, requestQuantity: item.quantity } : i));
    } else {
      setSelectedItems(prev => prev.map(i => i.id === itemId ? { ...i, requestQuantity: quantity } : i));
    }
  };

  const handleRemoveItem = (itemId) => {
    setSelectedItems(prev => prev.filter(i => i.id !== itemId));
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    const itemsToSave = selectedItems.map(item => ({
      itemId: item.id,
      itemName: item.name,
      quantity: item.requestQuantity,
    }));
    // Llamamos a la función onSubmit que nos pasó el componente padre
    await onSubmit({ purpose, requestedItems: itemsToSave });
    setIsLoading(false);
  };
  
  const title = existingReservation ? 'Editar Reserva' : 'Confirmar Reserva';
  const displayDate = existingReservation ? existingReservation.startTime.toDate() : slotInfo?.start;
  const displayEndDate = existingReservation ? existingReservation.endTime.toDate() : slotInfo?.end;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      { (slotInfo || existingReservation) && (
        <form onSubmit={handleSubmit} className="modal-form">
          <p><strong>Laboratorio:</strong> {labName}</p>
          <p><strong>Fecha:</strong> {displayDate?.toLocaleDateString('es-ES', {weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'})}</p>
          <p><strong>Horario:</strong> {`${format(displayDate || new Date(), 'HH:mm')} - ${format(displayEndDate || new Date(), 'HH:mm')}`}</p>
          
          <div className="form-group">
            <label htmlFor="purpose">Motivo de la Reserva</label>
            <input id="purpose" type="text" value={purpose} onChange={(e) => setPurpose(e.target.value)} required />
          </div>

          <div className="inventory-request-section">
            <h4>Solicitar Equipos/Insumos (Opcional)</h4>
            <Select
              options={inventory}
              onChange={handleAddItem}
              placeholder="Busca y selecciona un ítem..."
              noOptionsMessage={() => 'No hay ítems disponibles.'}
              value={null}
            />
            {selectedItems.length > 0 && (
              <div className="selected-items-list">
                {selectedItems.map(item => (
                  <div key={item.id} className="selected-item-row">
                    <span className="item-name">{item.name} (Disp: {item.quantity})</span>
                    <input type="number" min="1" max={item.quantity} value={item.requestQuantity}
                      onChange={(e) => handleQuantityChange(item.id, e.target.value)} className="quantity-input" />
                    <button type="button" onClick={() => handleRemoveItem(item.id)} className="remove-item-btn">&times;</button>
                  </div>
                ))}
              </div>
            )}
          </div>
            
          <div className="modal-actions">
            <button type="button" className="action-btn cancel-btn" onClick={onClose}>Cancelar</button>
            <button type="submit" className="action-btn save-btn" disabled={isLoading}>
              {isLoading ? 'Guardando...' : (existingReservation ? 'Guardar Cambios' : 'Confirmar y Reservar')}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}