// src/components/ReservationModal.js
import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { FACULTIES_DATA, RESERVATION_TYPES } from '../utils/academicMapping';
import { format, setHours, setMinutes } from 'date-fns';
import toast from 'react-hot-toast';
import './styles/ReservationModal.css';

const ReservationModal = ({ isOpen, onClose, spaceData, slotInfo, onSubmit, existingReservations, existingReservation }) => {
  const[formData, setFormData] = useState({
    reservationType: '', faculty: '', career: '', thDocente: '',
    section: '', className: '', studentCount: 0, purpose: '',
    startTime: '07:00', endTime: '08:30'
  });

  const[availableCareers, setAvailableCareers] = useState([]);

  // Lógica para pre-llenar datos si estamos editando, o limpiar si es nueva reserva
  useEffect(() => {
    if (isOpen) {
      if (existingReservation) {
        // MODO EDICIÓN: Mapeamos los datos de la BD al formulario del modal
        setFormData({
          reservationType: existingReservation.reservationType || '',
          faculty: existingReservation.faculty || '',
          career: existingReservation.career || '',
          thDocente: existingReservation.th || '', // Usar nombre de BD
          section: existingReservation.section || '',
          className: existingReservation.className || '',
          studentCount: existingReservation.attendees || 0, // Usar nombre de BD
          purpose: existingReservation.purpose || '',
          startTime: format(existingReservation.startTime.toDate(), 'HH:mm'),
          endTime: format(existingReservation.endTime.toDate(), 'HH:mm')
        });
      } else {
        // MODO CREACIÓN: Limpiar campos
        setFormData({
          reservationType: '', faculty: '', career: '', thDocente: '',
          section: '', className: '', studentCount: 0, purpose: '',
          startTime: slotInfo ? format(slotInfo.start, 'HH:mm') : '07:00',
          endTime: slotInfo ? format(slotInfo.end, 'HH:mm') : '08:30'
        });
      }
    }
  }, [isOpen, existingReservation, slotInfo]);

  // Lógica de Carreras Dinámicas
  useEffect(() => {
    if (formData.faculty) {
      setAvailableCareers(FACULTIES_DATA[formData.faculty] || []);
    } else {
      setAvailableCareers([]);
    }
  },[formData.faculty]);

  const handleSubmit = (e) => {
    e.preventDefault();

    if (formData.studentCount > (spaceData?.capacity || 999)) {
      return toast.error(`¡Sobrecupo! Capacidad máxima: ${spaceData.capacity}`);
    }

    // 1. Calcular fechas finales de la nueva reserva
    const baseDate = slotInfo ? slotInfo.start : (existingReservation ? existingReservation.startTime.toDate() : new Date());
    const [startH, startM] = formData.startTime.split(':');
    const [endH, endM] = formData.endTime.split(':');

    const finalStart = setMinutes(setHours(new Date(baseDate), startH), startM);
    const finalEnd = setMinutes(setHours(new Date(baseDate), endH), endM);

    /*const horasAnticipacion = 24; 
    const tiempoActual = new Date();
    const diferenciaHoras = (finalStart - tiempoActual) / (1000 * 60 * 60);

    // Solo aplicar la regla si NO es una edición (para no bloquear actualizaciones de reservas ya hechas)
    if (!existingReservation && diferenciaHoras < horasAnticipacion) {
      return toast.error(`⚠️ Debe reservar con al menos ${horasAnticipacion} horas de anticipación por motivos de logística.`);
    }*/

    if (finalStart >= finalEnd) {
      return toast.error("La hora de fin debe ser posterior a la de inicio");
    }

    // 2. VALIDACIÓN DE CHOQUE DE HORARIOS (OVERLAP)
    // Buscamos si hay alguna reserva que coincida en el mismo laboratorio y se cruce en el tiempo
    const conflict = existingReservations?.find(res => {
      // Si estamos editando, no comparamos con la misma reserva
      if (existingReservation && res.id === existingReservation.id) return false;

      // Solo validar reservas del mismo laboratorio
      const sameLab = res.labId === spaceData.id;
      
      if (sameLab) {
        const resStart = res.startTime?.toDate ? res.startTime.toDate() : new Date(res.start);
        const resEnd = res.endTime?.toDate ? res.endTime.toDate() : new Date(res.end);

        // Lógica de traslape: (InicioA < FinB) Y (FinA > InicioB)
        return (finalStart < resEnd && finalEnd > resStart);
      }
      return false;
    });

    if (conflict) {
      return toast.error(`⚠️ Error: Ya existe una reserva para ${conflict.className || 'otra materia'} en este horario.`);
    }

    // 3. Si todo está bien, enviar datos
    onSubmit({ ...formData, start: finalStart, end: finalEnd });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Reserva: ${spaceData?.name || 'Espacio'}`}>
      <div className="academic-modal-wrapper">
        <form onSubmit={handleSubmit} className="academic-form-pro">
          
          {/* SECCIÓN 1: HORARIO */}
          <div className="form-section-header">
            <span className="icon">⏰</span> Configuración de Horario
          </div>
          
          <div className="form-row-pro">
            <div className="field-group full">
              <label>Tipo de Reserva</label>
              <select required value={formData.reservationType} onChange={(e) => setFormData({...formData, reservationType: e.target.value})}>
                <option value="">Seleccione tipo...</option>
                {(RESERVATION_TYPES || ['Clase', 'Examen', 'Taller']).map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div className="form-row-pro">
            <div className="field-group">
              <label>Hora Inicio</label>
              <input type="time" required className="time-input" value={formData.startTime} onChange={(e) => setFormData({...formData, startTime: e.target.value})} />
            </div>
            <div className="field-group">
              <label>Hora Fin</label>
              <input type="time" required className="time-input" value={formData.endTime} onChange={(e) => setFormData({...formData, endTime: e.target.value})} />
            </div>
          </div>

          {/* SECCIÓN 2: DATOS ACADÉMICOS */}
          <div className="form-section-header" style={{marginTop: '20px'}}>
            <span className="icon">🎓</span> Datos de la Clase
          </div>

          <div className="form-row-pro">
            <div className="field-group">
              <label>Facultad</label>
              <select required value={formData.faculty} onChange={(e) => setFormData({...formData, faculty: e.target.value, career: ''})}>
                <option value="">Seleccione...</option>
                {Object.keys(FACULTIES_DATA || {}).map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div className="field-group">
              <label>Carrera</label>
              <select required value={formData.career} onChange={(e) => setFormData({...formData, career: e.target.value})} disabled={!formData.faculty}>
                <option value="">{formData.faculty ? "Seleccione..." : "Elija Facultad primero"}</option>
                {availableCareers.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="form-row-pro">
            <div className="field-group">
              <label>TH Docente</label>
              <input type="text" required placeholder="ID Empleado" value={formData.thDocente} onChange={(e) => setFormData({...formData, thDocente: e.target.value})} />
            </div>
            <div className="field-group">
              <label>Sección</label>
              <input type="text" required placeholder="Ej: 1234" value={formData.section} onChange={(e) => setFormData({...formData, section: e.target.value})} />
            </div>
          </div>

          <div className="form-row-pro">
            <div className="field-group full">
              <label>Asignatura / Nombre Clase</label>
              <input type="text" required placeholder="Nombre oficial de la asignatura" value={formData.className} onChange={(e) => setFormData({...formData, className: e.target.value})} />
            </div>
          </div>

          <div className="form-row-pro">
            <div className="field-group">
              <label>Nº Alumnos</label>
              <input type="number" required min="1" value={formData.studentCount} onChange={(e) => setFormData({...formData, studentCount: Number(e.target.valueAsNumber || e.target.value)})} />
            </div>
            <div className="field-group">
              <label>Observaciones</label>
              <input type="text" placeholder="Opcional..." value={formData.purpose} onChange={(e) => setFormData({...formData, purpose: e.target.value})} />
            </div>
          </div>

          <div className="modal-footer-pro">
            <button type="button" onClick={onClose} className="btn-cancel-pro">Cancelar</button>
            <button type="submit" className="btn-save-pro">{existingReservation ? "Actualizar Reserva" : "Confirmar Reserva"}</button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

export default ReservationModal;