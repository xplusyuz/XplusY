// /lib/firebase.client.js
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth, setPersistence, browserLocalPersistence, onAuthStateChanged,
  GoogleAuthProvider, signInWithPopup, signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { firebaseConfig } from "/config/firebase.config.js";

const app  = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
await setPersistence(auth, browserLocalPersistence); // sessiya butun sayt bo‘ylab

const db   = getFirestore(app);

export {
  app, auth, db,
  onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut
};
