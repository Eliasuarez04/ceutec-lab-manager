// src/pages/Dashboard.js
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { collection, collectionGroup, query, where, getDocs, Timestamp, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

import './styles/Dashboard.css';

ChartJS.register(ArcElement, Tooltip, Legend);

// --- FUNCIÓN DE SALUDO COMPARTIDA ---
const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Buenos días';
  if (hour < 18) return 'Buenas tardes';
  return 'Buenas noches';
};

// --- VISTA PARA DOCENTES ---
const TeacherDashboard = ({ user }) => {
  const greeting = getGreeting();
  const firstName = user?.displayName ? user.displayName.split(' ')[0] : 'Docente';

  return (
    <div className="teacher-dashboard-container">
      <div className="dashboard-hero">
        <h1>{greeting}, {firstName}! 👋</h1>
        <p>Bienvenido al Centro de Gestión de Laboratorios. Todo está listo para tus clases de hoy.</p>
      </div>

      <div className="teacher-card-grid">
        <Link to="/reservas" className="teacher-card">
          <div>
            <div className="card-icon-wrapper bg-blue">📅</div>
            <h3>Nueva Reserva</h3>
            <p>Accede al calendario interactivo para programar tus prácticas de laboratorio.</p>
          </div>
          <span className="card-cta">Ir al Calendario &rarr;</span>
        </Link>

        <Link to="/mis-reservas" className="teacher-card">
          <div>
            <div className="card-icon-wrapper bg-green">📋</div>
            <h3>Mis Reservas</h3>
            <p>Revisa el estado de tus solicitudes, edita horarios o cancela reservas.</p>
          </div>
          <span className="card-cta">Ver Historial &rarr;</span>
        </Link>

        <Link to="/laboratorios" className="teacher-card">
          <div>
            <div className="card-icon-wrapper bg-purple">🔬</div>
            <h3>Laboratorios</h3>
            <p>Explora el catálogo de equipos, ubicaciones y detalles técnicos disponibles.</p>
          </div>
          <span className="card-cta">Explorar Labs &rarr;</span>
        </Link>

        <Link to="/perfil" className="teacher-card">
          <div>
            <div className="card-icon-wrapper bg-orange">👤</div>
            <h3>Mi Perfil</h3>
            <p>Gestiona tu información personal, departamento y visualiza tus estadísticas.</p>
          </div>
          <span className="card-cta">Configurar &rarr;</span>
        </Link>
      </div>
    </div>
  );
};

// --- Búsqueda Global (Admin) ---
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
      toast.error("Error al realizar la búsqueda.");
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="dashboard-card full-width-card">
      <h3>🔍 Búsqueda Global de Inventario</h3>
      <form onSubmit={handleSearch} className="global-search-form">
        <input type="text" placeholder="Buscar equipo (Ej: Microscopio, Proyector)..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        <button type="submit" disabled={isSearching}>{isSearching ? '...' : 'Buscar'}</button>
      </form>
      {hasSearched && (
        <div className="search-results">
          {isSearching ? <p style={{marginTop: '15px'}}>Buscando...</p> : (
            results.length > 0 ? (
              <div className="table-wrapper" style={{marginTop: '15px'}}>
                <table>
                  <thead><tr><th>Equipo</th><th>Laboratorio</th><th>Stock</th></tr></thead>
                  <tbody>
                    {results.map(item => (
                      <tr key={`${item.labName}-${item.id}`}>
                        <td>{item.name}</td>
                        <td>{item.labName}</td>
                        <td style={{fontWeight: 'bold', color: item.quantity > 0 ? '#2e7d32' : '#c8102e'}}>
                          {item.quantity}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="no-results" style={{marginTop: '15px', color: '#666'}}>No se encontraron resultados para "{searchTerm}".</p>
          )}
        </div>
      )}
    </div>
  );
};


// --- VISTA PARA ADMINISTRADORES ---
const AdminDashboard = ({ user }) => {
  const [stats, setStats] = useState({ labs: 0, reservationsToday: 0 });
  const [nextReservations, setNextReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Saludo Admin
  const greeting = getGreeting();
  const firstName = user?.displayName ? user.displayName.split(' ')[0] : 'Administrador';

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const labsSnap = await getDocs(collection(db, 'laboratories'));
        const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(); endOfDay.setHours(23, 59, 59, 999);
        const todayReservationsQuery = query(collection(db, 'reservations'), where('startTime', '>=', Timestamp.fromDate(startOfDay)), where('startTime', '<=', Timestamp.fromDate(endOfDay)));
        const todayReservationsSnap = await getDocs(todayReservationsQuery);
        const nextReservationsQuery = query(collection(db, 'reservations'), where('startTime', '>=', Timestamp.now()), orderBy('startTime', 'asc'), limit(5));
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
      backgroundColor: ['#c8102e', '#e0e0e0'],
      borderColor: ['#ffffff', '#ffffff'],
      borderWidth: 2,
      cutout: '75%',
    }],
  };
  
  if (loading) { return <div style={{padding: '50px', textAlign: 'center'}}><h2>Cargando panel...</h2></div>; }

  return (
    <div className="admin-container">
       {/* HERO SECTION PARA ADMIN TAMBIÉN */}
       <div className="dashboard-hero">
        <h1>{greeting}, {firstName}! 🛡️</h1>
        <p>Panel de Control: Supervisa reservas, inventario y solicitudes en tiempo real.</p>
      </div>

      <div className="admin-dashboard-layout">
        
        {/* BARRA LATERAL IZQUIERDA */}
        <aside className="sidebar-area">
          <div className="sidebar-card">
            <h3 className="sidebar-title">Acciones Rápidas</h3>
            <nav className="quick-nav">
              <Link to="/admin/solicitudes" className="nav-link-item">
                <div className="nav-icon">📋</div>
                <div className="nav-text"><h3>Solicitudes</h3><p>Entregas y devoluciones</p></div>
              </Link>
              <Link to="/reservas" className="nav-link-item">
                <div className="nav-icon">🗓️</div>
                <div className="nav-text"><h3>Reservas</h3><p>Calendario general</p></div>
              </Link>
              <Link to="/admin/inventario" className="nav-link-item">
                <div className="nav-icon">⚙️</div>
                <div className="nav-text"><h3>Inventario</h3><p>Gestión de labs y equipos</p></div>
              </Link>
              <Link to="/reportes" className="nav-link-item">
                <div className="nav-icon">📊</div>
                <div className="nav-text"><h3>Reportes</h3><p>Estadísticas y métricas</p></div>
              </Link>
            </nav>
          </div>
        </aside>

        {/* CONTENIDO PRINCIPAL DERECHA */}
        <div className="main-content-area">
          <GlobalInventorySearch />
          
          <div className="content-grid">
            {/* GRÁFICO */}
            <div className="dashboard-card chart-card">
              <h3>📊 Ocupación Diaria</h3>
              <div className="chart-container">
                <Doughnut 
                  data={doughnutData} 
                  options={{ 
                    responsive: true, 
                    maintainAspectRatio: false, 
                    plugins: { legend: { position: 'bottom' } } 
                  }} 
                />
              </div>
            </div>

            {/* LISTA PRÓXIMAS RESERVAS */}
            <div className="dashboard-card list-card">
              <h3>🕒 Próximas Reservas</h3>
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
                      <tr><td colSpan="3" className="no-results">No hay reservas próximas.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
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
      {isAdmin ? (
        <AdminDashboard user={userData} />
      ) : (
        <TeacherDashboard user={userData} />
      )}
    </div>
  );
}