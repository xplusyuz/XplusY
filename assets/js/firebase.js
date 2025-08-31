// assets/js/firebase.js
// Firebase init & exports
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, query, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

// TODO: you can move this to a server-side config if needed.
export const firebaseConfig = {
  apiKey: "AIzaSyDYwHJou_9GqHZcf8XxtTByC51Z8un8rrM",
  authDomain: "xplusy-760fa.firebaseapp.com",
  projectId: "xplusy-760fa",
  storageBucket: "xplusy-760fa.firebasestorage.app",
  messagingSenderId: "992512966017",
  appId: "1:992512966017:web:5e919dbc9b8d8abcb43c80",
  measurementId: "G-459PLJ7P7L"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Convenience helpers
export async function fetchUser(userId) {
  const ref = doc(db, "users", userId);
  const snap = await getDoc(ref);
  return snap.exists() ? { id: userId, ...snap.data() } : null;
}

export async function fetchTopUsersByPoints(topN = 10) {
  const q = query(collection(db, "users"), orderBy("points", "desc"), limit(topN));
  const snap = await getDocs(q);
  return snap.docs.map((d, i) => ({ rank: i + 1, id: d.id, ...d.data() }));
}

export { onAuthStateChanged };