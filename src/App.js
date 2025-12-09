// src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';

// Importa todas tus páginas
import AuthPage from './pages/AuthPage';
import VerificarEmail from './pages/VerificarEmail';
import Dashboard from './pages/Dashboard';
import Laboratories from './pages/Laboratories';
import LabDetail from './pages/LabDetail';
import Reservations from './pages/Reservations';
import InventoryManager from './pages/Admin/InventoryManager';
import Reportes from './pages/Reportes'; // La nueva página de reportes
import MisReservas from './pages/MisReservas';

// Importa los componentes de rutas
import Layout from './components/Layout';
import PrivateRoute from './components/PrivateRoute';
import ProtectedRoute from './components/ProtectedRoute'; // Guardián para rutas de Admin

function AppContent() {
  const { currentUser } = useAuth();
  
  return (
    <Routes>
      {/* --- RUTAS PÚBLICAS Y DE AUTENTICACIÓN --- */}
      <Route path="/login" element={currentUser ? <Navigate to="/" /> : <AuthPage />} />
      <Route path="/registro" element={currentUser ? <Navigate to="/" /> : <AuthPage />} />
      <Route path="/verificar-email" element={
        !currentUser ? <Navigate to="/login" /> : 
        (currentUser.emailVerified ? <Navigate to="/" /> : <VerificarEmail />)
      } />
      
      {/* --- RUTAS PRIVADAS PARA TODOS LOS USUARIOS VERIFICADOS --- */}
      <Route path="/" element={<PrivateRoute><Layout><Dashboard /></Layout></PrivateRoute>} />
      <Route path="/laboratorios" element={<PrivateRoute><Layout><Laboratories /></Layout></PrivateRoute>} />
      <Route path="/laboratorios/:labId" element={<PrivateRoute><Layout><LabDetail /></Layout></PrivateRoute>} />
      <Route path="/reservas" element={<PrivateRoute><Layout><Reservations /></Layout></PrivateRoute>} />
      <Route path="/mis-reservas" element={<PrivateRoute><Layout><MisReservas /></Layout></PrivateRoute>} />
      
      {/* --- RUTAS DE ADMINISTRADOR (Requieren rol 'admin') --- */}
      <Route
        path="/admin/inventario"
        element={
          <PrivateRoute>
            <ProtectedRoute>
              <Layout><InventoryManager /></Layout>
            </ProtectedRoute>
          </PrivateRoute>
        }
      />
      {/* --- NUEVA RUTA DE REPORTES PARA ADMINS --- */}
      <Route
        path="/reportes"
        element={
          <PrivateRoute>
            <ProtectedRoute>
              <Layout><Reportes /></Layout>
            </ProtectedRoute>
          </PrivateRoute>
        }
      />
      
      {/* Redirigir cualquier otra ruta no encontrada a la página principal */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <Toaster position="top-right" toastOptions={{ duration: 5000 }}/>
        <AppContent />
      </AuthProvider>
    </Router>
  );
}