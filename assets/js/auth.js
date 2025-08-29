import { auth, db, googleProvider } from './firebase.js';
import {
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  onAuthStateChanged, signOut, signInWithPopup, updateProfile
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {
  doc, getDoc, setDoc, serverTimestamp, runTransaction, updateDoc,
  increment
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// Foydalanuvchi hujjati borligini ta’minlash + ketma-ket ID (100001...)
export async function ensureUserDoc(user, extra = {}) {
  const uref = doc(db, 'users', user.uid);
  const snap = await getDoc(uref);
  if (snap.exists()) {
    if (Object.keys(extra).length) await setDoc(uref, extra, { merge: true });
    return { ...snap.data(), ...extra };
  }
  const counterRef = doc(db, 'meta', 'counters');
  let data;
  await runTransaction(db, async (tx)=>{
    const counterSnap = await tx.get(counterRef);
    const lastId = counterSnap.exists() ? (counterSnap.data().lastUserId || 100000) : 100000;
    const next = lastId + 1;
    tx.set(counterRef, { lastUserId: next }, { merge: true });
    tx.set(uref, {
      id: next, balance: 0, points: 0,
      first_name: user.displayName || '',
      email: user.email || '',
      phone_number: extra.phone || '',
      created_at: serverTimestamp(),
      last_login: serverTimestamp(),
      photo_url: user.photoURL || '',
      ...extra
    }, { merge: true });
    data = { id: next, balance:0, points:0, email: user.email||'', first_name:user.displayName||'', phone_number:extra.phone||'' };
  });
  return data;
}

export async function updateLastLogin(uid){
  await updateDoc(doc(db,'users',uid), { last_login: serverTimestamp() });
}

// Sahifa guard: login bo‘lmasa redirect
export function requireAuthForPage({ redirectIfLoggedOut='/register.html' } = {}){
  onAuthStateChanged(auth, async (user)=>{
    if (!user) {
      if (redirectIfLoggedOut) window.location.replace(redirectIfLoggedOut);
      return;
    }
    await ensureUserDoc(user);
    updateHeaderFor(user.uid);
  });
}

// Header metriklarini yangilash
export async function updateHeaderFor(uid){
  const uref = doc(db,'users',uid);
  const snap = await getDoc(uref);
  const data = snap.exists() ? snap.data() : null;

  const metrics = document.getElementById('kmMetrics');
  const links = document.getElementById('kmAuthLinks');
  if (data) {
    if (metrics) metrics.style.display = 'flex';
    if (links) links.style.display = 'none';
    const elId = document.getElementById('hmUserId');
    const elPoints = document.getElementById('hmPoints');
    const elBal = document.getElementById('hmBalance');
    if (elId) elId.textContent = data.id || '—';
    if (elPoints) elPoints.textContent = data.points ?? 0;
    if (elBal) elBal.textContent = data.balance ?? 0;
    const av = document.getElementById('hmAvatar');
    if (av && data.photo_url) av.src = data.photo_url;

    const plus = document.getElementById('hmAddBalance');
    if (plus) plus.addEventListener('click', async ()=>{
      await updateDoc(uref, { balance: increment(100) });
      const s = await getDoc(uref);
      document.getElementById('hmBalance').textContent = s.data().balance;
      alert("+100 balans qo'shildi (demo).");
    }, { once: true });
  } else {
    if (metrics) metrics.style.display = 'none';
    if (links) links.style.display = 'block';
  }
}

// Ro‘yxatdan o‘tish / Kirish / Google
export async function emailRegister({ name, email, password }){
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if (name) await updateProfile(cred.user, { displayName: name });
  await ensureUserDoc(cred.user);
  return cred.user;
}
export async function emailLogin({ email, password }){
  const cred = await signInWithEmailAndPassword(auth, email, password);
  await ensureUserDoc(cred.user);
  await updateLastLogin(cred.user.uid);
  return cred.user;
}
export async function googleLogin(){
  const cred = await signInWithPopup(auth, googleProvider);
  await ensureUserDoc(cred.user);
  await updateLastLogin(cred.user.uid);
  return cred.user;
}
export async function logout(){ await signOut(auth); window.location.replace('/register.html'); }

// Header’da login statusni kuzatish (register sahifasida)
export function watchHeaderAuth(){
  onAuthStateChanged(auth, async (user)=>{
    const links = document.getElementById('kmAuthLinks');
    const metrics = document.getElementById('kmMetrics');
    if (user) {
      await ensureUserDoc(user);
      updateHeaderFor(user.uid);
      if (metrics) metrics.style.display='flex';
      if (links) links.style.display='none';
    } else {
      if (metrics) metrics.style.display='none';
      if (links) links.style.display='block';
    }
  });
}
export async function emailRegister({ name, email, password, phone }) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if (name) await updateProfile(cred.user, { displayName: name });
  await ensureUserDoc(cred.user, { phone: phone || '' });
  return cred.user;
}
