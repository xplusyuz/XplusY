import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, orderBy, limit, serverTimestamp, setDoc, doc, getDoc, updateDoc, deleteDoc, where } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
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

export function toast(msg){ const t=document.querySelector('.toast'); if(!t) return alert(msg); t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),1800); }
export function activeNav(){ document.querySelectorAll('nav a').forEach(a=>{ if(a.href===location.href) a.classList.add('active'); }); }

/* Lock cover helpers */
function setLocked(v, reason=''){
  const c = document.querySelector('.container');
  if(!c) return;
  let cover = c.querySelector('.lock-cover');
  if(!cover){ cover = document.createElement('div'); cover.className='lock-cover'; c.appendChild(cover); }
  cover.innerHTML = v ? `<div class="card" style="padding:16px;text-align:center"><h3>${reason||'Kirish kerak'}</h3><p>Google orqali kiring va profilni to‘ldiring.</p><button class="btn pri" id="coverLogin">Google bilan kirish</button></div>` : '';
  cover.classList.toggle('show', !!v);
  if(v){
    cover.querySelector('#coverLogin')?.addEventListener('click', async ()=>{
      try{ await signInWithPopup(auth, provider); }catch(e){ alert(e.message); }
    });
  }
}

/* Auth modal (fallback) */
function ensureAuthModal(){
  if(document.getElementById('authModal')) return;
  const w=document.createElement('div'); w.className='modal'; w.id='authModal';
  w.innerHTML=`<div class="panel"><h3>Kirish</h3><p>Faqat Google orqali kirish mumkin.</p><button class="btn pri" id="gsi">Google bilan kirish</button></div>`;
  document.body.appendChild(w);
  w.querySelector('#gsi').addEventListener('click', async ()=>{ try{ await signInWithPopup(auth, provider); }catch(e){ alert(e.message);} });
}
function showAuth(){ ensureAuthModal(); document.getElementById('authModal').classList.add('open'); setLocked(true, 'Kirish talab qilinadi'); }
function hideAuth(){ const m=document.getElementById('authModal'); if(m) m.classList.remove('open'); }

/* Profile storage (Firestore: profiles/<uid>) */
function pKey(uid){ return `profile:${uid}`; }
export async function saveProfileToFirestore(profile){
  const u = auth.currentUser; if(!u) throw new Error('AUTH_REQUIRED');
  await setDoc(doc(db,'profiles',u.uid), profile, { merge:true });
  localStorage.setItem(pKey(u.uid), JSON.stringify(profile));
  document.dispatchEvent(new CustomEvent('profile-updated'));
}
export async function loadProfileFromFirestore(){
  const u = auth.currentUser; if(!u) return null;
  const snap = await getDoc(doc(db,'profiles',u.uid));
  if(snap.exists()){ const data = snap.data(); localStorage.setItem(pKey(u.uid), JSON.stringify(data)); return data; }
  return null;
}
export function getProfile(){ const u=auth.currentUser; if(!u) return null; const raw=localStorage.getItem(pKey(u.uid)); try{return raw?JSON.parse(raw):null;}catch{return null;} }
export function isProfileComplete(p){ return p && p.first && p.last && p.birth && p.phone && p.role && p.numericId; }

/* Unique random numericId (8-digit) */
export async function generateUniqueNumericId(){
  // Try up to 20 attempts to avoid a rare collision
  for(let i=0;i<20;i++){
    const id = String(Math.floor(10000000 + Math.random()*90000000));
    const q = query(collection(db,'profiles'), where('numericId', '==', id), limit(1));
    const snap = await getDocs(q);
    if(snap.empty) return id;
  }
  throw new Error('ID_GENERATION_FAILED');
}

/* Admin CRUD helpers */
export async function createDoc(colName, data){
  if(!auth.currentUser){ showAuth(); throw new Error('AUTH_REQUIRED'); }
  if(!adminAllowed()) throw new Error('ADMIN_ONLY');
  const ref = await addDoc(collection(db, colName), {...data, uid: auth.currentUser.uid, createdAt: serverTimestamp()});
  return ref.id;
}
export async function updateDocById(colName, id, data){ if(!adminAllowed()) throw new Error('ADMIN_ONLY'); await updateDoc(doc(db,colName,id), data); }
export async function deleteDocById(colName, id){ if(!adminAllowed()) throw new Error('ADMIN_ONLY'); await deleteDoc(doc(db,colName,id)); }
export async function listLatest(colName, n=24){ return await getDocs(query(collection(db,colName), orderBy('createdAt','desc'), limit(n))); }

export async function signOutGoogle(){ await signOut(auth); toast('Chiqildi'); location.reload(); }

/* Require login + complete profile to unlock page */
onAuthStateChanged(auth, async (user)=>{
  if(!user){ showAuth(); setLocked(true, 'Kirish talab qilinadi'); return; }
  hideAuth();
  const p = getProfile() || await loadProfileFromFirestore();
  if(!isProfileComplete(p)){ setLocked(true, 'Profilni to‘ldiring'); document.dispatchEvent(new CustomEvent('profile-incomplete')); }
  else{ setLocked(false); }
});

export { collection, getDocs, query, orderBy, limit, where, doc, getDoc };
