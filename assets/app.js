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
export function adminAllowed(){ const u=auth.currentUser; return !!(u && u.email && String(u.email).toLowerCase()===ADMIN_EMAIL.toLowerCase()); }

export function toast(msg){ const t=document.querySelector('.toast'); if(!t) return alert(msg); t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),1800); }
export function activeNav(){ document.querySelectorAll('nav a').forEach(a=>{ if(a.href===location.href) a.classList.add('active'); }); }

function setLocked(v, reason=''){
  const c=document.querySelector('.container'); if(!c) return;
  let cover=c.querySelector('.lock-cover'); if(!cover){ cover=document.createElement('div'); cover.className='lock-cover'; c.appendChild(cover); }
  cover.innerHTML = v ? `<div class="card" style="padding:20px;text-align:center"><h3>${reason||'Kirish kerak'}</h3><p>Google orqali kiring va profilni to‘ldiring.</p><button class="btn pri" id="coverLogin">Google bilan kirish</button></div>` : '';
  cover.classList.toggle('show', !!v);
  if(v){ cover.querySelector('#coverLogin')?.addEventListener('click', async ()=>{ try{ await signInWithPopup(auth, provider); }catch(e){ alert(e.message); } }); }
}

function ensureAuthModal(){
  if(document.getElementById('authModal')) return;
  const w=document.createElement('div'); w.className='modal'; w.id='authModal';
  w.innerHTML=`
  <div class="panel">
    <div class="auth-grid">
      <div class="auth-hero">
        <h2>MathCenter'ga xush kelibsiz!</h2>
        <p>Google orqali xavfsiz kirish. Profilni to‘ldiring va barcha imkoniyatlardan foydalaning.</p>
        <ul style="margin:10px 0 0 18px;color:#256a52">
          <li>Kurslar, testlar, simulyatorlar</li>
          <li>Promokod bilan bonus</li>
          <li>Shaxsiy ID va profil</li>
        </ul>
      </div>
      <div class="auth-body">
        <button class="btn pri" id="gsi">Google bilan kirish</button>
        <div class="note">Kirish orqali siz shaxsiy ma'lumotlarni qayta ishlashga rozilik bildirasiz.</div>
      </div>
    </div>
  </div>`;
  document.body.appendChild(w);
  w.querySelector('#gsi').addEventListener('click', async ()=>{ try{ await signInWithPopup(auth, provider); }catch(e){ alert(e.message);} });
}
function showAuth(){ ensureAuthModal(); document.getElementById('authModal').classList.add('open'); setLocked(true, 'Kirish talab qilinadi'); }
function hideAuth(){ const m=document.getElementById('authModal'); if(m) m.classList.remove('open'); setLocked(false); }

function pKey(uid){ return `profile:${uid}`; }
export function getProfile(){ const u=auth.currentUser; if(!u) return null; const raw=localStorage.getItem(pKey(u.uid)); try{return raw?JSON.parse(raw):null;}catch{return null;} }
export function isProfileComplete(p){ return p && p.first && p.last && p.birth && p.phone && p.role && p.numericId; }
export async function saveProfileToFirestore(profile){
  const u = auth.currentUser; if(!u) throw new Error('AUTH_REQUIRED');
  await setDoc(doc(db,'profiles',u.uid), profile, { merge:true });
  localStorage.setItem(pKey(u.uid), JSON.stringify(profile));
  document.dispatchEvent(new CustomEvent('profile-updated'));
}
export async function loadProfileFromFirestore(){
  const u = auth.currentUser; if(!u) return null;
  const snap = await getDoc(doc(db,'profiles',u.uid));
  if(snap.exists()){ const data=snap.data(); localStorage.setItem(pKey(u.uid), JSON.stringify(data)); return data; }
  return null;
}
export async function generateUniqueNumericId(){
  for(let i=0;i<20;i++){
    const id = String(Math.floor(10000000 + Math.random()*90000000));
    const q = query(collection(db,'profiles'), where('numericId','==',id), limit(1));
    const snap = await getDocs(q);
    if(snap.empty) return id;
  }
  throw new Error('ID_GENERATION_FAILED');
}

export async function createDoc(colName, data){
  if(!auth.currentUser){ showAuth(); throw new Error('AUTH_REQUIRED'); }
  if(!adminAllowed()) throw new Error('ADMIN_ONLY');
  const ref = await addDoc(collection(db, colName), {...data, uid: auth.currentUser.uid, createdAt: serverTimestamp()});
  return ref.id;
}
export async function updateDocById(colName, id, data){ if(!adminAllowed()) throw new Error('ADMIN_ONLY'); await updateDoc(doc(db,colName,id), data); }
export async function deleteDocById(colName, id){ if(!adminAllowed()) throw new Error('ADMIN_ONLY'); await deleteDoc(doc(db,colName,id)); }
export async function listLatest(colName, n=24){ return await getDocs(query(collection(db,colName), orderBy('createdAt','desc'), limit(n))); }

export async function redeemPromo(code){
  const u = auth.currentUser; if(!u) throw new Error('AUTH_REQUIRED');
  const codeStr = (code||'').trim().toUpperCase();
  if(!codeStr) throw new Error('PROMO_EMPTY');

  const prevQ = query(collection(db, 'promo_redemptions'), where('uid','==',u.uid), where('code','==',codeStr), limit(1));
  const prevSnap = await getDocs(prevQ);
  if(!prevSnap.empty) throw new Error('PROMO_ALREADY_USED');

  const q = query(collection(db,'promo_codes'), where('code','==',codeStr), limit(1));
  const snap = await getDocs(q);
  if(snap.empty) throw new Error('PROMO_NOT_FOUND');
  const pc = { id: snap.docs[0].id, ...snap.docs[0].data() };

  if(pc.disabled) throw new Error('PROMO_DISABLED');
  if(pc.expiresAt){
    const now = new Date(); const exp = new Date(pc.expiresAt);
    if(isFinite(exp.getTime()) && now > exp) throw new Error('PROMO_EXPIRED');
  }
  if(pc.maxUses && pc.usedCount && pc.usedCount >= pc.maxUses) throw new Error('PROMO_LIMIT');

  const prof = getProfile() || await loadProfileFromFirestore();
  const addBal = Number(pc.balance||0), addPts = Number(pc.points||0);
  const newProf = { ...prof, balance: Number(prof?.balance||0) + addBal, points: Number(prof?.points||0) + addPts, lastPromo: codeStr };
  await saveProfileToFirestore(newProf);
  await updateDoc(doc(db,'promo_codes', pc.id), { usedCount: Number(pc.usedCount||0) + 1 });
  await addDoc(collection(db, 'promo_redemptions'), { uid: u.uid, code: codeStr, redeemedAt: new Date().toISOString() });
  return { addBal, addPts };
}

export function updateGreeting(){
  const p = getProfile();
  const el = document.getElementById('greet');
  if(!el){ return; }
  if(!p){ el.innerHTML = '<span class="pill">Salom!</span>'; return; }
  const full = [p.first, p.patron, p.last].filter(Boolean).join(' ');
  el.innerHTML = `<span class="pill">Salom, ${full}</span>
    <span class="pill">ID: ${p.numericId||'-'}</span>
    <span class="pill">Balans: ${p.balance||0}</span>
    <span class="pill">Ball: ${p.points||0}</span>`;
}

export async function signOutGoogle(){ await signOut(auth); location.reload(); }

onAuthStateChanged(auth, async (user)=>{
  if(!user){ showAuth(); return; }
  hideAuth();
  const p = getProfile() || await loadProfileFromFirestore();
  if(!isProfileComplete(p)){ document.dispatchEvent(new CustomEvent('profile-incomplete')); setLocked(true, 'Profilni to‘ldiring'); }
  else { setLocked(false); }
  updateGreeting();
});

export { collection, getDocs, query, orderBy, limit, where, doc, getDoc, setDoc, updateDoc };
