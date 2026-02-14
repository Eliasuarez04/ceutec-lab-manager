// src/components/ReservationModal.js
import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { FACULTIES_DATA, RESERVATION_TYPES } from '../utils/academicMapping';
import { format, setHours, setMinutes } from 'date-fns';
import toast from 'react-hot-toast';
import './styles/ReservationModal.css'

const ReservationModal = ({ isOpen, onClose, spaceData, slotInfo, onSubmit, existingReservations }) => {
  const [formData, setFormData] = useState({
    reservationType: '', faculty: '', career: '', thDocente: '',
    section: '', className: '', studentCount: 0, purpose: '',
    startTime: '07:00', endTime: '08:30'
  });

  const [availableCareers, setAvailableCareers] = useState([]);

  useEffect(() => {
    if (isOpen && slotInfo) {
      setFormData(prev => ({
        ...prev,
        startTime: format(slotInfo.start, 'HH:mm'),
        endTime: format(slotInfo.end, 'HH:mm'),
        reservationType: '', faculty: '', career: '', thDocente: '', 
        section: '', className: '', studentCount: 0, purpose: ''
      }));
    }
  }, [isOpen, slotInfo]);

  useEffect(() => {
    if (formData.faculty) {
      setAvailableCareers(FACULTIES_DATA[formData.faculty] || []);
    }
  }, [formData.faculty]);

  const handleSubmit = (e) => {
    e.preventDefault();

    if (formData.studentCount > (spaceData?.capacity || 999)) {
      return toast.error(`¡Sobrecupo! Capacidad máxima: ${spaceData.capacity}`);
    }

    // --- PROCESAMIENTO DE HORAS ---
    const [startH, startM] = formData.startTime.split(':');
    const [endH, endM] = formData.endTime.split(':');

    // Combinamos la fecha del slot con la hora manual del formulario
    const finalStart = setMinutes(setHours(new Date(slotInfo.start), startH), startM);
    const finalEnd = setMinutes(setHours(new Date(slotInfo.start), endH), endM);

    if (finalStart >= finalEnd) {
      return toast.error("La hora de fin debe ser posterior a la de inicio");
    }

    // VALIDACIÓN DE SOLAPAMIENTO
    const isOverlapping = existingReservations.some(res => {
      if (res.labId !== spaceData.id) return false;
      const resStart = new Date(res.start);
      const resEnd = new Date(res.end);
      return finalStart < resEnd && finalEnd > resStart;
    });

    if (isOverlapping) {
      return toast.error("Este horario ya está ocupado.");
    }

    onSubmit({ ...formData, start: finalStart, end: finalEnd });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Reserva de Espacio: ${spaceData?.name}`}>
      <div className="academic-modal-wrapper">
        <form onSubmit={handleSubmit} className="academic-form-pro">
          
          <div className="form-section-title">Horario</div>
          <div className="form-row-pro">
            <div className="field-group full">
              <label>Tipo de Reserva</label>
              <select required value={formData.reservationType} onChange={(e) => setFormData({...formData, reservationType: e.target.value})}>
                <option value="">Seleccione tipo...</option>
                {RESERVATION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div className="form-row-pro">
            <div className="field-group">
              <label>Desde</label>
              <input type="time" required value={formData.startTime} onChange={(e) => setFormData({...formData, startTime: e.target.value})} />
            </div>
            <div className="field-group">
              <label>Hasta</label>
              <input type="time" required value={formData.endTime} onChange={(e) => setFormData({...formData, endTime: e.target.value})} />
            </div>
          </div>

          <div className="form-section-title">Datos de la Clase</div>
          <div className="form-row-pro">
            <div className="field-group">
              <label>Facultad</label>
              <select required value={formData.faculty} onChange={(e) => setFormData({...formData, faculty: e.target.value, career: ''})}>
                <option value="">Seleccione...</option>
                {Object.keys(FACULTIES_DATA).map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div className="field-group">
              <label>Carrera</label>
              <select required value={formData.career} onChange={(e) => setFormData({...formData, career: e.target.value})}>
                <option value="">Seleccione...</option>
                {availableCareers.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="form-row-pro">
            <div className="field-group">
              <label>TH Docente</label>
              <input type="text" required placeholder="ID" value={formData.thDocente} onChange={(e) => setFormData({...formData, thDocente: e.target.value})} />
            </div>
            <div className="field-group">
              <label>Sección</label>
              <input type="text" required placeholder="Sección" value={formData.section} onChange={(e) => setFormData({...formData, section: e.target.value})} />
            </div>
          </div>

          <div className="form-row-pro">
            <div className="field-group full">
              <label>Asignatura</label>
              <input type="text" required placeholder="Nombre de la clase" value={formData.className} onChange={(e) => setFormData({...formData, className: e.target.value})} />
            </div>
          </div>

          <div className="form-row-pro">
            <div className="field-group">
              <label>Nº Alumnos</label>
              <input type="number" required min="1" value={formData.studentCount} onChange={(e) => setFormData({...formData, studentCount: Number(e.target.value)})} />
            </div>
            <div className="field-group">
              <label>Observaciones</label>
              <input type="text" placeholder="Opcional" value={formData.purpose} onChange={(e) => setFormData({...formData, purpose: e.target.value})} />
            </div>
          </div>

          <div className="modal-footer-pro">
            <button type="button" onClick={onClose} className="btn-cancel-pro">Cancelar</button>
            <button type="submit" className="btn-save-pro">Confirmar Reserva</button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

export default ReservationModal;