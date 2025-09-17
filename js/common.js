// common.js — Full v3 core (Firebase v10 + SPA helpers)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import {
  getAuth, onAuthStateChanged, setPersistence, browserLocalPersistence,
  signInWithPopup, GoogleAuthProvider, signOut
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, onSnapshot, runTransaction,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

// ---------------- Firebase init ----------------
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

// Auth persistence (stay signed in)
setPersistence(auth, browserLocalPersistence).catch(console.warn);

// ---------------- Global state ----------------
let _user = null;       // Firebase Auth user
let _userData = null;   // Firestore users/{uid} data
let _userUnsub = null;  // onSnapshot unsubscribe

const _ev = (name, detail) => document.dispatchEvent(new CustomEvent(name, { detail }));

// ---------------- Helpers: UI binding ----------------
const $all = (sel, root=document) => [...root.querySelectorAll(sel)];
const $ = (sel, root=document) => root.querySelector(sel);

function _formatNum(n){
  if (typeof n !== "number") n = Number(n ?? 0) || 0;
  return new Intl.NumberFormat("uz-UZ").format(n);
}

function _setText(el, text){
  if(!el) return;
  el.textContent = text;
}

function _bindHeader(data){
  const id = data?.numericId ?? "—";
  _setText($("#hdrId"), `ID: ${id}`);
  _setText($("#hdrBalance"), `💵 ${_formatNum(data?.balance ?? 0)}`);
  _setText($("#hdrGems"), `💎 ${_formatNum(data?.gems ?? 0)}`);
}

function _toggleAuthVisibility(isSignedIn){
  const inEls  = $all('[data-auth="in"]');
  const outEls = $all('[data-auth="out"]');
  inEls.forEach(el => el.style.display  = isSignedIn ? "" : "none");
  outEls.forEach(el => el.style.display = isSignedIn ? "none" : "");
}

// ---------------- Numeric ID allocator ----------------
// counters/users {last} -> transaction +1 ; first user gets 1000001
async function allocateNumericId(){
  const counterRef = doc(db, "counters", "users");
  const nextId = await runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef);
    let last = 1000000;
    if (!snap.exists()) {
      const candidate = last + 1;
      tx.set(counterRef, { last: candidate });
      return candidate;
    } else {
      const data = snap.data() || {};
      last = Number(data.last || 1000000);
      const candidate = last + 1;
      tx.update(counterRef, { last: candidate });
      return candidate;
    }
  });
  return nextId;
}

// ---------------- Users/{uid} lifecycle ----------------
async function ensureUserDoc(uid, profile = {}){
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);

  if (!snap.exists()){
    const newId = await allocateNumericId();
    const payload = {
      uid,
      email: profile.email ?? null,
      displayName: profile.displayName ?? null,
      createdAt: serverTimestamp(),
      numericId: newId,
      firstName:"", lastName:"", middleName:"", dob:"",
      region:"", district:"", phone:"",
      balance: 0, gems: 0, badges: []
    };
    await setDoc(ref, payload);
    return (await getDoc(ref)).data();
  } else {
    const data = snap.data() || {};
    // If numericId missing – backfill
    if (data.numericId == null){
      const fixedId = await allocateNumericId();
      await updateDoc(ref, { numericId: fixedId });
      data.numericId = fixedId;
    }
    // Merge missing profile fields
    const toMerge = {};
    if (!data.email && profile.email) toMerge.email = profile.email;
    if (!data.displayName && profile.displayName) toMerge.displayName = profile.displayName;
    if (Object.keys(toMerge).length) await updateDoc(ref, toMerge);
    return { ...data, ...toMerge };
  }
}

// Realtime watcher for users/{uid}
function _watchUserDoc(uid){
  if (_userUnsub){ _userUnsub(); _userUnsub = null; }
  if (!uid) return;
  const ref = doc(db, "users", uid);
  _userUnsub = onSnapshot(ref, (d) => {
    _userData = d.data() || null;
    _bindHeader(_userData);
    _ev("user:updated", { user: _user, data: _userData });
  }, (err) => console.error("[common] onSnapshot error:", err));
}

// ---------------- Auth flows ----------------
export async function signInWithGoogle(){
  const provider = new GoogleAuthProvider();
  const res = await signInWithPopup(auth, provider);
  return res.user;
}

export async function signOutUser(){ await signOut(auth); }

export function waitForAuthInit(){
  return new Promise((resolve) => {
    const off = onAuthStateChanged(auth, (u) => { off(); resolve(u || null); });
  });
}

function _showAuthModal(){
  ensureAuthModal();
  const m = $("#authModal"); if (m) m.style.display = "flex";
}

function _hideAuthModal(){
  const m = $("#authModal"); if (m) m.style.display = "none";
}

// Bind auth UI buttons globally or within a root
export function attachAuthUI(root=document){
  // Google Sign-in
  $all('[data-action="google-signin"], .js-google-signin', root).forEach(btn => {
    if (btn.__bound) return; btn.__bound = true;
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      try {
        btn.disabled = true;
        await signInWithGoogle();
        _hideAuthModal();
      } catch (err) {
        console.error("[auth] signIn error:", err);
        alert("Kirishda xatolik. Keyinroq urinib ko'ring.");
      } finally {
        btn.disabled = false;
      }
    });
  });

  // Sign-out
  $all('[data-action="signout"], .js-signout', root).forEach(btn => {
    if (btn.__bound) return; btn.__bound = true;
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      try { btn.disabled = true; await signOutUser(); }
      catch(err){ console.error("[auth] signOut error:", err); }
      finally { btn.disabled = false; }
    });
  });

  // Modal close
  $all('[data-close="auth"]', root).forEach(btn => {
    if (btn.__bound) return; btn.__bound = true;
    btn.addEventListener("click", (e) => { e.preventDefault(); _hideAuthModal(); });
  });
}

// Public helpers
export function getCurrentUser(){ return _user; }
export function getCurrentUserData(){ return _userData; }
export function isSignedIn(){ return !!_user; }
export function requireAuthOrModal(){
  if (!isSignedIn()){ _showAuthModal(); return false; }
  return true;
}

// Init UX & auth state wiring (called by router.js on boot)
export function initUX(){
  onAuthStateChanged(auth, async (u) => {
    _user = u || null;
    if (!_user){
      _userData = null;
      _bindHeader(null);
      _toggleAuthVisibility(false);
      _watchUserDoc(null);
      _ev("user:updated", { user:null, data:null });
      return;
    }
    try {
      _toggleAuthVisibility(true);
      _userData = await ensureUserDoc(_user.uid, {
        email: _user.email || null,
        displayName: _user.displayName || null
      });
      _bindHeader(_userData);
      _watchUserDoc(_user.uid);
      _hideAuthModal();
    } catch (err){
      console.error("[common] ensureUserDoc error:", err);
    }
  });

  // Bind any auth buttons that may already be in DOM
  attachAuthUI(document);
}

// --- Auth Modal (lazy inject) ---
function ensureAuthModal(){
  if ($("#authModal")) return;
  const cssId = "authModalCSS";
  if (!$("#"+cssId)){
    const style = document.createElement("style");
    style.id = cssId;
    style.textContent = `
      #authModal{position:fixed;inset:0;display:none;align-items:center;justify-content:center;z-index:9999;background:rgba(0,0,0,.55);backdrop-filter:blur(2px)}
      .auth-card{width:min(420px,92vw);background:#101418;color:#fff;border-radius:18px;box-shadow:0 20px 60px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.04)}
      .auth-head{padding:18px 20px;border-bottom:1px solid rgba(255,255,255,.06);display:flex;gap:10px;align-items:center}
      .auth-title{font-weight:700}
      .auth-body{padding:22px 20px;display:grid;gap:14px}
      .btn{display:inline-flex;align-items:center;justify-content:center;padding:12px 14px;border-radius:12px;border:0;cursor:pointer;font-weight:600}
      .btn-google{background:#fff;color:#111;box-shadow:inset 0 -2px 0 rgba(0,0,0,.1)}
      .auth-close{position:absolute;top:10px;right:10px;border:0;background:transparent;color:#9aa4af;font-size:22px;cursor:pointer}
      .auth-wrap{position:relative;padding-bottom:8px}
    `;
    document.head.appendChild(style);
  }
  const html = `
  <div id="authModal" role="dialog" aria-modal="true" aria-labelledby="authTitle">
    <div class="auth-card">
      <div class="auth-wrap">
        <button class="auth-close" data-close="auth" aria-label="Yopish">×</button>
        <div class="auth-head"><div class="auth-title" id="authTitle">Kirish talab qilinadi</div></div>
        <div class="auth-body">
          <button class="btn btn-google" data-action="google-signin">Google bilan davom etish</button>
        </div>
      </div>
    </div>
  </div>`;
  document.body.insertAdjacentHTML("beforeend", html);
  attachAuthUI($("#authModal"));
}
