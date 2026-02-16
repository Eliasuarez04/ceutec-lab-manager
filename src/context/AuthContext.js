import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../firebaseConfig';
import { 
  onAuthStateChanged, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  sendEmailVerification,
  sendPasswordResetEmail 
} from 'firebase/auth';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  // --- FUNCIÓN DE REGISTRO CON ROLES AUTOMÁTICOS ---
  async function signup(email, password, faculty) {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Lógica de dominios
    const isStaff = email.toLowerCase().endsWith('@unitec.edu.hn');

    // Siempre enviamos verificación de correo
    await sendEmailVerification(user);

    // Guardamos en Firestore
    return setDoc(doc(db, 'users', user.uid), {
      uid: user.uid,
      email: user.email.toLowerCase(),
      faculty: faculty,
      // @unitec.edu.hn -> coordinador / @unitec.edu -> docente
      role: isStaff ? 'coordinador' : 'docente',
      // @unitec.edu.hn entran activos / @unitec.edu requieren aprobación
      active: isStaff ? true : false, 
      sede: '', 
      typeAssigned: '', 
      createdAt: Timestamp.now()
    });
  }

  // --- FUNCIÓN DE INICIO DE SESIÓN ---
  async function login(email, password) {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    const userDoc = await getDoc(doc(db, 'users', user.uid));
    
    if (!userDoc.exists()) {
      await signOut(auth);
      throw new Error("No se encontró el perfil del usuario.");
    }

    const data = userDoc.data();

    // 1. Validar si está activo
    if (data.active === false) {
      await signOut(auth);
      throw new Error("user_not_active"); 
    }

    // 2. Validar si ya verificó el correo
    if (!user.emailVerified) {
      // Re-enviar si intenta entrar y no ha verificado
      await sendEmailVerification(user);
      await signOut(auth);
      throw new Error("verify_email_first");
    }

    return userCredential;
  }

  function resetPassword(email) {
    return sendPasswordResetEmail(auth, email);
  }

  function logout() {
    return signOut(auth);
  }

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
          console.error("Error al obtener datos:", error);
        }
      } else {
        setUserData(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = { currentUser, userData, signup, login, logout, resetPassword };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}