// src/pages/Dashboard.js
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { collection, collectionGroup, query, where, getDocs, Timestamp, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { format } from 'date-fns';
import './styles/Dashboard.css';
import toast from 'react-hot-toast';
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
     {/* --- NUEVA TARJETA "MIS RESERVAS" --- */}
    <Link to="/mis-reservas" className="dashboard-card-link">
      <div className="card-content">
        <div className="card-icon">🧾</div>
        <h2 className="card-title">Mis Reservas</h2>
        <p className="card-description">Consulta tu historial y gestiona tus próximas reservas.</p>
      </div>
    </Link>
  </div>
);


const GlobalInventorySearch = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchTerm.trim()) { setResults([]); return; }
    setIsSearching(true);
    setHasSearched(true);
    try {
      // --- SOLUCIÓN: Buscar en el campo 'name_uppercase' ---
      const searchQuery = searchTerm.trim().toUpperCase();
      const equipmentQuery = query(
        collectionGroup(db, 'equipment'),
        where('name_uppercase', '>=', searchQuery),
        where('name_uppercase', '<=', searchQuery + '\uf8ff')
      );
      const querySnapshot = await getDocs(equipmentQuery);
      const searchResults = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setResults(searchResults);
    } catch (error) {
      console.error("Error en búsqueda global:", error);
      toast.error("Error al realizar la búsqueda. Es posible que se necesite un nuevo índice en Firebase.");
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="dashboard-card full-width-card">
      <h3>Búsqueda Global de Inventario</h3>
      <form onSubmit={handleSearch} className="global-search-form">
        <input type="text" placeholder="Buscar equipo por nombre..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        <button type="submit" disabled={isSearching}>{isSearching ? '...' : 'Buscar'}</button>
      </form>
      {hasSearched && (
        <div className="search-results">
          {isSearching ? <p>Buscando...</p> : (
            results.length > 0 ? (
              <div className="table-wrapper">
                <table>
                  <thead><tr><th>Equipo</th><th>Laboratorio</th><th>Cantidad</th></tr></thead>
                  <tbody>
                    {results.map(item => (
                      <tr key={`${item.labName}-${item.id}`}>
                        <td>{item.name}</td>
                        <td>{item.labName}</td>
                        <td>{item.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="no-results">No se encontraron resultados para "{searchTerm}".</p>
          )}
        </div>
      )}
    </div>
  );
};


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
      {/* --- COLUMNA IZQUIERDA: ACCIONES RÁPIDAS --- */}
      <aside className="sidebar-area">
        <div className="dashboard-card">
          <h3 className="sidebar-title">Acciones Rápidas</h3>
          <nav className="quick-nav">
            <Link to="/admin/solicitudes" className="nav-link-item"><span className="nav-icon">📋</span><div className="nav-text"><h3>Gestionar Solicitudes</h3><p>Preparar y registrar entregas</p></div></Link>
            <Link to="/reservas" className="nav-link-item"><span className="nav-icon">🗓️</span><div className="nav-text"><h3>Gestionar Reservas</h3><p>Ver calendarios y administrar</p></div></Link>
            <Link to="/admin/inventario" className="nav-link-item"><span className="nav-icon">⚙️</span><div className="nav-text"><h3>Gestionar Inventario</h3><p>Administrar laboratorios y equipos</p></div></Link>
            <Link to="/reportes" className="nav-link-item"><span className="nav-icon">📊</span><div className="nav-text"><h3>Ver Reportes</h3><p>Estadísticas de uso e historiales</p></div></Link>
          </nav>
        </div>
      </aside>

      {/* --- COLUMNA DERECHA: CONTENIDO PRINCIPAL --- */}
      <div className="main-content-area">
        <GlobalInventorySearch />
        <div className="content-grid">
          <div className="dashboard-card chart-card">
            <h3>Ocupación Hoy</h3>
            <div className="chart-container"><Doughnut data={doughnutData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }} /></div>
          </div>
          <div className="dashboard-card list-card">
            <h3>Próximas Reservas</h3>
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
                    <tr><td colSpan="3" className="no-results">No hay próximas reservas.</td></tr>
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


// --- Componente Principal ---
export default function Dashboard() {
  const { userData } = useAuth();
  const isAdmin = userData?.role === 'admin';

  return (
    <div className="dashboard-wrapper">
      <h1 className="dashboard-title">{isAdmin ? 'Panel de Control' : 'Bienvenido al Portal'}</h1>
      {isAdmin ? <AdminDashboard /> : <TeacherDashboard />}
    </div>
  );
}