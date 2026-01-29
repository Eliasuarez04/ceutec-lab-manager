// src/pages/Reportes.js
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, getDocs, query, where, Timestamp, orderBy } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
// --- SOLUCIÓN: Añadir 'parseISO' a la importación ---
import { format, getDay, getHours, startOfDay, endOfDay, parseISO } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
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
    const dayCounts = [0, 0, 0, 0, 0, 0, 0]; // Domingo - Sábado
    data.forEach(res => {
      const day = getDay(res.startTime.toDate());
      dayCounts[day]++;
    });
    return {
      labels: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
      datasets: [{ label: 'Nº de Reservas', data: dayCounts, backgroundColor: 'rgba(0, 123, 255, 0.7)' }],
    };
  }, [data]);

  const hourUsageData = useMemo(() => {
    const hourCounts = Array(24).fill(0);
    data.forEach(res => {
      const hour = getHours(res.startTime.toDate());
      hourCounts[hour]++;
    });
    return {
      labels: hourCounts.map((_, i) => `${i}:00`),
      datasets: [{ label: 'Nº de Reservas', data: hourCounts, backgroundColor: 'rgba(25, 135, 84, 0.7)' }],
    };
  }, [data]);

  return (
    <div className="report-grid">
      <div className="chart-wrapper">
        <h3>Reservas por Laboratorio</h3>
        <Bar data={labUsageData} options={{ indexAxis: 'y', responsive: true }} />
      </div>
      <div className="chart-wrapper">
        <h3>Reservas por Día de la Semana</h3>
        <Bar data={dayUsageData} options={{ responsive: true }} />
      </div>
      <div className="chart-wrapper full-width">
        <h3>Reservas por Hora del Día</h3>
        <Bar data={hourUsageData} options={{ responsive: true }} />
      </div>
    </div>
  );
};


// --- Componente para Historial de Inventario ---
const ReporteInventario = ({ startDate, endDate }) => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);
    
    useEffect(() => {
        const fetchLogs = async () => {
            setLoading(true);
            try {
                let logQuery = query(collection(db, 'inventory_logs'), orderBy('timestamp', 'desc'));
                if (startDate && endDate) {
                    logQuery = query(logQuery, 
                        where('timestamp', '>=', Timestamp.fromDate(startOfDay(parseISO(startDate)))),
                        where('timestamp', '<=', Timestamp.fromDate(endOfDay(parseISO(endDate))))
                    );
                }
                const querySnapshot = await getDocs(logQuery);
                setLogs(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            } catch (error) {
                console.error("Error fetching inventory logs:", error);
                toast.error("Error al cargar el historial. Puede que necesites crear un índice en Firebase.");
            } finally {
                setLoading(false);
            }
        };
        fetchLogs();
    }, [startDate, endDate]);

    if (loading) return <p style={{ padding: '2rem', textAlign: 'center' }}>Cargando historial...</p>;

    return (
        <div className="report-section">
            <div className="history-table-container">
                <table className="history-table">
                    <thead>
                        <tr>
                            <th>Fecha</th><th>Laboratorio</th><th>Equipo</th>
                            <th>Cambio</th><th>Cantidad</th><th>Usuario</th><th>Notas</th>
                        </tr>
                    </thead>
                    <tbody>
                        {logs.length > 0 ? logs.map(log => (
                            <tr key={log.id}>
                                <td>{log.timestamp ? format(log.timestamp.toDate(), 'dd/MM/yyyy HH:mm') : 'N/A'}</td>
                                <td>{log.labName}</td>
                                <td>{log.itemName}</td>
                                <td><span className={`change-badge ${log.changeType.toLowerCase().replace(/\s+/g, '-')}`}>{log.changeType}</span></td>
                                <td>{log.quantityChange > 0 ? `+${log.quantityChange}` : log.quantityChange} (Total: {log.newQuantity})</td>
                                <td>{log.userEmail}</td>
                                <td>{log.notes || '-'}</td>
                            </tr>
                        )) : (
                            <tr><td colSpan="7" style={{ textAlign: 'center', padding: '2rem' }}>No hay registros para el período seleccionado.</td></tr>
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
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!startDate || !endDate) return;
    setLoading(true);
    try {
        const q = query(
            collection(db, 'reservations'),
            where('startTime', '>=', Timestamp.fromDate(startOfDay(parseISO(startDate)))),
            where('startTime', '<=', Timestamp.fromDate(endOfDay(parseISO(endDate))))
        );
        const querySnapshot = await getDocs(q);
        setData(querySnapshot.docs.map(doc => doc.data()));
    } catch (error) {
        console.error("Error fetching report data:", error);
        toast.error("Error al cargar los datos del reporte.");
    } finally {
        setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  const handleExportPDF = () => {
    if (activeTab === 'inventario') {
      // Lógica para exportar la tabla de historial (aún por implementar)
      toast('La exportación de historial de inventario aún no está implementada.', { icon: 'ℹ️' });
    } else {
      // Lógica para exportar los datos de uso
      if (data.length === 0) {
        return toast.error("No hay datos para exportar.");
      }
      const doc = new jsPDF();
      doc.setFontSize(18);
      doc.text(`Reporte de Uso de Laboratorios`, 14, 22);
      doc.setFontSize(11);
      doc.text(`Período: ${startDate} al ${endDate}`, 14, 30);

      const tableRows = [];
      const tableColumns = ["Laboratorio", "Motivo", "Tipo", "Fecha", "Horario"];
      data.forEach(res => {
        tableRows.push([
          res.labName,
          res.purpose,
          res.type || 'Práctica',
          format(res.startTime.toDate(), 'dd/MM/yyyy'),
          `${format(res.startTime.toDate(), 'HH:mm')} - ${format(res.endTime.toDate(), 'HH:mm')}`
        ]);
      });

      autoTable(doc, { head: [tableColumns], body: tableRows, startY: 40 });
      doc.save(`reporte_uso_laboratorios_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      toast.success('Reporte de uso generado en PDF.');
    }
  };

  return (
    <div className="page-container">
      <h1>Módulo de Reportería</h1>
      <div className="report-controls">
        <div className="tabs">
          <button className={activeTab === 'uso' ? 'active' : ''} onClick={() => setActiveTab('uso')}>Uso de Laboratorios</button>
          <button className={activeTab === 'inventario' ? 'active' : ''} onClick={() => setActiveTab('inventario')}>Historial de Inventario</button>
        </div>
        <div className="filters">
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          <button className="export-btn" onClick={handleExportPDF}>Exportar PDF</button>
        </div>
      </div>
      <div className="tab-content">
        {loading ? <p style={{ padding: '2rem', textAlign: 'center' }}>Generando reportes...</p> : (
            activeTab === 'uso' 
            ? <ReporteUso data={data} /> 
            : <ReporteInventario startDate={startDate} endDate={endDate} />
        )}
      </div>
    </div>
  );
}