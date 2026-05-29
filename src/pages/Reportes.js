// src/pages/Reportes.js
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, getDocs, query, where, Timestamp, orderBy } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { format, getDay, getHours, startOfDay, endOfDay, parseISO } from 'date-fns';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import './styles/Reportes.css';
import * as XLSX from 'xlsx';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const ReporteUso = ({ data }) => {
  const labUsageData = useMemo(() => {
    const counts = data.reduce((acc, res) => {
      const name = res.labName || res.spaceName || "Sin Nombre";
      acc[name] = (acc[name] || 0) + 1;
      return acc;
    }, {});
    const sortedLabs = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return {
      labels: sortedLabs.map(lab => lab[0]),
      datasets: [{ label: 'Nº de Reservas', data: sortedLabs.map(lab => lab[1]), backgroundColor: 'rgba(200, 16, 46, 0.7)' }],
    };
  }, [data]);

  const dayUsageData = useMemo(() => {
    const dayCounts = [0, 0, 0, 0, 0, 0, 0];
    data.forEach(res => {
      const sTime = res.startTime || res.start;
      if (sTime && sTime.toDate) {
        const date = sTime.toDate();
        const day = getDay(date);
        dayCounts[day]++;
      }
    });
    return {
      labels: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
      datasets: [{ label: 'Nº de Reservas', data: dayCounts, backgroundColor: 'rgba(0, 123, 255, 0.7)' }],
    };
  }, [data]);

  return (
    <div className="report-grid">
      <div className="chart-wrapper">
        <Bar data={labUsageData} options={{ indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins:{title:{display:true, text:'Uso por Espacio Académico'}}}} />
      </div>
      <div className="chart-wrapper">
        <Bar data={dayUsageData} options={{ responsive: true, maintainAspectRatio: false, plugins:{title:{display:true, text:'Distribución por Día'}}}} />
      </div>
    </div>
  );
};

const ReporteHeatmap = ({ data }) => {
  const heatmapData = useMemo(() => {
    const grid = Array(16).fill(0).map(() => Array(7).fill(0));
    let maxReservations = 0;
    data.forEach(res => {
      const sTime = res.startTime || res.start;
      if (sTime && sTime.toDate) {
        const date = sTime.toDate();
        const day = getDay(date);
        const hour = getHours(date);
        const hourIndex = hour - 7;
        if (hourIndex >= 0 && hourIndex < 16) {
          grid[hourIndex][day]++;
          if (grid[hourIndex][day] > maxReservations) maxReservations = grid[hourIndex][day];
        }
      }
    });
    return { grid, maxReservations };
  }, [data]);

  const getCellColor = (count) => {
    if (count === 0) return { backgroundColor: '#f9f9f9', color: '#ccc' };
    const intensity = Math.min(count / (heatmapData.maxReservations || 1), 1);
    return { backgroundColor: `rgba(200, 16, 46, ${intensity})`, color: intensity > 0.5 ? 'white' : 'black', fontWeight: 'bold' };
  };

  return (
    <div className="report-section fade-in">
      <h3 style={{textAlign: 'center', marginBottom: '20px', color: '#333'}}>Mapa de Calor de Ocupación Semanal</h3>
      <div className="heatmap-container">
        <table className="heatmap-table">
          <thead><tr><th>Hora</th><th>Dom</th><th>Lun</th><th>Mar</th><th>Mié</th><th>Jue</th><th>Vie</th><th>Sáb</th></tr></thead>
          <tbody>
            {heatmapData.grid.map((row, hourIndex) => (
              <tr key={hourIndex}>
                <td className="hour-label">{`${hourIndex + 7}:00`}</td>
                {row.map((count, dayIndex) => (
                  <td key={dayIndex} style={getCellColor(count)}>{count > 0 ? count : '-'}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const ReporteInventario = ({ logs }) => {
    return (
      <div className="report-section fade-in">
        <div className="history-table-container">
          <table className="history-table">
            <thead><tr><th>Fecha</th><th>Laboratorio</th><th>Equipo</th><th>Cambio</th><th>Usuario</th></tr></thead>
            <tbody>
              {logs.length > 0 ? logs.map(log => (
                <tr key={log.id}>
                  <td>{log.timestamp && log.timestamp.toDate ? format(log.timestamp.toDate(), 'dd/MM/yy HH:mm') : 'N/A'}</td>
                  <td>{log.labName}</td>
                  <td>{log.itemName}</td>
                  <td><span className={`change-badge ${log.changeType ? log.changeType.toLowerCase().replace(' ', '-') : ''}`}>{log.changeType}</span></td>
                  <td>{log.userEmail}</td>
                </tr>
              )) : (
                <tr><td colSpan="5" style={{ textAlign: 'center', padding: '2rem' }}>No hay registros de inventario para esta sede en este rango.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
};

export default function Reportes() {
  const [searchParams] = useSearchParams();
  const currentSede = searchParams.get('sede') || "";

  const [activeTab, setActiveTab] = useState('uso');
  const [startDate, setStartDate] = useState(format(new Date(new Date().setMonth(new Date().getMonth() - 1)), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  
  const [reservationData, setReservationData] = useState([]);
  const [inventoryLogData, setInventoryLogData] = useState([]);
  const [loading, setLoading] = useState(false);

  // 🔥 EXPORTACIÓN BLINDADA: Filtros agresivos para diferenciar el Origen 🔥
  const handleExportExcel = () => {
    if (reservationData.length === 0) {
      return toast.error("No hay datos para exportar en estas fechas.");
    }

    const reportData = reservationData.map(res => {
      const sTime = res.startTime || res.start;
      const eTime = res.endTime || res.end;
      
      const fechaClase = (sTime && sTime.toDate) ? format(sTime.toDate(), 'dd/MM/yyyy') : 'N/A';
      const horaInicio = (sTime && sTime.toDate) ? format(sTime.toDate(), 'HH:mm') : '--:--';
      const horaFin = (eTime && eTime.toDate) ? format(eTime.toDate(), 'HH:mm') : '--:--';
      
      // 1. Identificador de Origen (RED DE PESCA MÚLTIPLE)
      let tipoReserva = 'Carga Académica'; // Asumimos Carga por defecto
      
      // Si el campo directo dice Manual (ignora mayúsculas/minúsculas o espacios)
      if (res.reservationType && String(res.reservationType).trim().toLowerCase() === 'manual') {
          tipoReserva = 'Reserva Manual';
      } 
      // Si no trae el campo, pero trae datos exclusivos de reservas manuales
      else if (res.reservedByName || res.reservedByEmail || res.purpose) {
          tipoReserva = 'Reserva Manual';
      }

      // 2. Extracción de Docente
      let nombreDocente = res.reservedByName || res.userName || 'Sin Docente';
      if (nombreDocente === 'Carga Académica') nombreDocente = 'Sin Docente Asignado';
      
      // 3. Extracción de Correo
      let correoDocente = res.reservedByEmail || res.userEmail || 'N/A';
      if (correoDocente === 'Carga Académica') {
          correoDocente = res.reservedByEmail ? res.reservedByEmail : 'N/A';
      }

      // 4. Extracción de TH 
      const numeroTH = res.thDocente || res.th || res.TH || 'N/A';
      
      // 5. Extracción de Alumnos 
      const cantidadAlumnos = res.studentCount || res.attendees || res.capacity || 0;

      // 6. Limpieza de Motivo / Materia
      let motivoClase = res.className || res.purpose || res.title || 'Sin especificar';
      if (motivoClase.trim() === '') motivoClase = 'Sin especificar';

      return {
        'Origen': tipoReserva, // <- Ahora sí saldrá perfecto
        'Sede': res.sede || res.campus || 'N/A',
        'Tipo Espacio': res.spaceType || res.labType || 'N/A',
        'ID Espacio': res.labId || res.spaceId || 'N/A',
        'Nombre Espacio': res.labName || res.spaceName || 'N/A',
        'Docente / Solicitante': nombreDocente,
        'Correo': correoDocente,
        'No. Empleado (TH)': numeroTH,
        'Código Materia': res.subjectCode || res.code || 'N/A',
        'Clase / Motivo': motivoClase,
        'Sección': res.section || res.seccion || 'N/A',
        'Estudiantes': cantidadAlumnos,
        'Fecha': fechaClase,
        'Hora Inicio': horaInicio,
        'Hora Fin': horaFin,
        'Estado Reserva': res.status || res.fulfillmentStatus || 'Activa',
        'Estado Asistencia': res.attendance?.status || res.fulfillmentStatus || 'Pendiente',
        'Check-In Real': (res.checkInTime && res.checkInTime.toDate) ? format(res.checkInTime.toDate(), 'HH:mm:ss') : 'N/A',
        'Check-Out Real': (res.checkOutTime && res.checkOutTime.toDate) ? format(res.checkOutTime.toDate(), 'HH:mm:ss') : 'N/A',
        'Notas / Cancelación': res.attendance?.reason || res.cancelReason || '',
        'Audit (Marcado Por)': res.attendance?.markedBy || res.canceledByAdmin || ''
      };
    });

    const ws = XLSX.utils.json_to_sheet(reportData);
    
    // Auto-ajuste visual de celdas
    const wscols = [
      {wch: 18}, {wch: 25}, {wch: 15}, {wch: 12}, {wch: 25}, 
      {wch: 35}, {wch: 30}, {wch: 18}, {wch: 15}, {wch: 35}, 
      {wch: 10}, {wch: 12}, {wch: 12}, {wch: 12}, {wch: 12}, 
      {wch: 15}, {wch: 18}, {wch: 15}, {wch: 15}, {wch: 30}, 
      {wch: 25}
    ];
    ws['!cols'] = wscols;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Asistencia y Operaciones");
    
    const fileName = `Reporte_SpaceOne_${currentSede.replace(/[^a-zA-Z0-9]/g, '')}_${format(new Date(), 'ddMMyyyy')}.xlsx`;
    XLSX.writeFile(wb, fileName);
    
    toast.success("Excel generado correctamente. Origen Diferenciado. 📊");
  };

  const fetchData = useCallback(async () => {
    if (!startDate || !endDate || !currentSede) return;
    setLoading(true);
    
    try {
      const start = Timestamp.fromDate(startOfDay(parseISO(startDate)));
      const end = Timestamp.fromDate(endOfDay(parseISO(endDate)));

      const resQuery = query(
        collection(db, 'reservations'), 
        where('startTime', '>=', start), 
        where('startTime', '<=', end),
        orderBy('startTime', 'asc') 
      );

      const logQuery = query(
        collection(db, 'inventory_logs'), 
        where('timestamp', '>=', start),
        where('timestamp', '<=', end),
        orderBy('timestamp', 'desc')
      );

      const [resSnap, logSnap] = await Promise.all([getDocs(resQuery), getDocs(logQuery)]);
      
      const sedeNormalizada = currentSede.toLowerCase().replace('ceutec', '').replace(/[()]/g, '').trim();

      const filteredRes = resSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(res => {
          const resSede = (res.sede || res.campus || res.Sede || "").toLowerCase();
          return resSede.includes(sedeNormalizada) || sedeNormalizada.includes(resSede);
        });

      const filteredLogs = logSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(log => {
          const logSede = (log.sede || log.campus || "").toLowerCase();
          return logSede.includes(sedeNormalizada) || sedeNormalizada.includes(logSede);
        });

      setReservationData(filteredRes);
      setInventoryLogData(filteredLogs);

      if (filteredRes.length === 0 && filteredLogs.length === 0) {
          toast("No se encontraron datos para este rango de fechas", { icon: 'ℹ️' });
      }

    } catch (error) {
      console.error("Error en Reportes:", error);
      toast.error("Error al cargar datos. Verifica la consola.");
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, currentSede]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="dashboard-wrapper">
      <div className="reports-page-card">
        
        <div className="nav-back-container">
            <Link to={`/dashboard?sede=${encodeURIComponent(currentSede)}`} className="back-link-report">
               ← Volver al Dashboard
            </Link>
        </div>
        
        <header className="page-header-reports">
          <h1>Módulo de Reportería</h1>
          <p>Sede: <strong>{currentSede}</strong></p>
        </header>
        
        <div className="report-controls">
          <div className="tabs">
            <button className={activeTab === 'uso' ? 'active' : ''} onClick={() => setActiveTab('uso')}>Análisis de Uso</button>
            <button className={activeTab === 'heatmap' ? 'active' : ''} onClick={() => setActiveTab('heatmap')}>Mapa de Calor</button>
            <button className={activeTab === 'inventario' ? 'active' : ''} onClick={() => setActiveTab('inventario')}>Historial Inventario</button>
          </div>
          <div className="filters">
            <div className="date-group">
                <label>Desde:</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="date-group">
                <label>Hasta:</label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
            <button onClick={handleExportExcel} className="export-btn-xlsx" style={{ background: '#1d6f42', color: 'white', padding: '10px 20px', borderRadius: '10px', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>
                📊 Exportar Reporte Operativo (Excel)
            </button>
          </div>
        </div>
        
        <div className="tab-content">
          {loading ? (
            <div className="loading-msg">
                <div className="spinner"></div>
                Procesando datos de {currentSede}...
            </div>
          ) : (
            <>
              {activeTab === 'uso' && <ReporteUso data={reservationData} />}
              {activeTab === 'heatmap' && <ReporteHeatmap data={reservationData} />}
              {activeTab === 'inventario' && <ReporteInventario logs={inventoryLogData} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}