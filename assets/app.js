import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, orderBy, limit, serverTimestamp, setDoc, doc, getDoc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
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

/* Admin allowlist */
const ADMIN_EMAIL = "sohibjonmath@gmail.com";
export function adminAllowed(){
  const u = auth.currentUser;
  return !!(u && u.email && String(u.email).toLowerCase() === ADMIN_EMAIL.toLowerCase());
}
export function toast(msg){
  const t=document.querySelector('.toast'); if(!t) return alert(msg);
  t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),1800);
}
export function activeNav(){ document.querySelectorAll('nav a').forEach(a=>{ if(a.href===location.href) a.classList.add('active'); }); }

/* Auth modal */
function ensureAuthModal(){
  if(document.getElementById('authModal')) return;
  const w=document.createElement('div'); w.className='modal'; w.id='authModal';
  w.innerHTML=`<div class="panel"><h3>Kirish</h3><p>Faqat Google orqali kirish mumkin.</p><button class="btn pri" id="gsi">Google bilan kirish</button></div>`;
  document.body.appendChild(w);
  w.querySelector('#gsi').addEventListener('click', async ()=>{ try{ await signInWithPopup(auth, provider); }catch(e){ alert(e.message);} });
}
function showAuth(){ ensureAuthModal(); document.getElementById('authModal').classList.add('open'); }
function hideAuth(){ const m=document.getElementById('authModal'); if(m) m.classList.remove('open'); }

/* Profile storage (Firestore: profiles/<uid>) + local cache */
function pKey(uid){ return `profile:${uid}`; }
export async function saveProfileToFirestore(profile){
  const u = auth.currentUser; if(!u) throw new Error('AUTH_REQUIRED');
  await setDoc(doc(db,'profiles',u.uid), profile, { merge:true });
  localStorage.setItem(pKey(u.uid), JSON.stringify(profile));
}
export async function loadProfileFromFirestore(){
  const u = auth.currentUser; if(!u) return null;
  const snap = await getDoc(doc(db,'profiles',u.uid));
  if(snap.exists()){
    const data = snap.data();
    localStorage.setItem(pKey(u.uid), JSON.stringify(data));
    return data;
  }
  return null;
}
export function getProfile(){
  const u=auth.currentUser; if(!u) return null;
  const raw = localStorage.getItem(pKey(u.uid)); try{ return raw?JSON.parse(raw):null; }catch{return null;}
}

/* General Firestore helpers with admin guard */
export async function createDoc(colName, data){
  if(!auth.currentUser){ showAuth(); throw new Error('AUTH_REQUIRED'); }
  if(!adminAllowed()) throw new Error('ADMIN_ONLY');
  const ref = await addDoc(collection(db, colName), {...data, uid: auth.currentUser.uid, createdAt: serverTimestamp()});
  return ref.id;
}
export async function updateDocById(colName, id, data){
  if(!adminAllowed()) throw new Error('ADMIN_ONLY');
  await updateDoc(doc(db,colName,id), data);
}
export async function deleteDocById(colName, id){
  if(!adminAllowed()) throw new Error('ADMIN_ONLY');
  await deleteDoc(doc(db,colName,id));
}
export async function listLatest(colName, n=24){
  return await getDocs(query(collection(db,colName), orderBy('createdAt','desc'), limit(n)));
}

/* Auth lifecycle */
export async function signOutGoogle(){ await signOut(auth); toast('Chiqildi'); }
onAuthStateChanged(auth, async (user)=>{
  if(!user){ showAuth(); return; }
  hideAuth();
  // Pull profile from Firestore if exists; otherwise app page will prompt to fill
  await loadProfileFromFirestore();
});

export { doc, setDoc, getDoc, updateDoc, deleteDoc, collection, getDocs, query, orderBy, limit, serverTimestamp };
