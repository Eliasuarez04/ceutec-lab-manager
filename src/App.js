// src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import SpaceInventoryImporter from './pages/Admin/SpaceInventoryImporter';

// Importación de Páginas
import AuthPage from './pages/AuthPage';
import VerificarEmail from './pages/VerificarEmail';
import Dashboard from './pages/Dashboard';
import AcademicSpaces from './pages/AcademicSpaces'; 
import SpaceDetail from './pages/SpaceDetail';
import Reservations from './pages/Reservations'; 
import MisReservas from './pages/MisReservas';
import SpaceManager from './pages/Admin/SpaceManager';
import GestionSolicitudes from './pages/Admin/GestionSolicitudes';
import Reportes from './pages/Reportes';
import SpaceImporter from './pages/Admin/SpaceImporter';
import UserManagement from './pages/Admin/UserManagement'; 
import UserProfile from './pages/UserProfile';
import SedeSelector from './pages/SedeSelector';
import CampusLiveView from './pages/Admin/CampusLiveView'; // Arriba en los imports
import ExecutiveAnalytics from './pages/Admin/ExecutiveAnalytics';
import MaintenanceTickets from './pages/Admin/MaintenanceTickets';


// Importación de Componentes Globales y de Diseño
import Layout from './components/Layout';
import PrivateRoute from './components/PrivateRoute';
import ProtectedRoute from './components/ProtectedRoute';
import GlobalProfileAlert from './components/GlobalProfileAlert'; // <--- Importado correctamente

function AppContent() {
  return (
    <Routes>
      {/* --- RUTAS DE AUTENTICACIÓN --- */}
      <Route path="/login" element={<AuthPage />} />
      <Route path="/registro" element={<AuthPage />} />
      <Route path="/verificar-email" element={<VerificarEmail />} />
      
      {/* --- RUTAS PRIVADAS (ACCESO GENERAL) --- */}
      
      {/* 1. Selector de Sede (Puerta de entrada) */}
      <Route 
        path="/seleccionar-sede" 
        element={
          <PrivateRoute>
            <Layout>
              <SedeSelector />
            </Layout>
          </PrivateRoute>
        } 
      />
      
      {/* 2. Dashboard Principal (Recibe ?sede=...) */}
      <Route 
        path="/" 
        element={
          <PrivateRoute>
            <Layout>
              <Dashboard />
            </Layout>
          </PrivateRoute>
        } 
      />
      <Route 
        path="/dashboard" 
        element={
          <PrivateRoute>
            <Layout>
              <Dashboard />
            </Layout>
          </PrivateRoute>
        } 
      />
      
      {/* Gestión de Espacios (Aulas/Labs) */}
      <Route 
        path="/espacios" 
        element={
          <PrivateRoute>
            <Layout>
              <AcademicSpaces />
            </Layout>
          </PrivateRoute>
        } 
      /> 
      <Route 
        path="/espacios/:spaceId" 
        element={
          <PrivateRoute>
            <Layout>
              <SpaceDetail />
            </Layout>
          </PrivateRoute>
        } 
      />  
      
      {/* Reservas */}
      <Route 
        path="/reservas" 
        element={
          <PrivateRoute>
            <Layout>
              <Reservations />
            </Layout>
          </PrivateRoute>
        } 
      />
      <Route 
        path="/mis-reservas" 
        element={
          <PrivateRoute>
            <Layout>
              <MisReservas />
            </Layout>
          </PrivateRoute>
        } 
      />
      
      {/* Perfil de Usuario */}
      <Route 
        path="/perfil" 
        element={
          <PrivateRoute>
            <Layout>
              <UserProfile />
            </Layout>
          </PrivateRoute>
        } 
      />
      
      {/* --- RUTAS DE ADMINISTRACIÓN --- */}
      
      {/* Inventario e Infraestructura */}
      <Route 
        path="/admin/inventario" 
        element={
          <PrivateRoute>
            <ProtectedRoute>
              <Layout>
                <SpaceManager />
              </Layout>
            </ProtectedRoute>
          </PrivateRoute>
        } 
      />
      
      {/* Reportes y Estadísticas */}
      <Route 
        path="/reportes" 
        element={
          <PrivateRoute>
            <ProtectedRoute>
              <Layout>
                <Reportes />
              </Layout>
            </ProtectedRoute>
          </PrivateRoute>
        } 
      />
      
      {/* Aprobación de Solicitudes/Devoluciones */}
      <Route 
        path="/admin/solicitudes" 
        element={
          <PrivateRoute>
            <ProtectedRoute>
              <Layout>
                <GestionSolicitudes />
              </Layout>
            </ProtectedRoute>
          </PrivateRoute>
        } 
      />

      {/* Importador Excel (Solo SuperAdmin) */}
      <Route 
        path="/admin/importar-espacios" 
        element={
          <PrivateRoute>
            <ProtectedRoute requiredRole="superadmin">
              <Layout>
                <SpaceImporter />
              </Layout>
            </ProtectedRoute>
          </PrivateRoute>
        } 
      />

      {/* Gestión de Usuarios (Aprobación Docente) */}
      <Route 
        path="/admin/usuarios" 
        element={
          <PrivateRoute>
            <ProtectedRoute>
              <Layout>
                <UserManagement />
              </Layout>
            </ProtectedRoute>
          </PrivateRoute>
        } 
      />

      <Route 
  path="/admin/live-status" 
  element={
    <PrivateRoute>
      <ProtectedRoute>
        <Layout>
          <CampusLiveView />
        </Layout>
      </ProtectedRoute>
    </PrivateRoute>
  } 
/>

<Route 
  path="/admin/analitica" 
  element={
    <PrivateRoute>
      <ProtectedRoute>
        <Layout>
          <ExecutiveAnalytics />
        </Layout>
      </ProtectedRoute>
    </PrivateRoute>
  } 
/>

      <Route 
  path="/admin/importar-inventario" 
  element={
    <PrivateRoute>
      <ProtectedRoute> {/* Eliminamos el requiredRole="superadmin" para que coordinadores entren */}
        <Layout>
          <SpaceInventoryImporter />
        </Layout>
      </ProtectedRoute>
    </PrivateRoute>
  } 
/>

<Route 
  path="/admin/soporte-tecnico" 
  element={
    <PrivateRoute>
      <ProtectedRoute>
        <Layout>
          <MaintenanceTickets />
        </Layout>
      </ProtectedRoute>
    </PrivateRoute>
  } 
/>

      {/* Redirección por defecto */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        {/* Notificaciones Toast */}
        <Toaster position="top-right" />
        
        {/* ALERTA GLOBAL DE PERFIL - Consumimos el contexto dentro de un componente hijo o usamos una validación segura */}
        <AuthConsumer />

        {/* 🔥 CORRECCIÓN: Llamamos a AppContent en lugar de AppRoutes 🔥 */}
        <AppContent />
      </AuthProvider>
    </Router>
  );
}

// Creamos un componente pequeño para manejar la lógica de la alerta sin romper el App
function AuthConsumer() {
  // Solo requerimos useAuth y lo instanciamos directamente para no dejar variables sin usar
  const auth = require('./context/AuthContext').useAuth(); 
  
  // 1. No mostrar nada si no hay usuario
  // 2. No mostrar si el correo no está verificado
  // 3. No mostrar si el perfil ya está activo
  const shouldShowAlert = 
    auth.currentUser?.emailVerified && 
    auth.userData && 
    auth.userData.active === false;

  // Verificamos que no estemos en la ruta de verificación por seguridad extra
  const isVerificationPage = window.location.pathname === '/verificar-email';

  if (shouldShowAlert && !isVerificationPage) {
    return <GlobalProfileAlert />;
  }

  return null;
}