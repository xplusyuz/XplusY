
// Firebase initialization (modular v9)
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, runTransaction,
  serverTimestamp, collection, query, orderBy, limit, onSnapshot,
  where, addDoc
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// TODO: Paste your own Firebase web config here (from Firebase Console)
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
  measurementId: "YOUR_MEASUREMENT_ID"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

const provider = new GoogleAuthProvider();

// --- Auth helpers ---
export async function signInGoogle() {
  await signInWithPopup(auth, provider);
}

export async function signOutNow() {
  await signOut(auth);
}

export function onAuth(cb) {
  return onAuthStateChanged(auth, cb);
}

// --- Users ---
export async function ensureUserDoc(user) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      uid: user.uid,
      email: user.email || null,
      displayName: user.displayName || null,
      photoURL: user.photoURL || null,
      numericId: null,
      balance: 0,
      gems: 0,
      role: "user",
      createdAt: serverTimestamp(),
      profile: {}
    });
  }
  // Assign numericId if missing using transaction with counters doc
  await runTransaction(db, async (tx) => {
    const uRef = doc(db, "users", user.uid);
    const uSnap = await tx.get(uRef);
    if (!uSnap.exists()) return;
    if (uSnap.data().numericId) return;

    const cRef = doc(db, "counters", "users");
    const cSnap = await tx.get(cRef);
    const next = (cSnap.exists() ? (cSnap.data().next || 100000) : 100000) + 1;
    tx.set(cRef, { next }, { merge: true });
    tx.update(uRef, { numericId: next });
  });
}

export async function getUserDoc(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

export async function updateUser(uid, data) {
  const ref = doc(db, "users", uid);
  await updateDoc(ref, data);
}

// --- Leaderboard ---
export function listenTopGems(limitN, cb) {
  const q = query(collection(db, "users"), orderBy("gems", "desc"), limit(limitN));
  return onSnapshot(q, (ss) => cb(ss.docs.map(d => d.data())));
}

// --- Events ---
export async function createEvent(e) {
  const ref = collection(db, "events");
  return await addDoc(ref, {
    title: e.title,
    startAt: e.startAt,
    durationMin: e.durationMin,
    price: e.price || 0,
    createdAt: serverTimestamp()
  });
}

export function listenEvents(cb) {
  const q = query(collection(db, "events"), orderBy("startAt", "asc"), limit(50));
  return onSnapshot(q, (ss) => cb(ss.docs.map(d => ({ id:d.id, ...d.data() }))));
}

export async function joinEvent(uid, evId, price) {
  // Deduct balance, mark join with transaction
  await runTransaction(db, async (tx) => {
    const uRef = doc(db, "users", uid);
    const eRef = doc(db, "events", evId);
    const jRef = doc(db, "eventJoins", `${uid}__${evId}`);

    const uSnap = await tx.get(uRef);
    if (!uSnap.exists()) throw new Error("User not found");
    const user = uSnap.data();
    if ((user.balance || 0) < price) throw new Error("Balans yetarli emas");

    // already joined?
    const jSnap = await tx.get(jRef);
    if (jSnap.exists()) return;

    tx.update(uRef, { balance: (user.balance || 0) - price });
    tx.set(jRef, { uid, evId, price, joinedAt: serverTimestamp() });
  });
}

// --- Admin ops ---
export async function adminAdjustByNumericId(numericId, deltaBalance, deltaGems) {
  // find user by numericId (simple query — acceptable for small scales/demo)
  // In production, create an index or store mapping doc {numericId: uid}
  const qUsers = query(collection(db, "users"), where("numericId", "==", Number(numericId)), limit(1));
  const ss = await (await import("https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js")).getDocs(qUsers);
  if (ss.empty) throw new Error("User not found");
  const docSnap = ss.docs[0]; const uid = docSnap.id;

  await runTransaction(db, async (tx) => {
    const uRef = doc(db, "users", uid);
    const uSnap = await tx.get(uRef);
    if (!uSnap.exists()) throw new Error("User not found");
    const u = uSnap.data();

    const nextBal = (u.balance || 0) + (Number(deltaBalance)||0);
    let nextGems = (u.gems || 0) + (Number(deltaGems)||0);
    if (Number(deltaGems)) {
      if (Math.abs(Number(deltaGems)) > 100) throw new Error("Gems ±100 limit");
    }
    tx.update(uRef, { balance: nextBal, gems: nextGems });
  });
}

export async function listUsersTop(n=20) {
  const q = query(collection(db, "users"), orderBy("gems","desc"), limit(n));
  const ss = await (await import("https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js")).getDocs(q);
  return ss.docs.map(d => d.data());
}
