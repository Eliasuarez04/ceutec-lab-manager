// src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';

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
import SedeSelector from './pages/SedeSelector'; // <--- Importado

// Importación de Componentes de Ruta y Diseño
import Layout from './components/Layout';
import PrivateRoute from './components/PrivateRoute';
import ProtectedRoute from './components/ProtectedRoute';

function AppContent() {
  return (
    <Routes>
      {/* --- RUTAS DE AUTENTICACIÓN --- */}
      <Route path="/login" element={<AuthPage />} />
      <Route path="/registro" element={<AuthPage />} />
      <Route path="/verificar-email" element={<VerificarEmail />} />
      
      {/* --- RUTAS PRIVADAS (ACCESO GENERAL) --- */}
      {/* 1. Primero selecciona sede */}
      <Route path="/seleccionar-sede" element={<PrivateRoute><Layout><SedeSelector /></Layout></PrivateRoute>} />
      
      {/* 2. El Dashboard recibe la sede por URL (?sede=...) */}
      <Route path="/" element={<PrivateRoute><Layout><Dashboard /></Layout></PrivateRoute>} />
      <Route path="/dashboard" element={<PrivateRoute><Layout><Dashboard /></Layout></PrivateRoute>} />
      
      {/* Gestión de Espacios */}
      <Route path="/espacios" element={<PrivateRoute><Layout><AcademicSpaces /></Layout></PrivateRoute>} /> 
      <Route path="/espacios/:spaceId" element={<PrivateRoute><Layout><SpaceDetail /></Layout></PrivateRoute>} />  
      
      {/* Reservas */}
      <Route path="/reservas" element={<PrivateRoute><Layout><Reservations /></Layout></PrivateRoute>} />
      <Route path="/mis-reservas" element={<PrivateRoute><Layout><MisReservas /></Layout></PrivateRoute>} />
      
      {/* Perfil */}
      <Route path="/perfil" element={<PrivateRoute><Layout><UserProfile /></Layout></PrivateRoute>} />
      
      {/* --- RUTAS DE ADMINISTRACIÓN --- */}
      <Route 
        path="/admin/inventario" 
        element={<PrivateRoute><ProtectedRoute><Layout><SpaceManager /></Layout></ProtectedRoute></PrivateRoute>} 
      />
      
      <Route 
        path="/reportes" 
        element={<PrivateRoute><ProtectedRoute><Layout><Reportes /></Layout></ProtectedRoute></PrivateRoute>} 
      />
      
      <Route 
        path="/admin/solicitudes" 
        element={<PrivateRoute><ProtectedRoute><Layout><GestionSolicitudes /></Layout></ProtectedRoute></PrivateRoute>} 
      />

      <Route 
        path="/admin/importar-espacios" 
        element={<PrivateRoute><ProtectedRoute requiredRole="superadmin"><Layout><SpaceImporter /></Layout></ProtectedRoute></PrivateRoute>} 
      />

      <Route 
        path="/admin/usuarios" 
        element={<PrivateRoute><ProtectedRoute><Layout><UserManagement /></Layout></ProtectedRoute></PrivateRoute>} 
      />

      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <Toaster position="top-right" />
        <AppContent />
      </AuthProvider>
    </Router>
  );
}