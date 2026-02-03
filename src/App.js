// src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';

// Páginas Existentes (¡Las que ya tenías!)
import AuthPage from './pages/AuthPage';
import VerificarEmail from './pages/VerificarEmail';
import Dashboard from './pages/Dashboard';
import Laboratories from './pages/Laboratories'; // Tu lista de laboratorios
import LabDetail from './pages/LabDetail';
import Reservations from './pages/Reservations'; // Tu calendario completo
import MisReservas from './pages/MisReservas';
import InventoryManager from './pages/Admin/InventoryManager';
import GestionSolicitudes from './pages/Admin/GestionSolicitudes';
import Reportes from './pages/Reportes';

// Página Nueva
import UserProfile from './pages/UserProfile';

// Componentes Layout/Auth
import Layout from './components/Layout';
import PrivateRoute from './components/PrivateRoute';
import ProtectedRoute from './components/ProtectedRoute';

function AppContent() {
  return (
    <Routes>
      {/* Auth */}
      <Route path="/login" element={<AuthPage />} />
      <Route path="/registro" element={<AuthPage />} />
      <Route path="/verificar-email" element={<VerificarEmail />} />
      
      {/* Rutas Principales */}
      <Route path="/" element={<PrivateRoute><Layout><Dashboard /></Layout></PrivateRoute>} />
      
      {/* Rutas Docentes y Generales */}
      <Route path="/laboratorios" element={<PrivateRoute><Layout><Laboratories /></Layout></PrivateRoute>} />
      <Route path="/laboratorios/:labId" element={<PrivateRoute><Layout><LabDetail /></Layout></PrivateRoute>} />
      
      {/* Reservas: Redirige al calendario completo */}
      <Route path="/reservas" element={<PrivateRoute><Layout><Reservations /></Layout></PrivateRoute>} />
      <Route path="/mis-reservas" element={<PrivateRoute><Layout><MisReservas /></Layout></PrivateRoute>} />
      
      {/* Perfil */}
      <Route path="/perfil" element={<PrivateRoute><Layout><UserProfile /></Layout></PrivateRoute>} />
      
      {/* Rutas Admin */}
      <Route path="/admin/inventario" element={<PrivateRoute><ProtectedRoute><Layout><InventoryManager /></Layout></ProtectedRoute></PrivateRoute>} />
      <Route path="/reportes" element={<PrivateRoute><ProtectedRoute><Layout><Reportes /></Layout></ProtectedRoute></PrivateRoute>} />
      <Route path="/admin/solicitudes" element={<PrivateRoute><ProtectedRoute><Layout><GestionSolicitudes /></Layout></ProtectedRoute></PrivateRoute>} />
      
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