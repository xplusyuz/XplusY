
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, orderBy, limit, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDYwHJou_9GqHZcf8XxtTByC51Z8un8rrM",
  authDomain: "xplusy-760fa.firebaseapp.com",
  projectId: "xplusy-760fa",
  storageBucket: "xplusy-760fa.firebasestorage.app",
  messagingSenderId: "992512966017",
  appId: "1:992512966017:web:5e919dbc9b8d8abcb43c80",
  measurementId: "G-459PLJ7P7L"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
const provider = new GoogleAuthProvider();

const ADMIN_EMAIL = "sohibjonmath@gmail.com";
export function adminAllowed(){ const u = auth.currentUser; return !!(u && u.email && String(u.email).toLowerCase() === ADMIN_EMAIL.toLowerCase()); }
export function isAdmin(){ return adminAllowed(); }

export function toast(msg){ const t=document.querySelector('.toast'); if(!t) return alert(msg); t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),1800); }
export function activeNav(){ document.querySelectorAll('nav a').forEach(a=>{ if(a.href===location.href) a.classList.add('active'); }); }

// Auth modal simple
let authReady=false;
function ensureAuthModal(){
  if(document.getElementById('authModal')) return;
  const w=document.createElement('div'); w.className='modal'; w.id='authModal';
  w.innerHTML='<div class="panel"><h3>Kirish</h3><p>Faqat Google orqali kirish mumkin.</p><button class="btn pri full" id="googleSignIn">Google bilan kirish</button></div>';
  document.body.appendChild(w);
  w.querySelector('#googleSignIn').addEventListener('click', async ()=>{ try{ await signInWithPopup(auth, provider); }catch(e){ alert(e.message); } });
}

// Profile modal basic wiring - the full implementation expected to be present in index.js (we expose showProfileModal globally)
function ensureProfileModal(){ if(document.getElementById('profileModal')) return; const w=document.createElement('div'); w.className='modal'; w.id='profileModal'; w.innerHTML='<div class="panel"><h3>Profil</h3><div class="body">Profilni to‘ldiring</div><div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px"><button class="btn pri" id="pfSave">Saqlash</button></div></div>'; document.body.appendChild(w); }
export function showProfileModal(){ ensureProfileModal(); const u = auth.currentUser; const m=document.getElementById('profileModal'); if(!m) return; m.classList.add('open'); }
export function hideProfileModal(){ const m=document.getElementById('profileModal'); if(m) m.classList.remove('open'); }

export function profileKey(uid){ return `profile:${uid}`; }
export function getProfile(){ const u=auth.currentUser; if(!u) return null; const raw=localStorage.getItem(profileKey(u.uid)); try{ return raw?JSON.parse(raw):null;}catch{return null;} }
export function setProfile(p){ const u=auth.currentUser; if(!u) return; localStorage.setItem(profileKey(u.uid), JSON.stringify(p)); }

export async function signOutGoogle(){ await signOut(auth); toast('Chiqildi'); }

onAuthStateChanged(auth, (user)=>{ authReady=true; if(!user){ ensureAuthModal(); document.getElementById('authModal').classList.add('open'); } else { const p=getProfile(); if(!p){ /* show profile modal - application logic may handle */ } } });
