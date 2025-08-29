
import { auth, db, googleProvider } from './firebase.js';
import {
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  onAuthStateChanged, signOut, signInWithPopup, updateProfile
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {
  doc, getDoc, setDoc, serverTimestamp, runTransaction, updateDoc, increment
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

export async function ensureUserDoc(user, extra={}){
  const uref = doc(db,'users',user.uid);
  const snap = await getDoc(uref);
  if (snap.exists()){
    if (Object.keys(extra).length) await setDoc(uref, extra, { merge:true });
    return { ...snap.data(), ...extra };
  }
  const counterRef = doc(db,'meta','counters');
  let data;
  await runTransaction(db, async tx=>{
    const cs = await tx.get(counterRef);
    const last = cs.exists()? (cs.data().lastUserId || 100000) : 100000;
    const next = last + 1;
    tx.set(counterRef, { lastUserId: next }, { merge:true });
    tx.set(uref, {
      id: next, balance:0, points:0,
      first_name: user.displayName || '',
      email: user.email || '',
      phone_number: extra.phone_number || '',
      photo_url: user.photoURL || '',
      created_at: serverTimestamp(),
      last_login: serverTimestamp()
    }, { merge:true });
    data = { id: next, balance:0, points:0, first_name:user.displayName||'', email:user.email||'', phone_number: extra.phone_number || '', photo_url:user.photoURL||'' };
  });
  return data;
}

export async function updateLastLogin(uid){
  await updateDoc(doc(db,'users',uid), { last_login: serverTimestamp() });
}

export function requireAuthForPage({ redirectIfLoggedOut='register.html' }={}){
  onAuthStateChanged(auth, async user=>{
    if (!user){ if (redirectIfLoggedOut) location.replace(redirectIfLoggedOut); return; }
    await ensureUserDoc(user);
    updateHeaderFor(user.uid);
  });
}

export async function updateHeaderFor(uid){
  const ref = doc(db,'users',uid);
  const s = await getDoc(ref);
  const d = s.exists()? s.data(): null;
  const metrics = document.getElementById('kmMetrics');
  const links = document.getElementById('kmAuthLinks');
  if (d){
    if (metrics) metrics.style.display='flex';
    if (links) links.style.display='none';
    const el = id=>document.getElementById(id);
    el('hmUserId')&&(el('hmUserId').textContent=d.id||'—');
    el('hmPoints')&&(el('hmPoints').textContent=d.points??0);
    el('hmBalance')&&(el('hmBalance').textContent=d.balance??0);
    if (el('hmAvatar') && d.photo_url) el('hmAvatar').src=d.photo_url;
  } else {
    if (metrics) metrics.style.display='none';
    if (links) links.style.display='block';
  }
}

export async function emailRegister({ name, email, password, phone }){
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if (name) await updateProfile(cred.user,{ displayName:name });
  await ensureUserDoc(cred.user, { phone_number: phone || '' });
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
export async function logout(){ await signOut(auth); location.replace('register.html'); }

export function watchHeaderAuth(){
  onAuthStateChanged(auth, async user=>{
    const links=document.getElementById('kmAuthLinks');
    const metrics=document.getElementById('kmMetrics');
    if (user){ await ensureUserDoc(user); updateHeaderFor(user.uid); metrics&&(metrics.style.display='flex'); links&&(links.style.display='none'); }
    else { metrics&&(metrics.style.display='none'); links&&(links.style.display='block'); }
  });
}
