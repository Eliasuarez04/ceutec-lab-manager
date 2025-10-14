// src/pages/Reportes.js
import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, Timestamp, orderBy } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Bar, Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, PointElement, LineElement } from 'chart.js';
import './styles/Reportes.css';
import { format } from 'date-fns';

// Registrar los componentes necesarios para Chart.js
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, PointElement, LineElement);

// --- Componente para el reporte de Uso de Laboratorios ---
const ReporteUso = () => {
  const [reservations, setReservations] = useState([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [chartData, setChartData] = useState(null);

  const handleFetch = async () => {
    if (!startDate || !endDate) {
      alert("Por favor selecciona un rango de fechas.");
      return;
    }
    const q = query(
      collection(db, 'reservations'),
      where('startTime', '>=', Timestamp.fromDate(new Date(startDate))),
      where('startTime', '<=', Timestamp.fromDate(new Date(endDate)))
    );
    const querySnapshot = await getDocs(q);
    const data = querySnapshot.docs.map(doc => doc.data());
    setReservations(data);
  };

  useEffect(() => {
    if (reservations.length > 0) {
      const labUsage = reservations.reduce((acc, res) => {
        acc[res.labName] = (acc[res.labName] || 0) + 1;
        return acc;
      }, {});
      
      setChartData({
        labels: Object.keys(labUsage),
        datasets: [{
          label: 'Número de Reservas',
          data: Object.values(labUsage),
          backgroundColor: 'rgba(200, 16, 46, 0.6)',
          borderColor: 'rgba(200, 16, 46, 1)',
          borderWidth: 1,
        }],
      });
    }
  }, [reservations]);
  
  return (
    <div className="report-section">
      <h2>Uso de Laboratorios por Período</h2>
      <div className="date-filter">
        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
        <button onClick={handleFetch}>Generar Reporte</button>
      </div>
      <div className="chart-container">
        {chartData ? <Bar data={chartData} options={{ responsive: true, plugins: { legend: { position: 'top' }, title: { display: true, text: 'Reservas por Laboratorio' } } }} /> : <p>Selecciona un rango de fechas para ver el reporte.</p>}
      </div>
    </div>
  );
};

// --- Componente para el Historial de Inventario ---
const ReporteInventario = () => {
    const [logs, setLogs] = useState([]);

    useEffect(() => {
        const fetchLogs = async () => {
            const q = query(collection(db, 'inventory_logs'), orderBy('timestamp', 'desc'));
            const querySnapshot = await getDocs(q);
            setLogs(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        };
        fetchLogs();
    }, []);

    return (
        <div className="report-section">
            <h2>Historial de Cambios en Inventario</h2>
            <div className="history-table-container">
                <table className="history-table">
                    <thead>
                        <tr>
                            <th>Fecha</th>
                            <th>Laboratorio</th>
                            <th>Equipo</th>
                            <th>Cambio</th>
                            <th>Cantidad</th>
                            <th>Usuario</th>
                        </tr>
                    </thead>
                    <tbody>
                        {logs.map(log => (
                            <tr key={log.id}>
                                <td>{format(log.timestamp.toDate(), 'dd/MM/yyyy HH:mm')}</td>
                                <td>{log.labName}</td>
                                <td>{log.itemName}</td>
                                <td><span className={`change-badge ${log.changeType.toLowerCase()}`}>{log.changeType}</span></td>
                                <td>{log.quantityChange > 0 ? `+${log.quantityChange}` : log.quantityChange} (Total: {log.newQuantity})</td>
                                <td>{log.userEmail}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};


// --- Página Principal de Reportes ---
export default function Reportes() {
  const [activeTab, setActiveTab] = useState('uso');

  return (
    <div className="page-container">
      <h1>Módulo de Reportería</h1>
      <div className="tabs">
        <button className={activeTab === 'uso' ? 'active' : ''} onClick={() => setActiveTab('uso')}>Uso de Laboratorios</button>
        <button className={activeTab === 'inventario' ? 'active' : ''} onClick={() => setActiveTab('inventario')}>Historial de Inventario</button>
      </div>
      <div className="tab-content">
        {activeTab === 'uso' && <ReporteUso />}
        {activeTab === 'inventario' && <ReporteInventario />}
      </div>
    </div>
  );
}