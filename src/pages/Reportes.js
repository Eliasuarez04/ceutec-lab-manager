// src/pages/Reportes.js
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, getDocs, query, where, Timestamp, orderBy } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { format, getDay, getHours, startOfDay, endOfDay, parseISO } from 'date-fns';
import { CSVLink } from 'react-csv';
import toast from 'react-hot-toast';
import './styles/Reportes.css'; // Asegúrate que la ruta a tu CSS es correcta

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// --- Componente para Reportes de Uso (Gráficos) ---
const ReporteUso = ({ data }) => {
  const labUsageData = useMemo(() => {
    const counts = data.reduce((acc, res) => {
      acc[res.labName] = (acc[res.labName] || 0) + 1;
      return acc;
    }, {});
    const sortedLabs = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return {
      labels: sortedLabs.map(lab => lab[0]),
      datasets: [{ label: 'Nº de Reservas', data: sortedLabs.map(lab => lab[1]), backgroundColor: 'rgba(200, 16, 46, 0.7)' }],
    };
  }, [data]);

  const dayUsageData = useMemo(() => {
    const dayCounts = [0, 0, 0, 0, 0, 0, 0]; // D-L-M-M-J-V-S
    data.forEach(res => {
      const day = getDay(res.startTime.toDate());
      dayCounts[day]++;
    });
    return {
      labels: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
      datasets: [{ label: 'Nº de Reservas', data: dayCounts, backgroundColor: 'rgba(0, 123, 255, 0.7)' }],
    };
  }, [data]);

  const mostRequestedItemsData = useMemo(() => {
    const itemCounts = data.reduce((acc, res) => {
      if (res.requestedItems) {
        res.requestedItems.forEach(item => {
          acc[item.itemName] = (acc[item.itemName] || 0) + item.quantity;
        });
      }
      return acc;
    }, {});
    const sortedItems = Object.entries(itemCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
    return {
      labels: sortedItems.map(item => item[0]),
      datasets: [{ label: 'Cantidad Solicitada', data: sortedItems.map(item => item[1]), backgroundColor: 'rgba(255, 159, 64, 0.7)' }],
    };
  }, [data]);

  return (
    <div className="report-grid">
      <div className="chart-wrapper"><Bar data={labUsageData} options={{ indexAxis: 'y', responsive: true, plugins:{title:{display:true, text:'Reservas por Laboratorio'}}}} /></div>
      <div className="chart-wrapper"><Bar data={dayUsageData} options={{ responsive: true, plugins:{title:{display:true, text:'Reservas por Día de la Semana'}}}} /></div>
      <div className="chart-wrapper full-width"><Bar data={mostRequestedItemsData} options={{ responsive: true, plugins:{title:{display:true, text:'Top 10 Ítems Más Solicitados'}}}} /></div>
    </div>
  );
};

// --- Componente para el Mapa de Calor ---
const ReporteHeatmap = ({ data }) => {
  const heatmapData = useMemo(() => {
    const grid = Array(16).fill(0).map(() => Array(7).fill(0));
    let maxReservations = 0;
    data.forEach(res => {
      const day = getDay(res.startTime.toDate());
      const hour = getHours(res.startTime.toDate());
      const hourIndex = hour - 7;
      if (hourIndex >= 0 && hourIndex < 16) {
        grid[hourIndex][day]++;
        if (grid[hourIndex][day] > maxReservations) { maxReservations = grid[hourIndex][day]; }
      }
    });
    return { grid, maxReservations };
  }, [data]);

  const getCellColor = (count) => {
    if (count === 0) return { backgroundColor: '#f9f9f9' };
    const intensity = Math.min(count / (heatmapData.maxReservations || 1), 1);
    const red = 255;
    const green = 255 - Math.floor(intensity * 200);
    const blue = 90 - Math.floor(intensity * 90);
    return { backgroundColor: `rgb(${red}, ${green}, ${blue})`, color: intensity > 0.6 ? 'white' : 'black' };
  };

  return (
    <div className="report-section">
      <h3>Mapa de Calor de Ocupación Semanal</h3>
      <div className="heatmap-container">
        <table className="heatmap-table">
          <thead><tr><th>Hora</th><th>Dom</th><th>Lun</th><th>Mar</th><th>Mié</th><th>Jue</th><th>Vie</th><th>Sáb</th></tr></thead>
          <tbody>
            {heatmapData.grid.map((row, hourIndex) => (
              <tr key={hourIndex}>
                <td>{`${hourIndex + 7}:00`}</td>
                {row.map((count, dayIndex) => (
                  <td key={dayIndex} style={getCellColor(count)} title={`${count} reserva(s)`}>{count > 0 ? count : ''}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// --- Componente para Historial de Inventario ---
const ReporteInventario = ({ logs }) => {
    const [itemFilter, setItemFilter] = useState(null);

    const filteredLogs = useMemo(() => {
      if (!itemFilter) return logs;
      return logs.filter(log => log.itemName === itemFilter);
    }, [logs, itemFilter]);

    return (
      <div className="report-section">
        {itemFilter && (
          <div className="audit-header">
            <h4>Auditoría para: <strong>{itemFilter}</strong></h4>
            <button onClick={() => setItemFilter(null)}>Limpiar Filtro</button>
          </div>
        )}
        <div className="history-table-container">
          <table className="history-table">
            <thead><tr><th>Fecha</th><th>Laboratorio</th><th>Equipo</th><th>Cambio</th><th>Cantidad</th><th>Usuario</th><th>Notas</th></tr></thead>
            <tbody>
              {filteredLogs.length > 0 ? filteredLogs.map(log => (
                <tr key={log.id}>
                  <td>{log.timestamp ? format(log.timestamp.toDate(), 'dd/MM/yyyy HH:mm') : 'N/A'}</td>
                  <td>{log.labName}</td>
                  <td><span className="item-link" onClick={() => setItemFilter(log.itemName)}>{log.itemName}</span></td>
                  <td><span className={`change-badge ${log.changeType.toLowerCase().replace(/\s+/g, '-')}`}>{log.changeType}</span></td>
                  <td>{log.quantityChange > 0 ? `+${log.quantityChange}` : log.quantityChange} (Total: {log.newQuantity})</td>
                  <td>{log.userEmail}</td>
                  <td>{log.notes || '-'}</td>
                </tr>
              )) : (
                <tr><td colSpan="7" style={{ textAlign: 'center', padding: '2rem' }}>No hay registros para el período o filtro seleccionado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
};


// --- Página Principal de Reportes ---
export default function Reportes() {
  const [activeTab, setActiveTab] = useState('uso');
  const [startDate, setStartDate] = useState(format(new Date(new Date().setMonth(new Date().getMonth() - 1)), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [reservationData, setReservationData] = useState([]);
  const [inventoryLogData, setInventoryLogData] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!startDate || !endDate) return;
    setLoading(true);
    try {
      const start = Timestamp.fromDate(startOfDay(parseISO(startDate)));
      const end = Timestamp.fromDate(endOfDay(parseISO(endDate)));
      const resQuery = query(collection(db, 'reservations'), where('startTime', '>=', start), where('startTime', '<=', end));
      const logQuery = query(collection(db, 'inventory_logs'), where('timestamp', '>=', start), where('timestamp', '<=', end), orderBy('timestamp', 'desc'));
      const [resSnap, logSnap] = await Promise.all([getDocs(resQuery), getDocs(logQuery)]);
      setReservationData(resSnap.docs.map(doc => doc.data()));
      setInventoryLogData(logSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error("Error fetching report data:", error);
      toast.error("Error al cargar datos. Puede que necesites crear un índice en Firebase.");
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const csvHeaders = useMemo(() => ({
    uso: [
      { label: "Laboratorio", key: "labName" }, { label: "Motivo", key: "purpose" },
      { label: "Tipo", key: "type" }, { label: "Fecha", key: "formattedDate" }, { label: "Horario", key: "formattedTime" }
    ],
    inventario: [
      { label: "Fecha", key: "formattedTimestamp" }, { label: "Laboratorio", key: "labName" },
      { label: "Equipo", key: "itemName" }, { label: "Cambio", key: "changeType" },
      { label: "Variación", key: "quantityChange" }, { label: "Total", key: "newQuantity" },
      { label: "Usuario", key: "userEmail" }, { label: "Notas", key: "notes" }
    ]
  }), []);

  const csvData = useMemo(() => {
    if (activeTab === 'inventario') {
      return inventoryLogData.map(log => ({
        ...log, formattedTimestamp: log.timestamp ? format(log.timestamp.toDate(), 'dd/MM/yyyy HH:mm') : 'N/A'
      }));
    }
    return reservationData.map(res => ({
      ...res,
      formattedDate: format(res.startTime.toDate(), 'dd/MM/yyyy'),
      formattedTime: `${format(res.startTime.toDate(), 'HH:mm')} - ${format(res.endTime.toDate(), 'HH:mm')}`
    }));
  }, [activeTab, reservationData, inventoryLogData]);

  const getCurrentCsvHeaders = () => {
    if (activeTab === 'inventario') return csvHeaders.inventario;
    return csvHeaders.uso;
  };
  
  const [isCsvReady, setIsCsvReady] = useState(false);
  const handleCsvDownload = (event, done) => {
    toast.loading('Preparando tu archivo CSV...', { id: 'csv-toast' });
    setTimeout(() => {
      setIsCsvReady(true);
      toast.success('¡Descarga lista!', { id: 'csv-toast' });
      done(true);
    }, 1000);
  };
  useEffect(() => { if(isCsvReady) { setIsCsvReady(false); } }, [isCsvReady]);

  return (
    <div className="page-container">
      <h1>Módulo de Reportería</h1>
      <div className="report-controls">
        <div className="tabs">
          <button className={activeTab === 'uso' ? 'active' : ''} onClick={() => setActiveTab('uso')}>Análisis de Uso</button>
          <button className={activeTab === 'heatmap' ? 'active' : ''} onClick={() => setActiveTab('heatmap')}>Mapa de Calor</button>
          <button className={activeTab === 'inventario' ? 'active' : ''} onClick={() => setActiveTab('inventario')}>Historial de Inventario</button>
        </div>
        <div className="filters">
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          <span>a</span>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          <CSVLink
            data={csvData}
            headers={getCurrentCsvHeaders()}
            filename={`reporte_${activeTab}_${format(new Date(), 'yyyy-MM-dd')}.csv`}
            className="export-btn"
            target="_blank"
            asyncOnClick={true}
            onClick={handleCsvDownload}
            uFEFF={true}
          >
            {isCsvReady ? "Descargando..." : "Exportar a CSV"}
          </CSVLink>
        </div>
      </div>
      <div className="tab-content">
        {loading ? <p style={{padding: '2rem', textAlign: 'center'}}>Generando reportes...</p> : (
          <>
            {activeTab === 'uso' && <ReporteUso data={reservationData} />}
            {activeTab === 'heatmap' && <ReporteHeatmap data={reservationData} />}
            {activeTab === 'inventario' && <ReporteInventario logs={inventoryLogData} />}
          </>
        )}
      </div>
    </div>
  );
}