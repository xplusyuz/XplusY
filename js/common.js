// common.js — Firebase v10 + Auth + numericId allocator
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import {
  getAuth, onAuthStateChanged, setPersistence, browserLocalPersistence,
  signInWithPopup, GoogleAuthProvider, signOut
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, onSnapshot, runTransaction,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDYwHJou_9GqHZcf8XxtTByC51Z8un8rrM",
  authDomain: "xplusy-760fa.firebaseapp.com",
  projectId: "xplusy-760fa",
  storageBucket: "xplusy-760fa.appspot.com",
  messagingSenderId: "992512966017",
  appId: "1:992512966017:web:5e919dbc9b8d8abcb43c80",
  measurementId: "G-459PLJ7P7L"
};

export const app  = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);
setPersistence(auth, browserLocalPersistence).catch(console.warn);

let _user=null, _userData=null, _userUnsub=null;
const $ = (s,r=document)=>r.querySelector(s);
const $all=(s,r=document)=>[...r.querySelectorAll(s)];
const fmt=(n)=> new Intl.NumberFormat('uz-UZ').format(+n||0);
const ev=(name,detail)=>document.dispatchEvent(new CustomEvent(name,{detail}));

function bindHeader(d){
  $("#hdrId").textContent = "ID: " + (d?.numericId ?? "—");
  $("#hdrBalance").textContent = "💵 " + fmt(d?.balance ?? 0);
  $("#hdrGems").textContent = "💎 " + fmt(d?.gems ?? 0);
}
function toggleAuthUI(signed){
  $all('[data-auth="in"]').forEach(el=> el.style.display = signed? "" : "none");
  $all('[data-auth="out"]').forEach(el=> el.style.display = signed? "none" : "");
}

// Numeric ID allocator: counters/users.last
async function allocateNumericId(){
  const counterRef = doc(db, "counters", "users");
  const next = await runTransaction(db, async(tx)=>{
    const snap = await tx.get(counterRef);
    let last = 1000000;
    if(!snap.exists()){
      const cand = last+1; tx.set(counterRef, { last: cand }); return cand;
    } else {
      last = Number(snap.data().last || 1000000);
      const cand = last+1; tx.update(counterRef, { last: cand }); return cand;
    }
  });
  return next;
}

async function ensureUserDoc(uid, profile={}){
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if(!snap.exists()){
    const newId = await allocateNumericId();
    const payload = {
      uid, email: profile.email||null, displayName: profile.displayName||null,
      createdAt: serverTimestamp(), numericId: newId,
      firstName:"", lastName:"", middleName:"", dob:"", region:"", district:"", phone:"",
      balance:0, gems:0, badges:[]
    };
    await setDoc(ref, payload);
    return (await getDoc(ref)).data();
  }else{
    const data = snap.data()||{};
    if(data.numericId == null){
      const fixed = await allocateNumericId();
      await updateDoc(ref, { numericId: fixed });
      data.numericId = fixed;
    }
    return data;
  }
}

function watchUserDoc(uid){
  if(_userUnsub){ _userUnsub(); _userUnsub=null; }
  if(!uid) return;
  const ref = doc(db, "users", uid);
  _userUnsub = onSnapshot(ref, (d)=>{ _userData=d.data()||null; bindHeader(_userData); ev('user:updated',{user:_user,data:_userData}); });
}

export function signInWithGoogle(){ return signInWithPopup(auth, new GoogleAuthProvider()).then(r=>r.user); }
export function signOutUser(){ return signOut(auth); }
export function getCurrentUser(){ return _user; }
export function getCurrentUserData(){ return _userData; }
export function isSignedIn(){ return !!_user; }
export function requireAuthOrModal(){ if(!isSignedIn()){ showAuthModal(); return false; } return true; }

export function attachAuthUI(root=document){
  $all('[data-action="google-signin"]', root).forEach(btn=>{
    if(btn.__bound) return; btn.__bound=true;
    btn.addEventListener('click', async e=>{ e.preventDefault(); btn.disabled=true;
      try{ await signInWithGoogle(); hideAuthModal(); } catch(e){ alert("Kirishda xato."); }
      btn.disabled=false;
    });
  });
  $all('[data-action="signout"]', root).forEach(btn=>{
    if(btn.__bound) return; btn.__bound=true;
    btn.addEventListener('click', async e=>{ e.preventDefault(); btn.disabled=true;
      try{ await signOutUser(); } finally{ btn.disabled=false; }
    });
  });
  $all('[data-close="auth"]', root).forEach(btn=>{
    if(btn.__bound) return; btn.__bound=true;
    btn.addEventListener('click', e=>{ e.preventDefault(); hideAuthModal(); });
  });
}

export function initUX(){
  onAuthStateChanged(auth, async (u)=>{
    _user = u||null;
    if(!_user){ _userData=null; bindHeader(null); toggleAuthUI(false); watchUserDoc(null); ev('user:updated',{user:null,data:null}); return; }
    try{
      toggleAuthUI(true);
      _userData = await ensureUserDoc(_user.uid, { email:_user.email||null, displayName:_user.displayName||null });
      bindHeader(_userData); watchUserDoc(_user.uid); hideAuthModal();
    }catch(err){ console.error("[common] ensureUserDoc", err); }
  });
  attachAuthUI(document);
}

// Auth modal (index-level only)
function ensureAuthModal(){
  if(document.getElementById('authModal')) return;
  const html = `
  <div id="authModal" role="dialog" aria-modal="true" aria-labelledby="authTitle">
    <div class="auth-card">
      <div class="auth-head"><div id="authTitle" class="auth-title">Kirish talab qilinadi</div></div>
      <div class="auth-body">
        <button class="btn btn-google" data-action="google-signin">Google bilan davom etish</button>
        <button class="btn" data-close="auth">Bekor qilish</button>
      </div>
    </div>
  </div>`;
  document.body.insertAdjacentHTML("beforeend", html);
  attachAuthUI(document.getElementById('authModal'));
}
function showAuthModal(){ ensureAuthModal(); document.getElementById('authModal').style.display="flex"; }
function hideAuthModal(){ const m=document.getElementById('authModal'); if(m) m.style.display="none"; }
