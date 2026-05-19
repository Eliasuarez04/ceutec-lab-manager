import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

// 🔥 Configuración directa de Producción (Sin variables de entorno)
const firebaseConfig = {
  apiKey: process.env.REACT_APP_API_KEY, // Reemplaza esto con tu API Key real que empieza con AIzaSy...
  authDomain: process.env.REACT_APP_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_PROJECT_ID,
  storageBucket: process.env.REACT_APP_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_MESSAGING_SENDER_ID, // Reemplaza con tu Sender ID real
  appId: process.env.REACT_APP_APP_ID // Reemplaza con tu App ID real
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { auth, db, storage };