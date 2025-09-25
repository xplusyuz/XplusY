/* Firebase init + helpers (Auth + Firestore) */
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

// Admin gate: numeric ID must be 38864
const ADMIN_ID = 38864;
export function isAdmin() { return sessionStorage.getItem('adminOK') === '1'; }
export function requireAdmin() { if(!isAdmin()) throw new Error('ADMIN_ONLY'); }
export function openAdminGate() {
  const entered = prompt("Admin ID ni kiriting:");
  if(!entered) return false;
  const ok = String(entered).trim() === String(ADMIN_ID);
  sessionStorage.setItem('adminOK', ok ? '1':'0');
  return ok;
}

export function toast(msg) {
  const t = document.querySelector('.toast');
  if(!t) return alert(msg);
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 1800);
}

export function activeNav() {
  document.querySelectorAll('nav a').forEach(a=>{
    if(a.href===location.href) a.classList.add('active');
  });
}

/* ---------- Auth UI (Login Modal) ---------- */
let authReady = false;
function ensureAuthModal() {
  if(document.getElementById('authModal')) return;
  const wrap = document.createElement('div');
  wrap.className = 'modal'; wrap.id = 'authModal';
  wrap.innerHTML = `
    <div class="panel">
      <div class="head"><div class="brand">Kirish</div></div>
      <div class="body">
        <p>Faqat Google orqali kirish mumkin.</p>
        <button class="btn pri full" id="googleSignIn"><img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" style="width:18px;vertical-align:middle;margin-right:8px"> Google bilan kirish</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  document.getElementById('googleSignIn').addEventListener('click', async ()=>{
    try{ await signInWithPopup(auth, provider); }catch(e){ alert(e.message); }
  });
}

/* ---------- Profile UI (Mandatory Completion) ---------- */
function ensureProfileModal() {
  if(document.getElementById('profileModal')) return;
  const wrap = document.createElement('div');
  wrap.className = 'modal'; wrap.id = 'profileModal';
  wrap.innerHTML = `
    <div class="panel">
      <div class="head"><div class="brand">Profil ma'lumotlari</div></div>
      <div class="body">
        <div class="field"><label>Ism</label><input id="pfName"></div>
        <div class="field"><label>ID (raqam)</label><input id="pfId" type="number" min="1" step="1"></div>
        <div class="field"><label>Tug‘ilgan sana</label><input id="pfBirth" type="date"></div>
        <p class="small">Ism, ID va tug‘ilgan sana majburiy.</p>
      </div>
      <div class="foot">
        <button class="btn pri" id="pfSave">Saqlash</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  wrap.querySelector('#pfSave').addEventListener('click', ()=>{
    const u = auth.currentUser; if(!u) return;
    const name  = wrap.querySelector('#pfName').value.trim();
    const idNum = wrap.querySelector('#pfId').value.trim();
    const birth = wrap.querySelector('#pfBirth').value.trim();
    if(!name || !idNum || !birth){ alert('Ism, ID va tug‘ilgan sana shart.'); return; }
    const prof = { name, numericId: idNum, birth, balance: 0, points: 0 };
    localStorage.setItem(profileKey(u.uid), JSON.stringify(prof));
    hideProfileModal(); toast('Profil saqlandi');
    document.dispatchEvent(new CustomEvent('profile-updated'));
  });
}

function showAuthModal(){ ensureAuthModal(); document.getElementById('authModal').classList.add('open'); lockPage(true); }
function hideAuthModal(){ const m = document.getElementById('authModal'); if(m) m.classList.remove('open'); lockPage(false); }
function showProfileModal(){ ensureProfileModal(); document.getElementById('profileModal').classList.add('open'); lockPage(true); }
function hideProfileModal(){ const m = document.getElementById('profileModal'); if(m) m.classList.remove('open'); lockPage(false); }
function lockPage(v){
  const c = document.querySelector('.container');
  if(!c) return;
  if(v) c.classList.add('locked'); else c.classList.remove('locked');
}

function profileKey(uid){ return `profile:${uid}`; }
export function getProfile(){
  const u = auth.currentUser; if(!u) return null;
  const raw = localStorage.getItem(profileKey(u.uid));
  try{ return raw ? JSON.parse(raw) : null; }catch{ return null; }
}
export function setProfile(p){
  const u = auth.currentUser; if(!u) return;
  localStorage.setItem(profileKey(u.uid), JSON.stringify(p));
}
function isProfileComplete(p){ return p && p.name && p.numericId && p.birth; }

export async function signInGoogle(){ await signInWithPopup(auth, provider); }
export async function signOutGoogle(){
  const u = auth.currentUser;
  if(u){ localStorage.removeItem(profileKey(u.uid)); }
  await signOut(auth);
  toast('Chiqildi');
}

export function onReadyAuth(callback){
  if(authReady) return callback(auth.currentUser);
  const i = setInterval(()=>{ if(authReady){ clearInterval(i); callback(auth.currentUser); }}, 50);
}

// Init auth observer
onAuthStateChanged(auth, (user)=>{
  authReady = true;
  if(!user){
    showAuthModal();
  }else{
    hideAuthModal();
    const p = getProfile();
    if(!isProfileComplete(p)){
      showProfileModal();
    }else{
      hideProfileModal();
    }
  }
});

/* -------- Firestore small helpers ---------- */
export async function createDoc(colName, data) {
  if(!auth.currentUser){ showAuthModal(); throw new Error('AUTH_REQUIRED'); }
  const ref = await addDoc(collection(db, colName), { ...data, uid: auth.currentUser.uid, createdAt: serverTimestamp() });
  return ref.id;
}
export async function listLatest(colName, n=12){
  const snap = await getDocs(query(collection(db, colName), orderBy('createdAt','desc'), limit(n)));
  return snap;
}
