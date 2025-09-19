// firebase.js — Firebase init + minimal auth + users doc with numericId/balance/gems
// Replace with your project's config:
export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, runTransaction } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

const provider = new GoogleAuthProvider();

export async function login() {
  await signInWithPopup(auth, provider);
}
export async function logout() {
  await signOut(auth);
}

/**
 * Ensure a user doc with numericId/balance/gems exists.
 * Auto-increments numericId from meta/counters.lastNumericId starting at 1000000.
 */
export async function ensureUser(uid, profile){
  const userRef = doc(db, "users", uid);
  const snap = await getDoc(userRef);
  if (snap.exists()) return snap.data();
  // transaction to mint numericId
  const metaRef = doc(db, "meta", "counters");
  const userData = await runTransaction(db, async (tx) => {
    const metaSnap = await tx.get(metaRef);
    let last = 1000000;
    if (metaSnap.exists() && typeof metaSnap.data().lastNumericId === "number"){
      last = metaSnap.data().lastNumericId;
    }
    const next = last + 1;
    tx.set(metaRef, { lastNumericId: next }, { merge: true });
    const data = {
      numericId: next,
      balance: 0,
      gems: 0,
      displayName: profile?.displayName || "",
      photoURL: profile?.photoURL || "",
      email: profile?.email || "",
      createdAt: (new Date()).toISOString()
    };
    tx.set(userRef, data, { merge: true });
    return data;
  });
  return userData;
}

export function onAuth(cb){
  return onAuthStateChanged(auth, cb);
}
