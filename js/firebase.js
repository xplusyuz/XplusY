// firebase.js — Firebase init + auth helpers (ID+parol, email, Google, phone)
// Project config (provided by user)
export const firebaseConfig = {
  apiKey: "AIzaSyDYwHJou_9GqHZcf8XxtTByC51Z8un8rrM",
  authDomain: "xplusy-760fa.firebaseapp.com",
  projectId: "xplusy-760fa",
  storageBucket: "xplusy-760fa.appspot.com",
  messagingSenderId: "992512966017",
  appId: "1:992512966017:web:5e919dbc9b8d8abcb43c80",
  measurementId: "G-459PLJ7P7L"
};

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import {
  getAuth, onAuthStateChanged, GoogleAuthProvider,
  signInWithPopup, signOut, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, updatePassword, linkWithCredential,
  PhoneAuthProvider, signInWithPhoneNumber, RecaptchaVerifier, EmailAuthProvider,
  updateEmail
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, runTransaction, collection, query, where, getDocs, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

const googleProvider = new GoogleAuthProvider();

export function onAuth(cb){ return onAuthStateChanged(auth, cb) }
export async function logout(){ await signOut(auth) }

/** Create/ensure user doc with numericId/balance/gems */
export async function ensureUser(uid, profile){
  const userRef = doc(db, "users", uid);
  const snap = await getDoc(userRef);
  if (snap.exists()) return snap.data();

  const metaRef = doc(db, "meta", "counters");
  const userData = await runTransaction(db, async (tx) => {
    const metaSnap = await tx.get(metaRef);
    let last = 1000000;
    if (metaSnap.exists() && typeof metaSnap.data().lastNumericId === "number"){
      last = metaSnap.data().lastNumericId;
    }
    const next = last + 1;
    tx.set(metaRef, { lastNumericId: next, updatedAt: serverTimestamp() }, { merge: true });
    const data = {
      numericId: next,
      balance: 0, gems: 0,
      displayName: profile?.displayName || "",
      photoURL: profile?.photoURL || "",
      email: profile?.email || "",
      phoneNumber: profile?.phoneNumber || "",
      createdAt: serverTimestamp()
    };
    tx.set(userRef, data, { merge: true });
    return data;
  });
  return userData;
}

// -------- AUTH FLOWS --------

// 1) Email + Password
export async function emailRegister({email, password, displayName}){
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await ensureUser(cred.user.uid, { displayName, email });
  return cred.user;
}
export async function emailLogin({email, password}){
  const cred = await signInWithEmailAndPassword(auth, email, password);
  await ensureUser(cred.user.uid, cred.user);
  return cred.user;
}

// 2) ID + Password (maps numericId -> email then signs in with email/password)
export async function idLogin({numericId, password}){
  const q = query(collection(db, "users"), where("numericId", "==", Number(numericId)));
  const snap = await getDocs(q);
  if (snap.empty) throw new Error("Bunday ID topilmadi");
  const docData = snap.docs[0].data();
  if (!docData.email) throw new Error("Ushbu ID uchun email mavjud emas. Avval ro'yxatdan o'ting yoki admin bilan bog'laning.");
  return await emailLogin({email: docData.email, password});
}

// 3) Google auth, then ask user to set password (link email/pass if needed)
export async function googleLogin(){
  const result = await signInWithPopup(auth, googleProvider);
  await ensureUser(result.user.uid, result.user);
  return result.user;
}
export async function setPasswordForCurrentUser(newPassword){
  if (!auth.currentUser) throw new Error("Avval tizimga kiring");
  await updatePassword(auth.currentUser, newPassword);
  return true;
}
export async function linkEmailPasswordForCurrentUser(email, password){
  if (!auth.currentUser) throw new Error("Avval tizimga kiring");
  const cred = EmailAuthProvider.credential(email, password);
  await updateEmail(auth.currentUser, email);
  await linkWithCredential(auth.currentUser, cred);
  return true;
}

// 4) Phone auth (with reCAPTCHA) + optional password set
let _recaptcha;
export function setupRecaptcha(containerId){
  if (_recaptcha) return _recaptcha;
  _recaptcha = new RecaptchaVerifier(auth, containerId, { size: "invisible" });
  return _recaptcha;
}
export async function phoneLoginStart(phoneNumber, containerId){
  const verifier = setupRecaptcha(containerId);
  const confirmation = await signInWithPhoneNumber(auth, phoneNumber, verifier);
  return confirmation; // caller must call confirmation.confirm(code)
}
export async function phoneLoginConfirm(confirmation, code){
  const result = await confirmation.confirm(code);
  await ensureUser(result.user.uid, result.user);
  return result.user;
}
