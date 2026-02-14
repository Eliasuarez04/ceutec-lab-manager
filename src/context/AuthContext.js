// src/context/AuthContext.js
import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../firebaseConfig';
import { 
  onAuthStateChanged, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  sendEmailVerification,
  sendPasswordResetEmail // <--- Importación añadida
} from 'firebase/auth';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  // --- FUNCIÓN DE REGISTRO ---
  async function signup(email, password, faculty) {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    const isStaff = email.toLowerCase().endsWith('@unitec.edu.hn');

    // Si es .edu.hn (Coordinador), se envía correo de inmediato
    if (isStaff) {
      await sendEmailVerification(user);
    }

    // Guardamos en Firestore con los campos solicitados
    return setDoc(doc(db, 'users', user.uid), {
      uid: user.uid,
      email: user.email.toLowerCase(),
      faculty: faculty,
      role: isStaff ? 'coordinador' : 'docente',
      active: isStaff ? true : false, // Docente inicia inactivo hasta aprobación
      sede: '', 
      typeAssigned: '', 
      createdAt: Timestamp.now()
    });
  }

  // --- FUNCIÓN DE INICIO DE SESIÓN CON VALIDACIONES ---
  async function login(email, password) {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    const userDoc = await getDoc(doc(db, 'users', user.uid));
    
    if (!userDoc.exists()) {
      await signOut(auth);
      throw new Error("No se encontró el perfil del usuario.");
    }

    const data = userDoc.data();

    // 1. Validar si está activo (Aprobado por coordinador)
    if (data.active === false) {
      await signOut(auth);
      throw new Error("user_not_active"); 
    }

    // 2. Validar si ya verificó el correo
    // (Si está activo pero no verificado, enviamos el correo en este momento)
    if (!user.emailVerified) {
      await sendEmailVerification(user);
      await signOut(auth);
      throw new Error("verify_email_first");
    }

    return userCredential;
  }

  // --- FUNCIÓN PARA RESTABLECER CONTRASEÑA ---
  function resetPassword(email) {
    return sendPasswordResetEmail(auth, email);
  }

  // --- FUNCIÓN DE CIERRE DE SESIÓN ---
  function logout() {
    return signOut(auth);
  }

  // --- ESCUCHADOR DE ESTADO DE AUTENTICACIÓN ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const docSnap = await getDoc(doc(db, 'users', user.uid));
          if (docSnap.exists()) {
            setUserData(docSnap.data());
          }
        } catch (error) {
          console.error("Error al obtener datos de Firestore:", error);
        }
      } else {
        setUserData(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Valores expuestos a la aplicación
  const value = { 
    currentUser, 
    userData, 
    signup, 
    login, 
    logout, 
    resetPassword 
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}