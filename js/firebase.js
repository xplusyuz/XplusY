// Firebase init + robust Auth
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, setPersistence, browserLocalPersistence,
  onAuthStateChanged, signInWithPopup, signInWithRedirect, getRedirectResult,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, addDoc, runTransaction, serverTimestamp,
  collection, getDocs, query, orderBy, limit, where, startAfter, Timestamp, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export const firebaseConfig = {
  apiKey: "AIzaSyDYwHJou_9GqHZcf8XxtTByC51Z8un8rrM",
  authDomain: "xplusy-760fa.firebaseapp.com",
  projectId: "xplusy-760fa",
  storageBucket: "xplusy-760fa.appspot.com",
  messagingSenderId: "992512966017",
  appId: "1:992512966017:web:5e919dbc9b8d8abcb43c80",
  measurementId: "G-459PLJ7P7L"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
await setPersistence(auth, browserLocalPersistence);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

export {
  onAuthStateChanged, signInWithPopup, signInWithRedirect, getRedirectResult,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut,
  doc, getDoc, setDoc, updateDoc, addDoc, deleteDoc, runTransaction, serverTimestamp,
  collection, getDocs, query, orderBy, limit, where, startAfter, Timestamp
};

// Helpers
export async function ensureNumericIdAndProfile(user){
  const userRef = doc(db, "users", user.uid);
  const countersRef = doc(db, "counters", "users");
  await runTransaction(db, async (tx) => {
    const uSnap = await tx.get(userRef);
    if (!uSnap.exists()) {
      const cSnap = await tx.get(countersRef);
      let nextId = 1000001;
      if (cSnap.exists()) nextId = (cSnap.data().lastAssigned || 1000000) + 1;
      tx.set(countersRef, { lastAssigned: nextId, updatedAt: serverTimestamp() }, { merge: true });
      tx.set(userRef, {
        uid: user.uid, email: user.email || "", displayName: user.displayName || "",
        numericId: nextId, balance: 0, gems: 0,
        profileComplete: false,
        firstName: "", lastName: "", middleName: "", birthDate: "", address: "", phone: "",
        isTeacher: false, isAdmin: false, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
      }, { merge: true });
    }
  });
  return (await getDoc(userRef)).data();
}

export async function updateProfileLocked(uid, data){
  const userRef = doc(db, "users", uid);
  await updateDoc(userRef, { ...data, updatedAt: serverTimestamp() });
}
