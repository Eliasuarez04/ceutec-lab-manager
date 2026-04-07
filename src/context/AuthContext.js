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

  async function signup(email, password, displayName, th, selectedRole) {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    const isStaff = email.toLowerCase().endsWith('@unitec.edu.hn');

    // 🔴 VALIDACIÓN AUTOMÁTICA CONTRA LA CARGA ACADÉMICA
    const teacherRef = doc(db, 'active_teachers_list', th.trim());
    const teacherSnap = await getDoc(teacherRef);
    const isTeacherInExcel = teacherSnap.exists();

    await sendEmailVerification(user);

    return setDoc(doc(db, 'users', user.uid), {
      uid: user.uid,
      email: user.email.toLowerCase(),
      displayName: displayName,
      th: th,
      role: isStaff ? selectedRole : 'docente',
      active: (isStaff || isTeacherInExcel), // Auto-activado si cumple
      createdAt: Timestamp.now(),
      city: "", 
      faculty: isTeacherInExcel ? "Validado por Malla" : "Pendiente"
    });
  }

  async function login(email, password) {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    
    if (!userDoc.exists()) { await signOut(auth); throw new Error("No existe perfil."); }

    const data = userDoc.data();
    if (data.active === false) { await signOut(auth); throw new Error("user_not_active"); }
    if (!user.emailVerified) { await sendEmailVerification(user); await signOut(auth); throw new Error("verify_email_first"); }

    return userCredential;
  }

  function resetPassword(email) { return sendPasswordResetEmail(auth, email); }
  function logout() { return signOut(auth); }

  useEffect(() => {
    let unsubscribeDoc = null;
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        // ESCUCHADOR EN TIEMPO REAL
        unsubscribeDoc = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
          if (docSnap.exists()) setUserData(docSnap.data());
          setLoading(false);
        });
      } else { setUserData(null); setLoading(false); }
    });
    return () => { unsubscribeAuth(); if (unsubscribeDoc) unsubscribeDoc(); };
  }, []);

  const value = { currentUser, userData, signup, login, logout, resetPassword };
  return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
}