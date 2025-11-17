import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  setPersistence,
  browserLocalPersistence,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";
import {
  getStorage,
  ref as sRef,
  uploadString,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-storage.js";

// === Firebase config (sizniki) ===
const firebaseConfig = {
  apiKey: "AIzaSyDYwHJou_9GqHZcf8XxtTByC51Z8un8rrM",
  authDomain: "xplusy-760fa.firebaseapp.com",
  projectId: "xplusy-760fa",
  storageBucket: "xplusy-760fa.appspot.com",
  messagingSenderId: "992512966017",
  appId: "1:992512966017:web:5e919dbc9b8d8abcb43c80",
  measurementId: "G-459PLJ7P7L",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const st = getStorage(app);

try {
  await setPersistence(auth, browserLocalPersistence);
} catch (e) {
  console.warn("Persistence error", e);
}

// ====== Umumiy helperlar (butun sayt uchun) ======

// Sayt sozlamalari: configs/site
// structure (namuna):
// {
//   title: "LeaderMath.UZ",
//   subtitle: "Matematika platformasi",
//   logoUrl: "/logo.png",
//   faviconUrl: "/logo.png",
//   primaryColor: "#2E8B57",
//   chips: [ {id:"home", label:"Asosiy"}, {id:"tests", label:"Testlar"} ],
//   footerHtml: "<p>© 2025 LeaderMath.UZ</p>"
// }
export async function getSiteConfig() {
  const snap = await getDoc(doc(db, "configs", "site"));
  if (snap.exists()) return snap.data();
  // default
  return {
    title: "LeaderMath.UZ",
    subtitle: "Matematika platformasi",
    logoUrl: "/logo.png",
    faviconUrl: "/logo.png",
    primaryColor: "#2E8B57",
    chips: [{ id: "home", label: "Asosiy" }],
    footerHtml: "<p>© 2025 LeaderMath.UZ</p>",
  };
}

export async function saveSiteConfig(data) {
  const payload = {
    ...data,
    updatedAt: serverTimestamp(),
  };
  await setDoc(doc(db, "configs", "site"), payload, { merge: true });
}

// Home config: configs/home — eski loyihangizdagi kabi
export async function getHomeConfig() {
  const snap = await getDoc(doc(db, "configs", "home"));
  if (snap.exists()) {
    const data = snap.data();
    if (Array.isArray(data.sections)) return data;
  }
  return { sections: [] };
}
export async function saveHomeConfig(data) {
  await setDoc(
    doc(db, "configs", "home"),
    {
      ...data,
      updatedAt: serverTimestamp(),
    },
    { merge: false }
  );
}

// Profil va ballar uchun kichik helperlar (index va boshqa sahifalarda ishlatsangiz bo‘ladi)
export async function getProfile(uid) {
  const snap = await getDoc(doc(db, "profiles", uid));
  return snap.exists() ? snap.data() : null;
}

export async function saveProfile(uid, data, hasOldProfile) {
  const payload = {
    ...data,
    updatedAt: serverTimestamp(),
  };
  if (!hasOldProfile) payload.createdAt = serverTimestamp();
  await setDoc(doc(db, "profiles", uid), payload, { merge: false });
}

export async function getUserPoints(uid) {
  try {
    const snap = await getDoc(doc(db, "users", uid));
    return snap.exists() ? snap.data().points || 0 : 0;
  } catch {
    return 0;
  }
}

// Exportlar
export {
  app,
  auth,
  db,
  st,
  sRef,
  uploadString,
  getDownloadURL,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  serverTimestamp,
};
