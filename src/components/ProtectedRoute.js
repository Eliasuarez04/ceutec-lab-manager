// src/components/ProtectedRoute.js
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children, requiredRole }) => {
  const { userData, currentUser, loading } = useAuth();

  if (loading) return <div className="loading-screen">Cargando...</div>;

  // 1. Si no hay sesión iniciada, al Login
  if (!currentUser) {
    return <Navigate to="/login" />;
  }

  // 2. Si hay sesión pero Firestore aún no carga los datos
  if (!userData) return null;

  // 3. REGLA DE SEGURIDAD: Si el usuario NO está activo, 
  // lo mandamos a la página de verificación/espera.
  if (userData.active === false) {
    return <Navigate to="/verificar-email" />;
  }

  // 4. CONTROL DE ROLES
  // El SuperAdmin tiene acceso a TODO por defecto
  if (userData.role === 'superadmin') return children;

  // Si la ruta requiere un rol específico y el usuario no lo tiene
  if (requiredRole && userData.role !== requiredRole) {
    return <Navigate to="/" />;
  }

  return children;
};

// EXPORTACIÓN DEFAULT PARA CORREGIR EL ERROR ROJO
export default ProtectedRoute;