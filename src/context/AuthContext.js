// src/context/AuthContext.js
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
import { doc, getDoc, setDoc, Timestamp, onSnapshot } from 'firebase/firestore';

const AuthContext = createContext();
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  // --- REGISTRO AUTOMATIZADO Y BLINDADO V2.5.1 ---
  async function signup(email, password, displayName, th, selectedRole) {
    const emailLower = email.toLowerCase().trim();
    const isEdu = emailLower.endsWith('@unitec.edu');
    const isStaff = emailLower.endsWith('@unitec.edu.hn');

    // 1. VALIDACIÓN DE DOMINIO INSTITUCIONAL
    if (!isEdu && !isStaff) {
      throw new Error("Acceso denegado: Solo se permiten correos institucionales (@unitec.edu o @unitec.edu.hn)");
    }

    // 2. VALIDACIÓN DE IDENTIDAD PARA DOCENTES (.edu)
    if (isEdu) {
      const teacherRef = doc(db, 'active_teachers_list', th.trim());
      const teacherSnap = await getDoc(teacherRef);
      
      if (!teacherSnap.exists()) {
        throw new Error("Validación fallida: El No. Empleado (TH) no figura en la malla académica actual. Contacte a su coordinador.");
      }
    }

    // 3. CREACIÓN DE CUENTA
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    await sendEmailVerification(user);

    // 4. GUARDADO DE PERFIL CON ACTIVACIÓN AUTOMÁTICA
    return setDoc(doc(db, 'users', user.uid), {
      uid: user.uid,
      email: emailLower,
      displayName: displayName,
      th: th,
      role: isStaff ? selectedRole : 'docente',
      active: true, // Si pasó los filtros anteriores, entra activo
      createdAt: Timestamp.now(),
      city: "", 
      faculty: "Validado por Sistema"
    });
  }

  async function login(email, password) {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;
  const userDoc = await getDoc(doc(db, 'users', user.uid));
  
  if (!userDoc.exists()) { 
    await signOut(auth); 
    throw new Error("No existe un perfil asociado a esta cuenta."); 
  }

  const data = userDoc.data();
  if (data.active === false) { 
    await signOut(auth); 
    throw new Error("user_not_active"); 
  }

  // Eliminamos el throw de verificación de email aquí para manejarlo en el Frontend
  return userCredential;
}

  function resetPassword(email) { return sendPasswordResetEmail(auth, email); }
  function logout() { return signOut(auth); }

  useEffect(() => {
    let isMounted = true; 
    let unsubscribeDoc = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        unsubscribeDoc = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
          if (isMounted && docSnap.exists()) {
            setUserData(docSnap.data());
          }
          if (isMounted) setLoading(false);
        }, (error) => {
          console.error("Error en Snapshot:", error);
          if (isMounted) setLoading(false);
        });
      } else {
        setCurrentUser(null);
        setUserData(null);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false; 
      unsubscribeAuth();
      if (unsubscribeDoc) unsubscribeDoc();
    };
  }, []);

  const value = { currentUser, userData, signup, login, logout, resetPassword };
  return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
}