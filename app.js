// app.js — SPA shell + Auth system (ID + password login only)
// Uses Firebase v10 modular SDK from gstatic CDN.
// 1) Paste your FIREBASE_CONFIG in index.html (window.FIREBASE_CONFIG)
// 2) The index page contains no content; partials/*.html are loaded into #app.
//
// Auth policy required by the user:
// - Sign-in: ONLY by numeric ID + password (no email/Google login)
// - Sign-up options:
//    a) Email sign-up (email+password).
//    b) Google sign-up (registration only) -> must set a password -> later login via ID+password.
//    c) One-click sign-up (no email). System assigns next numeric ID and creates an internal alias email.
// - Numeric ID sequence: 1000001, 1000002, ... assigned with a Firestore transaction from meta/counters.nextNumericId
//
// Firestore structure used here:
//   meta/counters        { nextNumericId: 1000001 }
//   users/{uid}          { numericId, name, balance, gems, createdAt, updatedAt, ... }
//   ids/{numericId}      { numericId, uid, email }   // mapping for ID -> email used for hidden email login
//
// Suggested Firestore security rules snippet (adjust as needed):
// -------------------------------------------------------------
// rules_version = '2';
// service cloud.firestore {
//   match /databases/{database}/documents {
//     function isSignedIn() { return request.auth != null; }
//     function userDoc(uid) { return get(/databases/$(database)/documents/users/$(uid)); }
//     function isOwner(uid) { return isSignedIn() && request.auth.uid == uid; }
//     function isAdmin() {
//       return isSignedIn() && (
//         userDoc(request.auth.uid).data.numericId in [1000001, 1000002] ||
//         userDoc(request.auth.uid).data.numericId in ["1000001","1000002"]
//       );
//     }
//     match /users/{uid} {
//       allow read: if isOwner(uid) || isAdmin();
//       allow create: if isOwner(uid);
//       allow update: if isOwner(uid);
//     }
//     match /ids/{id} {
//       allow read: if isSignedIn();  // allow lookup for login
//       allow create: if isSignedIn();
//       allow update: if isSignedIn();
//     }
//     match /meta/{doc} {
//       allow read: if true;
//       allow write: if isSignedIn(); // tighten for production
//     }
//   }
// }
// -------------------------------------------------------------

const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

// Render current year
$("#year").textContent = String(new Date().getFullYear());

// Modal controls
const authModal = $("#authModal");
$("#openAuth").addEventListener("click", () => openModal(authModal));
$$("[data-close]", authModal).forEach(el => el.addEventListener("click", () => closeModal(authModal)));
function openModal(m){ m.setAttribute("aria-hidden","false"); }
function closeModal(m){ m.setAttribute("aria-hidden","true"); }

// Tabs
$$(".tab").forEach(btn => {
  btn.addEventListener("click", () => {
    $$(".tab").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const name = btn.dataset.tab;
    $$(".tab-panel").forEach(p => p.classList.toggle("active", p.dataset.panel === name));
  });
});
$$(".subtab").forEach(btn => {
  btn.addEventListener("click", () => {
    $$(".subtab").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const name = btn.dataset.sub;
    $$(".subpanel").forEach(p => p.classList.toggle("active", p.dataset.subpanel === name));
  });
});

// Simple SPA router (hash-based). Partial HTMLs live in /partials/*.html
const app = $("#app");
const routes = ["home", "tests", "live", "leaderboard", "about"];
async function loadRoute() {
  const hash = location.hash.replace("#","") || "home";
  const route = routes.includes(hash) ? hash : "home";
  try {
    const res = await fetch(`./partials/${route}.html`, {cache: "no-store"});
    if (!res.ok) throw new Error("Partial topilmadi");
    const html = await res.text();
    app.innerHTML = html;
  } catch (e) {
    app.innerHTML = `<div class="card"><h2>${route}</h2><p class="muted">Partial faylini (partials/${route}.html) hozircha qo‘ymagansiz.</p></div>`;
  }
}
window.addEventListener("hashchange", loadRoute);
loadRoute();

// ---------------- Firebase ----------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signOut, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup,
  linkWithCredential, EmailAuthProvider, signInAnonymously
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, serverTimestamp, runTransaction, updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";

if (!window.FIREBASE_CONFIG) {
  console.warn("[XplusY] FIREBASE_CONFIG topilmadi. Auth ishlamaydi. index.html ichidagi kommentda ko‘rsatma bor.");
}

const appFB = initializeApp(window.FIREBASE_CONFIG || {
  // Dummy — so that module imports don't crash if config is missing.
  apiKey: "DUMMY",
  authDomain: "dummy.firebaseapp.com",
  projectId: "dummy",
});
const auth = getAuth(appFB);
const db = getFirestore(appFB);
const provider = new GoogleAuthProvider();

// Helpers: numeric ID assignment and lookup
async function ensureUserNumericId(uid, email, name) {
  // If users/{uid}.numericId exists — return it
  const uref = doc(db, "users", uid);
  const usnap = await getDoc(uref);
  if (usnap.exists() && usnap.data().numericId) {
    return usnap.data().numericId;
  }
  // Else assign via transaction
  const metaRef = doc(db, "meta", "counters");
  const assignedId = await runTransaction(db, async (tx) => {
    const m = await tx.get(metaRef);
    let next = 1000001;
    if (m.exists() && m.data().nextNumericId) {
      const raw = m.data().nextNumericId;
      next = typeof raw === "number" ? raw : parseInt(raw, 10) || next;
    }
    const id = next;
    tx.set(metaRef, { nextNumericId: id + 1 }, { merge: true });

    // Create/merge user document
    const payload = {
      uid, email: email || null, name: name || null,
      numericId: id, balance: 0, gems: 0,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    };
    tx.set(uref, payload, { merge: true });

    // Mapping: ids/{id} -> {uid, email}
    const idsRef = doc(db, "ids", String(id));
    tx.set(idsRef, { uid, email: email || null, numericId: id, createdAt: serverTimestamp() }, { merge: true });
    return id;
  });
  return assignedId;
}

async function getEmailByNumericId(numericId) {
  const idMapRef = doc(db, "ids", String(numericId));
  const snap = await getDoc(idMapRef);
  if (!snap.exists()) throw new Error("ID topilmadi");
  const { email } = snap.data();
  if (!email) throw new Error("Ushbu ID uchun tizim emaili mavjud emas. Parol o‘rnatilmagan bo‘lishi mumkin.");
  return email;
}

// UI: header auth state
const authChip = $("#authChip");
function renderSignedOut() {
  authChip.innerHTML = `<button id="openAuth" class="btn primary">Kirish / Ro‘yxatdan o‘tish</button>`;
  $("#openAuth").addEventListener("click", () => openModal(authModal));
}
async function renderSignedIn(user) {
  try {
    const uref = doc(db, "users", user.uid);
    const usnap = await getDoc(uref);
    const data = usnap.exists() ? usnap.data() : {};
    const id = data.numericId || "—";
    const balance = data.balance ?? 0;
    const gems = data.gems ?? 0;
    authChip.innerHTML = `
      <div class="id-badge">
        <div><b>ID:</b> ${id}</div>
        <div class="meta">Balans: ${balance.toLocaleString()} so‘m • Olmos: ${gems}</div>
        <button id="logoutBtn" class="btn">Chiqish</button>
      </div>
    `;
    $("#logoutBtn").addEventListener("click", async () => { await signOut(auth); });
  } catch (e) {
    console.error(e);
    renderSignedOut();
  }
}

onAuthStateChanged(auth, (user) => {
  if (user) renderSignedIn(user);
  else renderSignedOut();
});

// ---------- Login (ID + password) ----------
$("#loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = ($("#loginId").value || "").trim();
  const pass = $("#loginPass").value;
  const msg = $("#loginMsg");
  msg.textContent = "Tekshirilmoqda...";
  msg.className = "msg";

  try {
    const email = await getEmailByNumericId(id);
    await signInWithEmailAndPassword(auth, email, pass);
    msg.textContent = "Kirish muvaffaqiyatli.";
    msg.classList.add("ok");
    closeModal(authModal);
  } catch (err) {
    console.error(err);
    msg.textContent = "Kirish amalga oshmadi: " + (err.message || err);
    msg.classList.add("error");
  }
});

// ---------- Signup: Email ----------
$("#signupEmailForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = $("#seName").value.trim() || null;
  const email = $("#seEmail").value.trim();
  const pass = $("#sePass").value;
  const msg = $("#signupEmailMsg");
  msg.textContent = "Ro‘yxatdan o‘tkazilmoqda...";
  msg.className = "msg";

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    const uid = cred.user.uid;
    const numericId = await ensureUserNumericId(uid, email, name);
    // Ensure ids/{id} mapping is correct (email = provided email)
    await setDoc(doc(db, "ids", String(numericId)), { uid, email, numericId }, { merge: true });
    msg.textContent = `Tayyor! Sizning ID: ${numericId}. Endi kirishda faqat ID + parol ishlatiladi.`;
    msg.classList.add("ok");
    closeModal(authModal);
  } catch (err) {
    console.error(err);
    msg.textContent = "Ro‘yxatdan o‘tishda xatolik: " + (err.message || err);
    msg.classList.add("error");
  }
});

// ---------- Signup: Google (registration only) ----------
const googleBtn = $("#googleBtn");
const signupGoogleMsg = $("#signupGoogleMsg");
const googleSetPassForm = $("#googleSetPassForm");
const signupGoogleStepSetPass = $("#signupGoogleStepSetPass");

googleBtn.addEventListener("click", async () => {
  signupGoogleMsg.textContent = "Google orqali kirmoqda..."; signupGoogleMsg.className = "msg";
  try {
    const { user } = await signInWithPopup(auth, provider);
    const uid = user.uid;
    const email = user.email;
    await ensureUserNumericId(uid, email, user.displayName || null);
    // Now ask to set a password (link email/password to Google account)
    signupGoogleStepSetPass.classList.remove("hidden");
    signupGoogleMsg.textContent = "Google bog‘landi. Endi parol belgilang.";
  } catch (err) {
    console.error(err);
    signupGoogleMsg.textContent = "Google ro‘yxatdan o‘tishda xatolik: " + (err.message || err);
    signupGoogleMsg.classList.add("error");
  }
});

googleSetPassForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const pass = $("#sgPass").value;
  signupGoogleMsg.textContent = "Parol ulanmoqda..."; signupGoogleMsg.className = "msg";
  try {
    const user = auth.currentUser;
    if (!user || !user.email) throw new Error("Google foydalanuvchisi aniqlanmadi.");
    const cred = EmailAuthProvider.credential(user.email, pass);
    await linkWithCredential(user, cred); // link password to Google account
    // Make sure mapping exists for login by ID
    const usnap = await getDoc(doc(db, "users", user.uid));
    const numericId = usnap.exists() ? usnap.data().numericId : null;
    if (numericId) {
      await setDoc(doc(db, "ids", String(numericId)), { uid: user.uid, email: user.email, numericId }, { merge: true });
    }
    signupGoogleMsg.textContent = "Parol o‘rnatildi. Endi kirishda faqat ID + parol foydalanasiz.";
    signupGoogleMsg.classList.add("ok");
    closeModal(authModal);
  } catch (err) {
    console.error(err);
    signupGoogleMsg.textContent = "Parol ulashda xatolik: " + (err.message || err);
    signupGoogleMsg.classList.add("error");
  }
});

// ---------- Signup: One-click (no email) ----------
$("#oneClickForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = $("#ocName").value.trim() || null;
  const pass = $("#ocPass").value;
  const msg = $("#oneClickMsg");
  msg.textContent = "Yaratilmoqda..."; msg.className = "msg";

  try {
    // 1) sign in anonymously to get a uid
    const anon = await signInAnonymously(auth);
    const uid = anon.user.uid;
    // 2) assign numeric ID
    const numericId = await ensureUserNumericId(uid, null, name);
    // 3) create an internal alias email and link password
    const aliasEmail = `${numericId}@xplusy.local`;
    const cred = EmailAuthProvider.credential(aliasEmail, pass);
    await linkWithCredential(anon.user, cred);
    // 4) store mapping for ID -> aliasEmail
    await setDoc(doc(db, "ids", String(numericId)), { uid, email: aliasEmail, numericId }, { merge: true });
    msg.textContent = `Tayyor! Sizning ID: ${numericId}. Endi kirishda ID (${numericId}) va parolingizdan foydalaning.`;
    msg.classList.add("ok");
    closeModal(authModal);
  } catch (err) {
    console.error(err);
    msg.textContent = "Xatolik: " + (err.message || err);
    msg.classList.add("error");
  }
});

// -------------------- End Firebase/Auth --------------------
