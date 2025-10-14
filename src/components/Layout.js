// src/components/Layout.js
import React from 'react';
import Navbar from './Navbar';

export default function Layout({ children }) {
  return (
    <>
      <Navbar />
      <main style={{ paddingTop: '80px' }}> {/* Añade espacio para la navbar fija */}
        {children}
      </main>
    </>
  );
}