// common.js — XplusY/MathCenter umumiy modul (Firebase v10, SPA helpers)
// CDN ESM importlar
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

// Auth persistent (bir kirishda qolib turishi uchun)
setPersistence(auth, browserLocalPersistence).catch(console.warn);

// ---------------- Global holat ----------------
let _user = null;              // Firebase Auth user (yoki null)
let _userData = null;          // Firestore users/{uid} data
let _userUnsub = null;         // onSnapshot unsub
const _ev = (name, detail) => document.dispatchEvent(new CustomEvent(name, { detail }));

// ---------------- Helpers: UI binding ----------------
function _setText(selectors, value) {
  const arr = Array.isArray(selectors) ? selectors : [selectors];
  for (const sel of arr) {
    document.querySelectorAll(sel).forEach(el => { 
      el.textContent = value !== null && value !== undefined ? value : "—"; 
    });
  }
}

function _toggleAuthVisibility(isSignedIn) {
  const btn = document.getElementById('btnSignIn');
  if(btn) btn.style.display = isSignedIn ? 'none' : '';
  document.querySelectorAll('[data-auth="in"]').forEach(el => el.style.display = isSignedIn ? "" : "none");
  document.querySelectorAll('[data-auth="out"]').forEach(el => el.style.display = isSignedIn ? "none" : "");
}

function _formatNum(n) {
  if (typeof n !== "number") return n ?? 0;
  return new Intl.NumberFormat("uz-UZ").format(n);
}

function _bindHeader(data) {
  // ID / balance / gems ni turli selectorlar orqali yangilaymiz (sahifa mosligi uchun keng qamrovli)
  _setText(['#hdrId', '#userId', '.js-user-id', '[data-bind="numericId"]'], data?.numericId);
  _setText(['#hdrBalance', '#hdrBal', '#balance', '.js-user-balance', '[data-bind="balance"]'], _formatNum(data?.balance));
  _setText(['#hdrGems', '#hdrGem', '#gems', '.js-user-gems', '[data-bind="gems"]'], _formatNum(data?.gems));
}

// ---------------- Numeric ID allocator ----------------
// counters/users hujjatidagi {last} ni transaktsiya bilan +1 qilib boradi.
// Birinchi user uchun 1000001 ni ajratadi.
async function allocateNumericId() {
  const counterRef = doc(db, "counters", "users");
  const nextId = await runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef);
    let last = 1000000; // start baza
    if (snap.exists()) {
      const data = snap.data() || {};
      last = Number(data.last || 1000000);
    } else {
      tx.set(counterRef, { last }); // hujjatni yaratib qo'yamiz
    }
    const candidate = last + 1; // yangi id
    tx.update(counterRef, { last: candidate });
    return candidate;
  });
  return nextId;
}

// ---------------- Users/{uid} lifecycle ----------------
async function ensureUserDoc(uid, profile = {}) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    const newId = await allocateNumericId();
    const payload = {
      uid,
      email: profile.email ?? null,
      displayName: profile.displayName ?? null,
      createdAt: serverTimestamp(),
      numericId: newId,
      // Profil maydonlari (bo'sh holda)
      firstName: "", lastName: "", middleName: "", dob: "",
      region: "", district: "", phone: "",
      // Valyuta va gamifikatsiya
      balance: 0, gems: 0, badges: []
    };
    await setDoc(ref, payload);
    return (await getDoc(ref)).data();
  } else {
    const data = snap.data() || {};
    if (data.numericId == null) {
      const fixedId = await allocateNumericId();
      await updateDoc(ref, { numericId: fixedId });
      data.numericId = fixedId;
    }
    // Email/displayName bo'sh qolgan bo'lsa to'ldirib yuboramiz (merge)
    const toMerge = {};
    if (!data.email && profile.email) toMerge.email = profile.email;
    if (!data.displayName && profile.displayName) toMerge.displayName = profile.displayName;
    if (Object.keys(toMerge).length) await updateDoc(ref, toMerge);
    return { ...data, ...toMerge };
  }
}

// Joriy foydalanuvchining users/{uid} hujjatini realtime kuzatish
function _watchUserDoc(uid) {
  if (_userUnsub) { 
    _userUnsub(); 
    _userUnsub = null; 
  }
  if (!uid) return;

  const ref = doc(db, "users", uid);
  _userUnsub = onSnapshot(ref, 
    (d) => {
      _userData = d.data() || null;
      _bindHeader(_userData);
      _ev("user:updated", { user: _user, data: _userData });
    }, 
    (err) => console.error("[common] onSnapshot error:", err)
  );
}

// ---------------- Auth flows ----------------
export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  const res = await signInWithPopup(auth, provider);
  return res.user;
}

export async function signOutUser() {
  await signOut(auth);
}

// Auth tayyor bo'lishini kutish (bir martalik)
export function waitForAuthInit() {
  return new Promise((resolve) => {
    const off = onAuthStateChanged(auth, (u) => {
      off();
      resolve(u || null);
    });
  });
}

// Modal yordamchilari
function _showAuthModal() {
  ensureAuthModal();
  const m = document.getElementById("authModal");
  if (m) m.style.display = "flex";
}

function _hideAuthModal() {
  const m = document.getElementById("authModal");
  if (m) m.style.display = "none";
}

// Sahifa bo'ylab kirish/chiqish tugmalarini biriktirish
export function attachAuthUI(root = document) {
  // Google bilan kirish
  root.querySelectorAll('[data-action="google-signin"], .js-google-signin').forEach(btn => {
    if (btn.__bound) return; 
    btn.__bound = true;
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

  // Chiqish
  root.querySelectorAll('[data-action="signout"], .js-signout').forEach(btn => {
    if (btn.__bound) return; 
    btn.__bound = true;
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      try {
        btn.disabled = true;
        await signOutUser();
      } catch (err) {
        console.error("[auth] signOut error:", err);
      } finally {
        btn.disabled = false;
      }
    });
  });

  // Modalni yopish tugmalari
  root.querySelectorAll('[data-close="auth"]').forEach(btn => {
    if (btn.__bound) return; 
    btn.__bound = true;
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      _hideAuthModal();
    });
  });
}

// ---------------- UX init (router.js chaqiradi) ----------------
export function initUX() {
  // Auth state listener
  onAuthStateChanged(auth, async (u) => {
    _user = u || null;

    if (!_user) {
      _userData = null;
      _bindHeader(null);
      _toggleAuthVisibility(false);
      _watchUserDoc(null);
      _ev("user:updated", { user: null, data: null });
      return;
    }

    try {
      _toggleAuthVisibility(true);
      // Users/{uid} yaratish/yuklash
      _userData = await ensureUserDoc(_user.uid, {
        email: _user.email || null,
        displayName: _user.displayName || null
      });
      _bindHeader(_userData);
      _watchUserDoc(_user.uid);
      _hideAuthModal();
    } catch (err) {
      console.error("[common] ensureUserDoc error:", err);
    }
  });

  // Sahifadagi tugmalarni bog'lab chiqamiz
  attachAuthUI(document);
}

// ---------------- Public getters ----------------
export function getCurrentUser()   { return _user; }
export function getCurrentUserData(){ return _userData; }
export function isSignedIn()       { return !!_user; }
export function requireAuthOrModal() {
  if (!isSignedIn()) { 
    _showAuthModal(); 
    return false; 
  }
  return true;
}

// --- MODAL: yaratish, ochish-yopish, bog'lash ---
function ensureAuthModal() {
  // allaqachon bor bo'lsa – o'tamiz
  if (document.getElementById("authModal")) return;

  // CSS ni kiritamiz (bir marta)
  const css = `
  #authModal{position:fixed;inset:0;display:none;align-items:center;justify-content:center;z-index:9999;background:rgba(0,0,0,.55);backdrop-filter:blur(2px)}
  .auth-card{width:min(420px,92vw);background:#101418;color:#fff;border-radius:18px;box-shadow:0 20px 60px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.04)}
  .auth-head{padding:18px 20px;border-bottom:1px solid rgba(255,255,255,.06);display:flex;align-items:center;gap:10px}
  .auth-title{font-size:18px;font-weight:700}
  .auth-body{padding:22px 20px;display:grid;gap:14px}
  .btn{display:inline-flex;align-items:center;justify-content:center;padding:12px 14px;border-radius:12px;border:0;cursor:pointer;font-weight:600}
  .btn-google{background:#fff;color:#111;box-shadow:inset 0 -2px 0 rgba(0,0,0,.1)}
  .auth-close{position:absolute;top:10px;right:10px;border:0;background:transparent;color:#9aa4af;font-size:22px;cursor:pointer}
  .auth-wrap{position:relative;padding-bottom:8px}
  `;
  
  if (!document.getElementById("authModalCSS")) {
    const style = document.createElement("style");
    style.id = "authModalCSS";
    style.textContent = css;
    document.head.appendChild(style);
  }

  // HTML ni qo'shamiz
  const html = `
  <div id="authModal" role="dialog" aria-modal="true" aria-labelledby="authTitle">
    <div class="auth-card">
      <div class="auth-wrap">
        <button class="auth-close" data-close="auth" aria-label="Yopish">×</button>
        <div class="auth-head">
          <div class="auth-title" id="authTitle">Kirish talab qilinadi</div>
        </div>
        <div class="auth-body">
          <button class="btn btn-google" data-action="google-signin">
            Google bilan davom etish
          </button>
        </div>
      </div>
    </div>
  </div>`;
  document.body.insertAdjacentHTML("beforeend", html);

  // modal ichidagi tugmalar uchun auth UI ni bog'lab qo'yamiz
  attachAuthUI(document.getElementById("authModal"));
}

// Dublikat funksiyalarni olib tashlaymiz
// (Fayl oxirida takrorlangan _showAuthModal va _hideAuthModal funksiyalari olib tashlandi)