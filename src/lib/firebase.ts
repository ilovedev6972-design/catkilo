import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyBwA4NPqW0ZwIP9JU5AiF_WLMVfbEJ-TUQ",
  authDomain: "squareai-20bdf.firebaseapp.com",
  databaseURL: "https://squareai-20bdf-default-rtdb.firebaseio.com",
  projectId: "squareai-20bdf",
  storageBucket: "squareai-20bdf.firebasestorage.app",
  messagingSenderId: "180197745803",
  appId: "1:180197745803:web:a1c84610d1a4bb777da08e",
  measurementId: "G-ZB4TP72S1J",
};

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const rtdb = getDatabase(app);
