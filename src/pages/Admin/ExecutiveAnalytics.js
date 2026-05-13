import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { db } from '../../firebaseConfig';
import { collection, query, where, getDocs, Timestamp, limit } from 'firebase/firestore';
import { useSearchParams, Link } from 'react-router-dom';
import { Bar, Doughnut } from 'react-chartjs-2';
import { format, subMonths, startOfDay, endOfDay, parseISO } from 'date-fns';
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

  // 🔥 PARCHE 1: Selector dinámico de fechas (Por defecto: últimos 30 días)
  const [startDate, setStartDate] = useState(format(subMonths(new Date(), 1), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const fetchAnalyticsData = useCallback(async () => {
    if (!currentSede || !startDate || !endDate) return;
    setLoading(true);

    try {
      const start = Timestamp.fromDate(startOfDay(parseISO(startDate)));
      const end = Timestamp.fromDate(endOfDay(parseISO(endDate)));

      // 🔥 PARCHE 2: Rango controlado y límite de seguridad de 3000 lecturas
      const q = query(
        collection(db, 'reservations'),
        where('sede', '==', currentSede),
        where('startTime', '>=', start),
        where('startTime', '<=', end),
        limit(3000) 
      );

      const snap = await getDocs(q);
      setData(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.error("Error cargando analíticas:", error);
    } finally {
      setLoading(false);
    }
  }, [currentSede, startDate, endDate]);

  useEffect(() => {
    fetchAnalyticsData();
  }, [fetchAnalyticsData]);

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

  // 🔥 PARCHE 3: Cálculo real de puntualidad / completitud
  const punctualityRate = useMemo(() => {
      if (data.length === 0) return 0;
      const completed = data.filter(r => r.checkInTime || r.fulfillmentStatus?.includes('Completada')).length;
      return Math.round((completed / data.length) * 100);
  }, [data]);

  return (
    <div className="dashboard-wrapper">
      <div className="analytics-container fade-in">
        <header className="analytics-header">
           <div style={{ display: 'flex', flexDirection: 'column' }}>
               <Link to={`/dashboard?sede=${currentSede}`} className="back-link-tech">← PANEL PRINCIPAL</Link>
               <h1>INTELIGENCIA DE GESTIÓN: <span className="red-text">{currentSede}</span></h1>
           </div>
           
           {/* Selector de Fechas Ejecutivo */}
           <div style={{ display: 'flex', gap: '10px', alignItems: 'center', background: '#f8fafc', padding: '10px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
               <input 
                  type="date" 
                  value={startDate} 
                  onChange={e => setStartDate(e.target.value)} 
                  style={{ border: 'none', background: 'transparent', outline: 'none', fontWeight: 'bold', color: '#334155' }}
               />
               <span style={{ color: '#94a3b8' }}>hasta</span>
               <input 
                  type="date" 
                  value={endDate} 
                  onChange={e => setEndDate(e.target.value)} 
                  style={{ border: 'none', background: 'transparent', outline: 'none', fontWeight: 'bold', color: '#334155' }}
               />
           </div>
        </header>

        {loading ? (
            <div style={{ padding: '50px', textAlign: 'center', fontWeight: 'bold', color: '#64748b' }}>
                Analizando métricas corporativas...
            </div>
        ) : (
            <>
                {/* WIDGETS DE RESUMEN NUMÉRICO */}
                <div className="kpi-grid-summary">
                    <div className="kpi-card-mini">
                        <span>TOTAL OPERACIONES</span>
                        <h2>{data.length}</h2>
                    </div>
                    <div className="kpi-card-mini">
                        <span>EFECTIVIDAD DE USO</span>
                        <h2 style={{color: punctualityRate >= 85 ? '#22c55e' : '#f59e0b'}}>{punctualityRate}%</h2>
                    </div>
                    <div className="kpi-card-mini">
                        <span>ESPACIOS ACTIVOS</span>
                        <h2>{new Set(data.filter(r => r.labId).map(r => r.labId)).size}</h2>
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
            </>
        )}
      </div>
    </div>
  );
}