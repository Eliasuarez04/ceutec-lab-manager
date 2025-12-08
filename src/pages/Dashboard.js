// src/pages/Dashboard.js
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { collection, query, where, getDocs, Timestamp, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { format } from 'date-fns';
import './styles/Dashboard.css';

// Registrar los elementos necesarios para el gráfico
ChartJS.register(ArcElement, Tooltip, Legend);

// ===================================================================================
// Componente: Vista del Dashboard para DOCENTES
// ===================================================================================
const TeacherDashboard = () => (
  <div className="dashboard-grid">
    <Link to="/laboratorios" className="dashboard-card-link">
      <div className="card-content">
        <div className="card-icon">🔬</div>
        <h2 className="card-title">Laboratorios</h2>
        <p className="card-description">Consulta los laboratorios y su equipamiento disponible.</p>
      </div>
    </Link>
    <Link to="/reservas" className="dashboard-card-link">
      <div className="card-content">
        <div className="card-icon">🗓️</div>
        <h2 className="card-title">Reservar Espacios</h2>
        <p className="card-description">Consulta la disponibilidad y reserva un laboratorio.</p>
      </div>
    </Link>
  </div>
);

// ===================================================================================
// Componente: Vista del Dashboard para ADMINISTRADORES (Nuevo Diseño Profesional)
// ===================================================================================
const AdminDashboard = () => {
  const [stats, setStats] = useState({ labs: 0, reservationsToday: 0 });
  const [nextReservations, setNextReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const labsSnap = await getDocs(collection(db, 'laboratories'));
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        const todayReservationsQuery = query(
          collection(db, 'reservations'),
          where('startTime', '>=', Timestamp.fromDate(startOfDay)),
          where('startTime', '<=', Timestamp.fromDate(endOfDay))
        );
        const todayReservationsSnap = await getDocs(todayReservationsQuery);

        const nextReservationsQuery = query(
          collection(db, 'reservations'),
          where('startTime', '>=', Timestamp.now()),
          orderBy('startTime', 'asc'),
          limit(5)
        );
        const nextReservationsSnap = await getDocs(nextReservationsQuery);

        setStats({ labs: labsSnap.size, reservationsToday: todayReservationsSnap.size });
        setNextReservations(nextReservationsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        console.error("Error fetching admin dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const doughnutData = {
    labels: ['Reservados Hoy', 'Libres'],
    datasets: [{
      data: [stats.reservationsToday, stats.labs > 0 ? stats.labs - stats.reservationsToday : 0],
      backgroundColor: ['#c8102e', '#f4f7fa'],
      borderColor: ['#c8102e', '#e0e0e0'],
      borderWidth: 1,
      cutout: '70%',
    }],
  };

  if (loading) {
    return <h1>Cargando panel de administrador...</h1>;
  }

  return (
    <div className="admin-dashboard-layout">
      {/* --- COLUMNA IZQUIERDA: Tarjetas de Navegación --- */}
      <aside className="sidebar-area">
        <h2 className="sidebar-title">Acciones Rápidas</h2>
        <nav className="quick-nav">
          <Link to="/reservas" className="nav-link-item">
            <span className="nav-icon">🗓️</span>
            <div className="nav-text">
              <h3>Gestionar Reservas</h3>
              <p>Ver calendarios y administrar reservas</p>
            </div>
          </Link>
          <Link to="/admin/inventario" className="nav-link-item">
            <span className="nav-icon">⚙️</span>
            <div className="nav-text">
              <h3>Gestionar Inventario</h3>
              <p>Administrar laboratorios y equipos</p>
            </div>
          </Link>
          <Link to="/reportes" className="nav-link-item">
            <span className="nav-icon">📊</span>
            <div className="nav-text">
              <h3>Ver Reportes</h3>
              <p>Estadísticas de uso e historiales</p>
            </div>
          </Link>
        </nav>
      </aside>

      {/* --- COLUMNA DERECHA: Datos y Estadísticas --- */}
      <div className="main-content-area">
        <div className="stats-grid">
          <div className="stat-card">
            <h4>Total de Laboratorios</h4>
            <span>{stats.labs}</span>
          </div>
          <div className="stat-card">
            <h4>Reservas para Hoy</h4>
            <span>{stats.reservationsToday}</span>
          </div>
          <div className="stat-card">
            <h4>En Mantenimiento</h4>
            <span>0</span>
          </div>
        </div>

        <div className="content-grid">
          <div className="dashboard-card chart-card">
            <h4>Ocupación Hoy</h4>
            <div className="chart-container">
              <Doughnut data={doughnutData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }} />
            </div>
          </div>

          <div className="dashboard-card list-card">
            <h4>Próximas Reservas</h4>
            <div className="table-wrapper">
              <table>
                <tbody>
                  {nextReservations.length > 0 ? nextReservations.map((res) => (
                    <tr key={res.id} onClick={() => navigate(`/reservas?eventId=${res.id}`)}>
                      <td><strong>{format(res.startTime.toDate(), 'HH:mm')}</strong></td>
                      <td>{res.labName}</td>
                      <td>{res.purpose}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan="3">No hay próximas reservas para hoy.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


// ===================================================================================
// Componente Principal: Dashboard (Renderiza condicionalmente)
// ===================================================================================
export default function Dashboard() {
  const { userData } = useAuth();
  const isAdmin = userData?.role === 'admin';

  return (
    <div className="dashboard-wrapper">
      <h1 className="dashboard-title">
        {isAdmin ? 'Panel de Control' : 'Bienvenido al Portal'}
      </h1>
      
      {isAdmin ? <AdminDashboard /> : <TeacherDashboard />}
    </div>
  );
}