// src/pages/Admin/SpaceImporter.js
import React, { useState } from 'react';
import { db } from '../../firebaseConfig';
import { doc, writeBatch, Timestamp } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

export default function SpaceImporter() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleFileChange = (e) => setFile(e.target.files[0]);

  // Función mejorada para clasificar el tipo de espacio
  const classifyType = (tipoExcel, rotulo) => {
    const text = (tipoExcel + " " + rotulo).toLowerCase();
    if (text.includes('computo') || text.includes('lab') || text.includes('taller') || text.includes('redes')) return 'Laboratorio';
    if (text.includes('clinica') || text.includes('consultorio') || text.includes('simulacion') || text.includes('hospital')) return 'Clinica';
    if (text.includes('aula') || text.includes('room') || tipoExcel.includes('Normal')) return 'Aula';
    if (text.includes('polideportivo') || text.includes('cancha') || text.includes('piscina')) return 'Deporte';
    return 'Especializado';
  };

  const handleUpload = async () => {
    if (!file) return toast.error("Selecciona el archivo maestro.");
    setLoading(true);
    const toastId = toast.loading("Sincronizando todos los campus de CEUTEC...");

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(sheet);

        const batch = writeBatch(db);
        let count = 0;

        jsonData.forEach((row) => {
          const rawCodigo = String(row['CÓDIGO VISUAL'] || '').trim();
          const sede = String(row['SEDE'] || '').trim();
          const campus = String(row['CAMPUS'] || '').trim();

          // FILTRO DINÁMICO: Si el CAMPUS o la SEDE contienen "CEUTEC", lo procesamos.
          // Esto incluirá LCE, SPS Central, SPS Norte, TGU Prado, TGU Centroamérica.
          const isCeutec = campus.toUpperCase().includes('CEUTEC') || sede.toUpperCase().includes('CEUTEC');
          
          if (!rawCodigo || !isCeutec) return;

          // CORRECCIÓN DE FIREBASE: Reemplazar / por - para evitar error de segmentos
          const cleanedId = rawCodigo.replace(/\//g, '-');

          const spaceRef = doc(db, 'spaces', cleanedId);
          
          const spaceData = {
            id: cleanedId,
            codigoOriginal: rawCodigo,
            name: row['ROTULO'] || row['NOMBRE'] || rawCodigo,
            campus: campus,
            sede: sede,
            building: row['EDIFICIO'] || 'N/A',
            floor: row['PISO'] || '0',
            capacity: parseInt(row['CAPACIDAD']) || 0,
            type: classifyType(String(row['TIPO ESPACIO'] || ''), String(row['ROTULO'] || '')),
            status: row['ESTADO'] === 'Activo' ? 'Disponible' : 'Mantenimiento',
            areaM2: row['ÁREA M2'] || 0,
            updatedAt: Timestamp.now()
          };

          batch.set(spaceRef, spaceData);
          count++;
        });

        if (count === 0) {
            toast.error("No se encontraron registros de CEUTEC. Revisa las columnas CAMPUS o SEDE.");
            setLoading(false);
            toast.dismiss(toastId);
            return;
        }

        await batch.commit();
        toast.success(`🎉 ¡Éxito! Se sincronizaron ${count} espacios de todos los campus.`, { id: toastId });
        navigate('/admin/inventario');
      } catch (err) {
        console.error("Error en SpaceImporter:", err);
        toast.error("Error al procesar el archivo. Revisa los nombres de las columnas.", { id: toastId });
      } finally {
        setLoading(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="dashboard-wrapper">
      <div className="manager-card" style={{maxWidth: '700px', margin: '50px auto', textAlign: 'center'}}>
        <h2 className="card-title">Sincronización Maestra Multisede</h2>
        <p style={{marginBottom: '20px', color: '#666'}}>
            Sube el archivo para actualizar <strong>Aulas y Laboratorios</strong> de:<br/>
            SPS Norte, SPS Central, TGU Centroamérica, TGU Prado y La Ceiba.
        </p>
        
        <div style={{
          margin: '30px 0', 
          padding: '30px', 
          border: '2px dashed #c8102e', 
          borderRadius: '15px',
          backgroundColor: 'rgba(200, 16, 46, 0.02)'
        }}>
          <input type="file" accept=".xlsx, .xls" onChange={handleFileChange} />
          <p style={{fontSize: '0.8rem', color: '#999', marginTop: '10px'}}>
            Asegúrate de que la columna se llame exactamente <strong>CÓDIGO VISUAL</strong>.
          </p>
        </div>

        <button 
          onClick={handleUpload} 
          disabled={loading || !file} 
          className="auth-button"
          style={{width: '100%', padding: '15px'}}
        >
          {loading ? 'Procesando Datos...' : '🚀 Sincronizar Todos los Campus'}
        </button>
      </div>
    </div>
  );
}