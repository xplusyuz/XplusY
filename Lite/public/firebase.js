import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup,
  onAuthStateChanged, signOut, setPersistence, browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, collection, addDoc, serverTimestamp,
  query, where, getDocs, onSnapshot, orderBy, limit, runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  getStorage, ref as sRef, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

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
const db = getFirestore(app);
const storage = getStorage(app);
const provider = new GoogleAuthProvider();
await setPersistence(auth, browserLocalPersistence);

async function ensureUserDoc(user) {
  if (!user) return null;
  const uref = doc(db, 'users', user.uid);
  const snap = await getDoc(uref);
  if (!snap.exists()) {
    await setDoc(uref, {
      displayName: user.displayName || "",
      email: user.email || "",
      photoURL: user.photoURL || "",
      role: user.email === "sohibjonmath@gmail.com" ? "admin" : "user",
      createdAt: serverTimestamp()
    }, { merge: true });
  }
  return (await getDoc(uref)).data();
}

async function signIn() {
  const res = await signInWithPopup(auth, provider);
  const profile = await ensureUserDoc(res.user);
  return { user: res.user, profile };
}
async function logOut(){ await signOut(auth); }

async function uploadAttachment(file, path) {
  const r = sRef(storage, path);
  await uploadBytes(r, file);
  return await getDownloadURL(r);
}

function requireAuth(callback){
  onAuthStateChanged(auth, async (user)=>{
    if (!user) { await signIn(); }
    callback(auth.currentUser);
  });
}

window.fb = {
  app, auth, db, storage, provider,
  signIn, logOut, onAuthStateChanged, requireAuth,
  getDoc, doc, setDoc, collection, addDoc, serverTimestamp,
  query, where, getDocs, onSnapshot, orderBy, limit, runTransaction,
  uploadAttachment
};
