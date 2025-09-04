
// assets/js/firebase.js — Firebase init + helpers (ESM via CDN)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, onSnapshot, runTransaction, increment } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";

export const app = initializeApp({
  apiKey: "AIzaSyDYwHJou_9GqHZcf8XxtTByC51Z8un8rrM",
  authDomain: "xplusy-760fa.firebaseapp.com",
  projectId: "xplusy-760fa",
  storageBucket: "xplusy-760fa.appspot.com",
  messagingSenderId: "992512966017",
  appId: "1:992512966017:web:5e919dbc9b8d8abcb43c80",
  measurementId: "G-459PLJ7P7L"
});
export const auth = getAuth(app);
export const db = getFirestore(app);
const provider = new GoogleAuthProvider();

async function ensureNumericIdTx(tx){
  const metaRef = doc(db, 'meta', 'counters');
  const snap = await tx.get(metaRef);
  let next = 100001;
  if(snap.exists()){
    const d = snap.data();
    next = (typeof d.nextUserId === 'number' && d.nextUserId >= 100001) ? d.nextUserId : 100001;
  }
  await tx.set(metaRef, { nextUserId: next + 1 }, { merge: true });
  return next;
}
async function ensureUserDoc(user){
  const uref = doc(db, 'users', user.uid);
  await runTransaction(db, async (tx)=>{
    const us = await tx.get(uref);
    if(!us.exists()){
      const numericId = await ensureNumericIdTx(tx);
      tx.set(uref, {
        uid: user.uid,
        name: user.displayName || (user.email ? user.email.split('@')[0] : 'Foydalanuvchi'),
        email: user.email || null,
        balance: 0, points: 0,
        title: "Yangi a'zo",
        numericId
      });
    }else{
      const d = us.data();
      if(d.numericId == null){
        const numericId = await ensureNumericIdTx(tx);
        tx.update(uref, { numericId });
      }
    }
  });
}
function setText(sel, val){ const el = document.querySelector(sel); if(el) el.textContent = val; }
function toggle(cls, show){
  document.querySelectorAll(cls).forEach(el=>{
    if(show) el.classList.remove('hidden'); else el.classList.add('hidden');
  })
}
function bindUserBadge(user){
  if(!user){ // mehmon
    toggle('.guest-actions', true);
    toggle('.user-actions', false);
    return;
  }
  toggle('.guest-actions', false);
  toggle('.user-actions', true);
  setText('[data-val="hello-name"]', user.displayName || (user.email ? user.email.split('@')[0] : 'Foydalanuvchi'));
  const uref = doc(db, 'users', user.uid);
  onSnapshot(uref, (s)=>{
    const d=s.data()||{};
    setText('[data-val="id"]', d.numericId != null ? String(d.numericId) : '—');
    setText('[data-val="balance"]', d.balance != null ? String(d.balance) : '0');
    setText('[data-val="title"]', d.title || '—');
  });
}

export async function signInGoogle(){ await signInWithPopup(auth, provider); }
export async function signOutAll(){ await signOut(auth); }
export async function signUpEmail(name, email, pass){
  const { user } = await createUserWithEmailAndPassword(auth, email, pass);
  if(name) await updateProfile(user, { displayName: name });
}
export async function signInEmail(email, pass){
  await signInWithEmailAndPassword(auth, email, pass);
}

onAuthStateChanged(auth, async (user)=>{
  if(user){
    await ensureUserDoc(user);
    bindUserBadge(user);
  }else{
    bindUserBadge(null);
  }
});
