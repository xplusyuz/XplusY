
// firebase.js - global Firebase setup
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import {
  getFirestore, collection, addDoc, getDocs, query, where, orderBy, limit
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
import {
  getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import {
  getStorage, ref as sRef, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyDYwHJou_9GqHZcf8XxtTByC51Z8un8rrM",
  authDomain: "xplusy-760fa.firebaseapp.com",
  projectId: "xplusy-760fa",
  storageBucket: "xplusy-760fa.firebasestorage.app",
  messagingSenderId: "992512966017",
  appId: "1:992512966017:web:5e919dbc9b8d8abcb43c80",
  measurementId: "G-459PLJ7P7L"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

// Export globally
window.__FB = { app, db, auth, storage, addDoc, collection, getDocs, query, where, orderBy, limit,
                signInWithEmailAndPassword, onAuthStateChanged, signOut, sRef, uploadBytes, getDownloadURL };
