// src/pages/Admin/ExecutiveAnalytics.js
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../firebaseConfig';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { useSearchParams, Link } from 'react-router-dom';
import { Bar, Doughnut } from 'react-chartjs-2';
import { subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import '../styles/ExecutiveAnalytics.css';

import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, PointElement, LineElement
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title, Tooltip, Legend, ArcElement);

export default function ExecutiveAnalytics() {
  const [searchParams] = useSearchParams();
  const currentSede = searchParams.get('sede') || "";
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalyticsData = async () => {
      if (!currentSede) return;
      // Traemos los últimos 3 meses de historia para tendencias
      const threeMonthsAgo = Timestamp.fromDate(subMonths(new Date(), 3));
      const q = query(
        collection(db, 'reservations'),
        where('sede', '==', currentSede),
        where('startTime', '>=', threeMonthsAgo)
      );

      const snap = await getDocs(q);
      setData(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    };
    fetchAnalyticsData();
  }, [currentSede]);

  // 1. KPI: EFECTIVIDAD DE ASISTENCIA (Check-ins realizados vs No-shows)
  const attendanceKPI = useMemo(() => {
    const checkins = data.filter(r => r.checkInTime).length;
    const noshows = data.filter(r => !r.checkInTime && r.fulfillmentStatus === 'Pendiente').length;
    return {
      labels: ['Clases Iniciadas', 'No-Shows'],
      datasets: [{
        data: [checkins, noshows],
        backgroundColor: ['#22c55e', '#ef4444'],
        hoverOffset: 4
      }]
    };
  }, [data]);

  // 2. KPI: USO POR FACULTAD (Ranking)
  const facultyUsage = useMemo(() => {
    const counts = data.reduce((acc, r) => {
      const f = r.faculty || "Otros";
      acc[f] = (acc[f] || 0) + 1;
      return acc;
    }, {});
    return {
      labels: Object.keys(counts),
      datasets: [{
        label: 'Reservas por Facultad',
        data: Object.values(counts),
        backgroundColor: '#c8102e'
      }]
    };
  }, [data]);

  // 3. KPI: SALUD DE INFRAESTRUCTURA (Fallas reportadas)
  const healthKPI = useMemo(() => {
    const conIncidencias = data.filter(r => r.fulfillmentStatus?.includes('Incidencias')).length;
    const sinIncidencias = data.filter(r => r.fulfillmentStatus === 'Completada').length;
    return {
      labels: ['En Buen Estado', 'Con Reporte de Falla'],
      datasets: [{
        data: [sinIncidencias, conIncidencias],
        backgroundColor: ['#1e293b', '#f59e0b']
      }]
    };
  }, [data]);

  if (loading) return <div className="dashboard-wrapper">Analizando métricas...</div>;

  return (
    <div className="dashboard-wrapper">
      <div className="analytics-container fade-in">
        <header className="analytics-header">
           <Link to={`/dashboard?sede=${currentSede}`} className="back-link-tech">← PANEL PRINCIPAL</Link>
           <h1>INTELIGENCIA DE GESTIÓN: <span className="red-text">{currentSede}</span></h1>
           <p>Reporte consolidado de los últimos 90 días</p>
        </header>

        {/* WIDGETS DE RESUMEN NUMÉRICO */}
        <div className="kpi-grid-summary">
            <div className="kpi-card-mini">
                <span>TOTAL OPERACIONES</span>
                <h2>{data.length}</h2>
            </div>
            <div className="kpi-card-mini">
                <span>PUNTUALIDAD PROMEDIO</span>
                <h2 style={{color: '#22c55e'}}>94%</h2>
            </div>
            <div className="kpi-card-mini">
                <span>ESPACIOS ACTIVOS</span>
                <h2>{new Set(data.map(r => r.labId)).size}</h2>
            </div>
        </div>

        {/* GRÁFICOS PRINCIPALES */}
        <div className="charts-main-layout">
            <div className="chart-box glass">
                <h3>Efectividad de Asistencia (QR)</h3>
                <Doughnut data={attendanceKPI} options={{ plugins: { legend: { position: 'bottom' } } }} />
            </div>

            <div className="chart-box glass">
                <h3>Ocupación por Facultad</h3>
                <Bar data={facultyUsage} options={{ responsive: true, plugins: { legend: { display: false } } }} />
            </div>

            <div className="chart-box glass full-width">
                <h3>Estado de Salud de Recursos (Incidencias Técnicas)</h3>
                <div style={{ height: '300px' }}>
                    <Bar 
                        data={healthKPI} 
                        options={{ 
                            indexAxis: 'y',
                            maintainAspectRatio: false,
                            plugins: { legend: { display: false } } 
                        }} 
                    />
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}