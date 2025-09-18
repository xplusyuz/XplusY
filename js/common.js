import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, updateDoc, runTransaction, collection, query, orderBy, limit, getDocs, where, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';
import { firebaseConfig } from '../index.html';

let app, auth, db, storage;
let currentUser = null;

function $(id){ return document.getElementById(id); }
function show(el){ el?.style && (el.style.display=''); }
function hide(el){ el?.style && (el.style.display='none'); }

export async function initApp(){
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);

  window.appAPI = { signIn, signOut: ()=>signOut(auth) };

  const btnSignIn = $('btnSignIn');
  const btnSignOut = $('btnSignOut');
  const btnGoogle = $('btnGoogle');
  const authModal = $('authModal');
  const btnCloseAuth = $('btnCloseAuth');
  const sidePanel = $('sidePanel');

  btnSignIn?.addEventListener('click', ()=> authModal?.showModal());
  btnGoogle?.addEventListener('click', ()=> signIn());
  btnCloseAuth?.addEventListener('click', ()=> authModal?.close());

  onAuthStateChanged(auth, async (user)=>{
    currentUser = user;
    if(user){
      await ensureUserDoc(user.uid, user.displayName || 'Foydalanuvchi');
      await refreshHeader();
      document.querySelectorAll('.admin-only').forEach(el=>hide(el));
      const u = await getDoc(doc(db,'users',user.uid));
      const data = u.data() || {};
      if(['1000001','1000002',1000001,1000002].includes(data.numericId)){
        document.querySelectorAll('.admin-only').forEach(el=>show(el));
      }
      $('authModal')?.close();
      hide(btnSignIn);
      show(btnSignOut);
      $('spLogout')?.classList.remove('hidden');
    }else{
      $('spName') && ($('spName').textContent='Mehmon');
      $('spId') && ($('spId').textContent='ID: —');
      $('headerId') && ($('headerId').textContent='ID: —');
      $('headerBalance') && ($('headerBalance').textContent='Balans: — so‘m');
      $('headerGems') && ($('headerGems').textContent='Olmos: —');
      show(btnSignIn);
      hide(btnSignOut);
    }
  });
}

async function signIn(){
  const provider = new GoogleAuthProvider();
  await signInWithPopup(auth, provider);
}

async function ensureUserDoc(uid, name){
  const uref = doc(db,'users',uid);
  await runTransaction(db, async (tx)=>{
    const snap = await tx.get(uref);
    if(!snap.exists()){
      // numericId generator via meta/counters
      const cref = doc(db,'meta','counters');
      const csnap = await tx.get(cref);
      let last = (csnap.exists() ? (csnap.data().lastNumericId||1000000) : 1000000);
      const next = last + 1;
      if(csnap.exists()) tx.update(cref,{lastNumericId: next});
      else tx.set(cref,{lastNumericId: next});
      tx.set(uref,{
        name, createdAt: serverTimestamp(),
        numericId: next, balance: 0, gems: 0, badges: [],
        phone: '', region: '', district: ''
      });
    }
  });
}

export async function refreshHeader(){
  if(!currentUser) return;
  const u = await getDoc(doc(db,'users',currentUser.uid));
  const d = u.data() || {};
  $('spName') && ($('spName').textContent=d.name || 'Foydalanuvchi');
  $('spId') && ($('spId').textContent='ID: '+(d.numericId??'—'));
  $('headerId') && ($('headerId').textContent='ID: '+(d.numericId??'—'));
  $('headerBalance') && ($('headerBalance').textContent='Balans: '+(d.balance??0)+' so‘m');
  $('headerGems') && ($('headerGems').textContent='Olmos: '+(d.gems??0));
}

export function getCtx(){
  return { app, auth, db, storage, user: currentUser };
}
