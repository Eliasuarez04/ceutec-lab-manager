// src/components/PrivateRoute.js
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function PrivateRoute({ children }) {
  const { currentUser } = useAuth();

  // Si no hay un usuario logueado, lo mandamos al login
  if (!currentUser) {
    return <Navigate to="/login" />;
  }

  // Si el usuario está logueado PERO no ha verificado su email, lo mandamos a la página de verificación
  if (!currentUser.emailVerified) {
    return <Navigate to="/verificar-email" />;
  }

  // Si está logueado Y verificado, le damos acceso a la página solicitada
  return children;
}