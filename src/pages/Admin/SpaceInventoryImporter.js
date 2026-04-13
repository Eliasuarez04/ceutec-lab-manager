// src/pages/Admin/SpaceInventoryImporter.js
import React, { useState } from 'react';
import { db } from '../../firebaseConfig';
import { collection, getDocs, doc, writeBatch } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const REGION_MAPPING = {
  "San Pedro Sula": ["Ceutec SPS Norte", "Ceutec SPS Central"],
  "Tegucigalpa": ["Ceutec TGU (Prado)", "Ceutec TGU (Centroamerica)"],
  "La Ceiba": ["Ceutec LCE"]
};

export default function SpaceInventoryImporter() {
  const { userData } = useAuth();
  const [searchParams] = useSearchParams();
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);

  // CAPTURA DE SEDE PARA EL RETORNO SEGURO
  const currentSede = searchParams.get('sede') || userData?.sede || "";

  // 🔴 SINCRONIZADO: El nombre de la función ahora coincide con el onChange del input
  const handleFileChange = (e) => setFile(e.target.files[0]);

  const processExcel = async () => {
    if (!file) return toast.error("Selecciona el archivo de inventario.");
    if (!userData?.city || !userData?.role) return toast.error("Faltan datos en tu perfil.");

    setLoading(true);
    setLogs([]);
    const toastId = toast.loading("Iniciando subida limpia...");

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        
        const managedType = userData.role === 'coord_labs' ? 'Laboratorio' : 'Aula';
        const allowedSedes = REGION_MAPPING[userData.city] || [];

        const spacesSnap = await getDocs(collection(db, 'spaces'));
        const nameToIdMap = {}; 

        spacesSnap.forEach(d => {
            const spaceData = d.data();
            const dbName = (spaceData.name || "").toLowerCase().trim();
            const dbSede = (spaceData.sede || "").toLowerCase();
            const dbType = (spaceData.type || "");

            const esDeMiCiudad = allowedSedes.some(s => {
                const sNorm = s.toLowerCase();
                return dbSede.includes(sNorm) || sNorm.includes(dbSede);
            });

            if (esDeMiCiudad && (userData.role === 'superadmin' || dbType === managedType)) {
                nameToIdMap[dbName] = d.id;
            }
        });

        let totalInserted = 0;
        let totalDeleted = 0;
        const newLogs = [];

        // Usamos for...of para procesar las hojas una por una (Evita bloqueos de memoria)
        for (const sheetName of workbook.SheetNames) {
          const cleanSheetName = sheetName.toLowerCase().trim();
          const spaceDocId = nameToIdMap[cleanSheetName];

          if (!spaceDocId) {
            newLogs.push(`🚫 Saltado: "${sheetName}" (Sin permisos o no existe)`);
            continue;
          }

          const sheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(sheet, { range: 1 });

          if (jsonData.length === 0) {
            newLogs.push(`⚠️ "${sheetName}" está vacía en Excel.`);
            continue;
          }

          const equipmentRef = collection(db, 'spaces', spaceDocId, 'equipment');
          const oldItemsSnap = await getDocs(equipmentRef);
          
          let batch = writeBatch(db);
          let opCounter = 0;

          // 1. ELIMINAR REGISTROS PREVIOS
          for (const oldItem of oldItemsSnap.docs) {
            batch.delete(oldItem.ref);
            opCounter++;
            totalDeleted++;
            
            if (opCounter >= 400) {
              await batch.commit();
              batch = writeBatch(db);
              opCounter = 0;
            }
          }

          // 2. INSERTAR NUEVOS REGISTROS
          for (const row of jsonData) {
            const itemName = String(row['Nombre'] || '').trim();
            if (!itemName) continue;

            const newItemRef = doc(equipmentRef); 
            
            batch.set(newItemRef, {
              name: itemName,
              brand: String(row['Marca'] || 'N/A').trim(),
              model: String(row['Modelo'] || 'N/A').trim(),
              quantity: parseInt(row['Cantidad']) || 0,
              type: String(row['Tipo'] || '').trim(),
              location: String(row['Ubicación'] || '').trim(),
              column: String(row['Columna de localización'] || '').trim(),
              observations: String(row['Observaciones'] || '').trim(),
              lastUpdate: new Date(),
              updatedBy: userData.email,
              status: 'Disponible'
            });

            opCounter++;
            totalInserted++;

            if (opCounter >= 400) {
              await batch.commit();
              batch = writeBatch(db);
              opCounter = 0;
            }
          }

          await batch.commit();
          newLogs.push(`✅ "${sheetName}" actualizado.`);
        }

        setLogs(newLogs);
        // Usamos totalDeleted y totalInserted en el toast final para satisfacer ESLint
        toast.success(`Carga completa. Insertados: ${totalInserted}, Borrados: ${totalDeleted}`, { id: toastId });

      } catch (err) {
        console.error(err);
        toast.error("Error al procesar el archivo.", { id: toastId });
      } finally {
        setLoading(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="dashboard-wrapper">
      <div className="manager-card" style={{maxWidth: '800px', margin: '40px auto'}}>
        <header className="page-header" style={{borderBottom:'2px solid #eee', paddingBottom:'15px'}}>
            <h1>🚀 Carga de Inventario: Reemplazo Total</h1>
            <p>Sede Actual: <strong>{currentSede}</strong></p>
        </header>

        <div className="alert-warning" style={{background: '#fff3cd', color: '#856404', padding: '15px', borderRadius: '12px', margin: '20px 0', border: '1px solid #ffeeba', fontSize: '0.9rem'}}>
            <strong>⚠️ Atención:</strong> Se borrará el inventario actual de los espacios en el Excel y se reemplazará por la nueva información.
        </div>

        <div className="import-zone" style={{ border: '2px dashed #c8102e', padding: '40px', borderRadius: '20px', textAlign: 'center', background: 'rgba(200, 16, 46, 0.02)', marginBottom: '20px' }}>
            {/* 🔴 CORREGIDO: handleFileChange es el nombre correcto */}
            <input type="file" accept=".xlsx, .xls" onChange={handleFileChange} />
        </div>

        <div className="actions" style={{display: 'flex', gap: '15px'}}>
            <button onClick={processExcel} disabled={loading || !file} className="btn-save-pro" style={{flex: 1, height: '50px', background: loading ? '#ccc' : '#c8102e'}}>
                {loading ? 'Procesando...' : '🔥 Iniciar Reemplazo de Datos'}
            </button>
            
            <Link 
                to={`/admin/inventario?sede=${encodeURIComponent(currentSede)}`} 
                className="btn-cancel-pro" 
                style={{textDecoration:'none', display:'flex', alignItems:'center', justifyContent: 'center', background: '#eee', padding: '0 20px', borderRadius: '10px'}}
            >
                Cancelar
            </Link>
        </div>

        {logs.length > 0 && (
            <div className="logs-container" style={{ marginTop: '30px', padding: '20px', background: '#1a202c', color: '#fff', borderRadius: '12px', maxHeight: '250px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                <div style={{color:'#ffc107', fontWeight:'bold', marginBottom:'10px'}}>Monitor de Proceso:</div>
                {logs.map((log, i) => <div key={i} style={{marginBottom:'4px', borderBottom:'1px solid #333'}}>{log}</div>)}
            </div>
        )}
      </div>
    </div>
  );
}