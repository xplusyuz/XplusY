import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp,
  collection,
  getDocs,
  query,
  limit,
  updateDoc
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

// TODO: SHUNI O'ZINGNING CONFIGING BILAN ALMASHTIR
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
const auth = getAuth(app);
auth.languageCode = "uz";

const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// Faqat shu email(lar)ga admin panelga kirish ruxsati beriladi
const ADMIN_EMAILS = [
  "sohibjonmath@gmail.com",
  // "yana_bir_admin@example.com"
];

// ================= HOME CONFIG (chip + banner + card) =================

async function loadHomeConfigOnce() {
  const ref = doc(db, "configs", "home");
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    return { chips: [] };
  }
  return snap.data();
}

async function saveHomeConfig(config) {
  const ref = doc(db, "configs", "home");
  const payload = {
    ...config,
    updatedAt: serverTimestamp()
  };
  await setDoc(ref, payload, { merge: false });
}

function subscribeHomeConfig(callback) {
  const ref = doc(db, "configs", "home");
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        callback({ chips: [] });
      } else {
        callback(snap.data());
      }
    },
    (err) => {
      console.error("home config listener error:", err);
    }
  );
}

// ================= USERS (role boshqaruvi) =================

// foydalanuvchi kirganda users/{uid} hujjatini yaratish / to'ldirish
async function ensureUserDoc(user) {
  if (!user) return;
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  const base = {
    displayName: user.displayName || "",
    email: user.email || "",
    photoURL: user.photoURL || "",
    role: "user",
    updatedAt: serverTimestamp()
  };

  if (!snap.exists()) {
    await setDoc(ref, {
      ...base,
      createdAt: serverTimestamp()
    });
  } else {
    const data = snap.data() || {};
    // agar rol yo'q bo'lsa yoki bo'sh bo'lsa — user
    if (!data.role) {
      await updateDoc(ref, { role: "user", updatedAt: serverTimestamp() });
    } else {
      // faqat ism/email o‘zgargan bo‘lsa yangilab qo‘yamiz
      await updateDoc(ref, {
        displayName: user.displayName || data.displayName || "",
        email: user.email || data.email || "",
        photoURL: user.photoURL || data.photoURL || "",
        updatedAt: serverTimestamp()
      });
    }
  }
}

// bitta user profilini real-time kuzatish (index.html uchun)
function subscribeUserProfile(uid, callback) {
  const ref = doc(db, "users", uid);
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        callback({ role: "user" });
      } else {
        callback(snap.data());
      }
    },
    (err) => {
      console.error("user profile listener error:", err);
      callback({ role: "user" });
    }
  );
}

// admin panel uchun — users kolleksiyasini o‘qish
async function listUsers(limitCount = 200) {
  const q = query(collection(db, "users"), limit(limitCount));
  const snap = await getDocs(q);
  const arr = [];
  snap.forEach((docSnap) => {
    arr.push({
      id: docSnap.id,
      ...docSnap.data()
    });
  });
  return arr;
}

// admin panel — user rolini o‘zgartirish
async function setUserRole(uid, role) {
  const ref = doc(db, "users", uid);
  const cleanRole = (role || "").trim() || "user";
  const snap = await getDoc(ref);
  if (snap.exists()) {
    await updateDoc(ref, {
      role: cleanRole,
      updatedAt: serverTimestamp()
    });
  } else {
    await setDoc(ref, {
      role: cleanRole,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }
}

export {
  app,
  auth,
  db,
  provider,
  ADMIN_EMAILS,
  signInWithPopup,
  onAuthStateChanged,
  signOut,
  loadHomeConfigOnce,
  saveHomeConfig,
  subscribeHomeConfig,
  // users
  ensureUserDoc,
  subscribeUserProfile,
  listUsers,
  setUserRole
};
