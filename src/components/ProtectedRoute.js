// src/components/ProtectedRoute.js
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children }) {
  const { userData } = useAuth();

  if (userData?.role !== 'admin') {
    // Si el usuario no es admin, lo redirige al dashboard
    return <Navigate to="/" />;
  }

  return children;
}