// Modular Firebase config and exports
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js';
import { getAuth, signInAnonymously } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-storage.js';

// GANTI dengan konfigurasi Firebase Anda (sudah diberikan oleh user)
const firebaseConfig = {
  apiKey: "AIzaSyAhJUZYPJ-wbCxTKWtPucYRNPVh0icNh28",
  authDomain: "kingdigitalpremium-8cbb8.firebaseapp.com",
  databaseURL: "https://kingdigitalpremium-8cbb8-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "kingdigitalpremium-8cbb8",
  storageBucket: "kingdigitalpremium-8cbb8.appspot.com",
  messagingSenderId: "56471764214",
  appId: "1:56471764214:web:9a7687b3ff8734cb41c0d7"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Helper: ensure anonymous sign-in for customers when needed
export async function ensureAnonymous() {
  try {
    if (!auth.currentUser) {
      const res = await signInAnonymously(auth);
      return res.user;
    }
    return auth.currentUser;
  } catch (err) {
    console.error('Anonymous sign-in failed', err);
    throw err;
  }
}
