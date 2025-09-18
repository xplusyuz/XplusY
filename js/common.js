import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, serverTimestamp, runTransaction, increment, collection, query, orderBy, limit, getDocs, where } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";

export const state = { app:null, auth:null, db:null, storage:null, user:null, userDoc:null };

async function loadConfig(){
  try{
    const res = await fetch('./js/firebase-config.json', {cache:'no-store'});
    if (res.ok) return await res.json();
  }catch(e){}
  return {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "000000000000",
    appId: "1:000000000000:web:xxxxxxxxxxxxxxxx",
  };
}

export async function initAppShell(){
  const cfg = await loadConfig();
  state.app = initializeApp(cfg);
  state.auth = getAuth(state.app);
  state.db = getFirestore(state.app);
  state.storage = getStorage(state.app);

  document.getElementById('year').textContent = new Date().getFullYear();
  const authDialog = document.getElementById('authDialog');
  const btnSignIn = document.getElementById('btnSignIn');
  const btnSignOut = document.getElementById('btnSignOut');
  const btnToggleSidebar = document.getElementById('btnToggleSidebar');
  const sidebar = document.getElementById('sidebar');

  btnToggleSidebar?.addEventListener('click', () => sidebar.classList.toggle('open'));
  btnSignIn?.addEventListener('click', () => { authDialog.showModal(); attachAuthUI(); });
  document.getElementById('closeAuth')?.addEventListener('click', () => authDialog.close());
  btnSignOut?.addEventListener('click', async ()=> await signOut(state.auth));

  onAuthStateChanged(state.auth, async (user)=>{
    state.user = user || null;
    await ensureUserDoc();
    paintHeader();
    toggleAdminUI();
  });
}

export function toggleAdminUI(){
  const els = document.querySelectorAll('.admin-only');
  const isAdmin = state.userDoc?.numericId==1000001 || state.userDoc?.numericId==1000002 || state.userDoc?.numericId=="1000001" || state.userDoc?.numericId=="1000002";
  els.forEach(el => el.style.display = isAdmin ? '' : 'none');
}

function paintHeader(){
  const chipId = document.getElementById('userNumericId');
  const chipBal = document.getElementById('userBalance');
  const chipGem = document.getElementById('userGems');
  const btnSignIn = document.getElementById('btnSignIn');
  if (!state.user){
    chipId.textContent = "#———"; chipBal.textContent = "0 so‘m"; chipGem.textContent = "0 💎";
    btnSignIn?.classList.remove('hidden'); return;
  }
  btnSignIn?.classList.add('hidden');
  const d = state.userDoc || {};
  chipId.textContent = "#"+(d.numericId||"———");
  chipBal.textContent = (d.balance||0).toLocaleString('uz-UZ')+" so‘m";
  chipGem.textContent = (d.gems||0)+" 💎";
}

export async function attachAuthUI(){
  const mount = document.getElementById('authMount'); if (!mount) return;
  mount.innerHTML='';
  const btn = document.createElement('button');
  btn.className='btn primary'; btn.textContent='Google bilan kirish';
  btn.onclick = async ()=>{ const provider = new GoogleAuthProvider(); await signInWithPopup(state.auth, provider); document.getElementById('authDialog')?.close(); };
  mount.appendChild(btn);
}

async function ensureUserDoc(){
  if (!state.user){ state.userDoc=null; return; }
  const uref = doc(state.db,'users', state.user.uid);
  const snap = await getDoc(uref);
  if (!snap.exists()){
    const metaRef = doc(state.db, 'meta', 'app');
    await runTransaction(state.db, async (tx)=>{
      const meta = await tx.get(metaRef);
      const start = 1000001;
      const next = (meta.exists()? (meta.data().nextNumericId||start): start);
      tx.set(metaRef, { nextNumericId: next+1 }, { merge:true });
      tx.set(uref, { numericId: next, createdAt: serverTimestamp(), balance:0, gems:0, badges:[], phone:null, firstName: state.user.displayName||'' });
    });
    state.userDoc = (await getDoc(uref)).data();
  }else{
    state.userDoc = snap.data();
  }
}

/* Helpers */
export function el(html){ const t=document.createElement('template'); t.innerHTML=html.trim(); return t.content.firstElementChild; }
export function fmtMoney(n){ return (n||0).toLocaleString('uz-UZ') + ' so‘m'; }
export function img(src, alt=""){
  const i = new Image();
  i.src = src; i.alt = alt; i.className='card-cover';
  i.onerror = ()=>{
    const ph = el('<div class="card-cover img-fallback">Rasm yo‘q</div>');
    i.replaceWith(ph);
  };
  return i;
}

/* Data API */
import { collection, query, orderBy, limit, getDocs, where, doc as _doc, setDoc as _setDoc } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
export async function getTopLeaderboard(limitCount=100){
  const qref = query(collection(state.db,'users'), orderBy('gems','desc'), limit(limitCount));
  const out = []; const qs = await getDocs(qref); qs.forEach(d=> out.push({id:d.id, ...d.data()})); return out;
}
export async function redeemPromo(code){
  code=(code||'').trim().toUpperCase(); if(!code) throw new Error('Kod kiriting');
  const codeRef = _doc(state.db,'promo_codes', code);
  const userRef = _doc(state.db,'users', state.user.uid);
  await runTransaction(state.db, async (tx)=>{
    const cs = await tx.get(codeRef); if(!cs.exists()) throw new Error('Kod topilmadi');
    const cd = cs.data(); if ((cd.usesRemaining??0) <= 0) throw new Error('Kod ishlatilgan');
    const us = await tx.get(userRef); if(!us.exists()) throw new Error('User topilmadi');
    tx.update(userRef, { gems: increment(cd.gems||0), balance: increment(cd.balance||0), lastPromoAt: serverTimestamp() });
    tx.update(codeRef, { usesRemaining: increment(-1) });
  });
}
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";
export async function createTopUpRequest({amount, method, file}){
  if (!state.user) throw new Error('Avval kiring');
  if (!amount || amount<1000) throw new Error('Minimal summa 1 000 so‘m');
  const id = Math.random().toString(36).slice(2);
  let receiptUrl = null;
  if (file){
    const r = ref(state.storage, `receipts/${state.user.uid}/${Date.now()}-${file.name}`);
    const buf = await file.arrayBuffer();
    await uploadBytes(r, new Uint8Array(buf), { contentType: file.type||'application/octet-stream' });
    receiptUrl = await getDownloadURL(r);
  }
  const recRef = _doc(state.db,'topups', id);
  await setDoc(recRef, { uid: state.user.uid, amount, method, receiptUrl, status:'pending', createdAt: serverTimestamp() });
  return id;
}
export async function listPendingTopups(){
  const isAdmin = state.userDoc?.numericId==1000001 || state.userDoc?.numericId==1000002 || state.userDoc?.numericId=="1000001" || state.userDoc?.numericId=="1000002";
  if (!isAdmin) return [];
  const qref = query(collection(state.db,'topups'), where('status','==','pending'), orderBy('createdAt','desc'), limit(100));
  const out=[]; const qs=await getDocs(qref); qs.forEach(d=> out.push({id:d.id, ...d.data()})); return out;
}
export async function approveTopup(id){
  const isAdmin = state.userDoc?.numericId==1000001 || state.userDoc?.numericId==1000002 || state.userDoc?.numericId=="1000001" || state.userDoc?.numericId=="1000002";
  if (!isAdmin) throw new Error('Admin emas');
  const recRef = _doc(state.db,'topups', id);
  const recSnap = await getDoc(recRef); if(!recSnap.exists()) throw new Error('Topup topilmadi');
  const { uid, amount } = recSnap.data();
  const userRef = _doc(state.db,'users', uid);
  await runTransaction(state.db, async (tx)=>{
    tx.update(userRef, { balance: increment(amount) });
    tx.update(recRef, { status: 'approved', approvedAt: serverTimestamp() });
  });
}
