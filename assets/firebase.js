// Firebase init (CDN ESM)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, onSnapshot, serverTimestamp, increment } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// TODO: Replace with your Firebase project config (safe to keep public keys in client)
export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// Helpers
export const ensureUserDoc = async (user) => {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if(!snap.exists()){
    await setDoc(ref, {
      uid: user.uid,
      displayName: user.displayName || (user.email ? user.email.split("@")[0] : "User"),
      balance: 0,
      points: 0,
      createdAt: serverTimestamp()
    });
  }
  return ref;
};

export {
  onAuthStateChanged, signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, updateProfile, doc, getDoc, setDoc, updateDoc, onSnapshot, serverTimestamp, increment
};
