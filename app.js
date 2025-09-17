// app.js — SPA shell + Auth + Side Panel
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signOut, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup,
  linkWithCredential, linkWithPopup, EmailAuthProvider, signInAnonymously
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, serverTimestamp, runTransaction, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";

const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

// Render current year
$("#year").textContent = String(new Date().getFullYear());

// Modal controls (Auth)
const authModal = $("#authModal");
const openAuthBtn = $("#openAuth");
if (openAuthBtn) openAuthBtn.addEventListener("click", () => openModal(authModal));
$$("[data-close]", authModal).forEach(el => el.addEventListener("click", () => closeModal(authModal)));
function openModal(m){ m.setAttribute("aria-hidden","false"); document.body.style.overflow="hidden"; }
function closeModal(m){ m.setAttribute("aria-hidden","true"); document.body.style.overflow=""; }

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
    app.innerHTML = `<div class="card" style="padding:16px; border:1px solid rgba(255,255,255,.06); border-radius:14px; background:var(--card); box-shadow: var(--shadow);">
      <h2 style="margin-top:0">${route}</h2>
      <p class="muted">Partial faylini (partials/${route}.html) hozircha qo‘ymagansiz.</p>
    </div>`;
  }
}
window.addEventListener("hashchange", loadRoute);
loadRoute();

// ===== Side Panel controls =====
const sidePanel = $("#sidePanel");
const menuBtn = $("#menuBtn");
function openPanel(){
  sidePanel.setAttribute("aria-hidden", "false");
  if (menuBtn) menuBtn.setAttribute("aria-expanded", "true");
  document.body.style.overflow = "hidden";
  // focus trap start
  const card = $(".panel-card", sidePanel);
  if (card) card.focus();
}
function closePanel(){
  sidePanel.setAttribute("aria-hidden", "true");
  if (menuBtn) menuBtn.setAttribute("aria-expanded", "false");
  document.body.style.overflow = "";
}
if (menuBtn) menuBtn.addEventListener("click", () => {
  const hidden = sidePanel.getAttribute("aria-hidden") !== "false";
  hidden ? openPanel() : closePanel();
});
$$("[data-close-panel]", sidePanel).forEach(el => el.addEventListener("click", closePanel));
// Close on ESC & after nav click
window.addEventListener("keydown", (e) => { if (e.key === "Escape") closePanel(); });
$$("[data-panel-link]", sidePanel).forEach(a => a.addEventListener("click", closePanel));

// ---------------- Firebase ----------------
if (!window.FIREBASE_CONFIG) console.warn("[XplusY] FIREBASE_CONFIG topilmadi (index.html ni tekshiring).");

const appFB = initializeApp(window.FIREBASE_CONFIG || {
  apiKey: "DUMMY", authDomain: "dummy.firebaseapp.com", projectId: "dummy",
});
const auth = getAuth(appFB);
const db = getFirestore(appFB);
const provider = new GoogleAuthProvider();

// Helpers: numeric ID assignment and lookup
async function ensureUserNumericId(uid, email, name) {
  const uref = doc(db, "users", uid);
  const usnap = await getDoc(uref);
  if (usnap.exists() && usnap.data().numericId) return usnap.data().numericId;

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
    tx.set(uref, {
      uid, email: email || null, name: name || null,
      numericId: id, balance: 0, gems: 0,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    }, { merge: true });
    tx.set(doc(db, "ids", String(id)), { uid, email: email || null, numericId: id, createdAt: serverTimestamp() }, { merge: true });
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

// UI: header auth state + panel user block
const authChip = $("#authChip");
const panelUser = $("#panelUser");

function renderAuthChipData(data){
  const id = data?.numericId ?? "—";
  const balance = (data?.balance ?? 0);
  const gems = (data?.gems ?? 0);
  authChip.innerHTML = `
    <div class="id-badge" title="Sizning akkauntingiz ma'lumotlari">
      <span class="pill">
        <svg class="icon-12" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16v16H4z" opacity=".15"/><path d="M7 8h10v2H7zM7 12h6v2H7z"/></svg>
        <span class="lbl"><b>ID:</b></span> <span>${id}</span>
      </span>
      <span class="sep"></span>
      <span class="pill">
        <svg class="icon-12" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h18v10H3z" opacity=".15"/><path d="M4 9h16v2H4zM6 13h8v2H6z"/></svg>
        <span class="lbl">Balans:</span> <span>${balance.toLocaleString()}</span>
      </span>
      <span class="pill">
        <svg class="icon-12" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l4 7-4 13-4-13z" opacity=".15"/></svg>
        <span class="lbl">Olmos:</span> <span>${gems}</span>
      </span>
    </div>`;
}


function renderSignedOut() {
  if (window.__unsubUser) { try { window.__unsubUser(); } catch(_){} window.__unsubUser = null; }

  authChip.innerHTML = `<button id="openAuth" class="btn primary">Kirish / Ro‘yxatdan o‘tish</button>`;
  $("#openAuth").addEventListener("click", () => openModal(authModal));
  panelUser.innerHTML = `
    <div class="muted">Mehmon</div>
    <div style="display:grid; gap:8px; margin-top:8px">
      <button class="btn" id="panelOpenAuth">Kirish / Ro‘yxatdan o‘tish</button>
    </div>`;
  $("#panelOpenAuth").addEventListener("click", () => { closePanel(); openModal(authModal); });
}

async function renderSignedIn(user) {
  try {
    // live listen to users/{uid}
    if (window.__unsubUser) { try { window.__unsubUser(); } catch(_){} }
    const uref = doc(db, "users", user.uid);
    window.__unsubUser = onSnapshot(uref, (usnap) => {
      const data = usnap.exists() ? usnap.data() : {};
      renderAuthChipData(data);
      const id = data.numericId || "—";
      const balance = data.balance ?? 0;
      const gems = data.gems ?? 0;
      panelUser.innerHTML = `
        <div><b>ID:</b> ${id}</div>
        <div class="meta" style="color:var(--muted)">Balans: ${balance.toLocaleString()} so‘m • Olmos: ${gems}</div>
        <div style="display:grid; gap:8px; margin-top:10px">
          <a href="#profile" class="panel-link" data-panel-link>👤 Profil</a>
          <button class="btn" id="panelLogout">Chiqish</button>
        </div>`;
      const btn = $("#panelLogout"); if (btn) btn.onclick = async () => { await signOut(auth); closePanel(); };
    }, (err) => { console.error(err); });

  } catch (e) {
    console.error(e);
    renderSignedOut();
  }
};
    const id = data.numericId || "—";
    const balance = data.balance ?? 0;
    const gems = data.gems ?? 0;
    authChip.innerHTML = `
      <div class="id-badge" title="Sizning akkauntingiz ma'lumotlari">
        <span class="pill">
          <svg class="icon-12" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16v16H4z" opacity=".15"/><path d="M7 8h10v2H7zM7 12h6v2H7z"/></svg>
          <span class="lbl"><b>ID:</b></span> <span>${id}</span>
        </span>
        <span class="sep"></span>
        <span class="pill">
          <svg class="icon-12" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h18v10H3z" opacity=".15"/><path d="M4 9h16v2H4zM6 13h8v2H6z"/></svg>
          <span class="lbl">Balans:</span> <span>${balance.toLocaleString()}</span>
        </span>
        <span class="pill">
          <svg class="icon-12" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l4 7-4 13-4-13z" opacity=".15"/></svg>
          <span class="lbl">Olmos:</span> <span>${gems}</span>
        </span>
      </div>`;

    panelUser.innerHTML = `
      <div><b>ID:</b> ${id}</div>
      <div class="meta" style="color:var(--muted)">Balans: ${balance.toLocaleString()} so‘m • Olmos: ${gems}</div>
      <div style="display:grid; gap:8px; margin-top:10px">
        <a href="#profile" class="panel-link" data-panel-link>👤 Profil</a>
        <button class="btn" id="panelLogout">Chiqish</button>
      </div>`;
    $("#panelLogout").addEventListener("click", async () => { await signOut(auth); closePanel(); });
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
const __loginForm = $("#loginForm"); if(__loginForm) __loginForm.addEventListener("submit", async (e) => {
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
const __signupEmailForm = $("#signupEmailForm"); if(__signupEmailForm) __signupEmailForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = $("#seName").value.trim() || null;
  const email = $("#seEmail").value.trim();
  const pass = $("#sePass").value;
  const msg = $("#signupEmailMsg");
  msg.textContent = "Ro‘yxatdan o‘tkazilmoqda...";
  msg.className = "msg";

  try {
    const cred = await emailSignupOrLink(auth, email, pass);
    const uid = cred.user.uid;
    const numericId = await ensureUserNumericId(uid, email, name);
    await setDoc(doc(db, "ids", String(numericId)), { uid, email, numericId }, { merge: true });
    msg.textContent = `Tayyor! Sizning ID: ${numericId}. Endi kirishda faqat ID + parol ishlatiladi.`;
    msg.classList.add("ok");
    closeModal(authModal);
  } catch (err) {
    console.error(err);
    msg.textContent = "Ro‘yxatdan o‘tishda xatolik: " + niceAuthError(err);
    msg.classList.add("error");
  }
});

// ---------- Signup: Google (registration only) ----------
const googleBtn = $("#googleBtn");
const signupGoogleMsg = $("#signupGoogleMsg");
const googleSetPassForm = $("#googleSetPassForm");
const signupGoogleStepSetPass = $("#signupGoogleStepSetPass");

if(googleBtn) googleBtn.addEventListener("click", async () => {
  signupGoogleMsg.textContent = "Google orqali kirmoqda..."; signupGoogleMsg.className = "msg";
  try {
    const { user } = await googleSignupOrLink(auth, provider);
    const uid = user.uid;
    const email = user.email;
    await ensureUserNumericId(uid, email, user.displayName || null);
    signupGoogleStepSetPass.classList.remove("hidden");
    signupGoogleMsg.textContent = "Google bog‘landi. Endi parol belgilang.";
  } catch (err) {
    console.error(err);
    signupGoogleMsg.textContent = "Google ro‘yxatdan o‘tishda xatolik: " + niceAuthError(err);
    signupGoogleMsg.classList.add("error");
  }
});

if(googleSetPassForm) googleSetPassForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const pass = $("#sgPass").value;
  signupGoogleMsg.textContent = "Parol ulanmoqda..."; signupGoogleMsg.className = "msg";
  try {
    const user = auth.currentUser;
    if (!user || !user.email) throw new Error("Google foydalanuvchisi aniqlanmadi.");
    const cred = EmailAuthProvider.credential(user.email, pass);
    await linkWithCredential(user, cred);
    const usnap = await getDoc(doc(db, "users", user.uid));
    const numericId = usnap.exists() ? usnap.data().numericId : null;
    if (numericId) await setDoc(doc(db, "ids", String(numericId)), { uid: user.uid, email: user.email, numericId }, { merge: true });
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
const __oneClickForm = $("#oneClickForm"); if(__oneClickForm) __oneClickForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = $("#ocName").value.trim() || null;
  const pass = $("#ocPass").value;
  const msg = $("#oneClickMsg");
  msg.textContent = "Yaratilmoqda..."; msg.className = "msg";

  try {
    const anon = auth.currentUser && auth.currentUser.isAnonymous ? { user: auth.currentUser } : await signInAnonymously(auth);
    const uid = anon.user.uid;
    const numericId = await ensureUserNumericId(uid, null, name);
    const aliasEmail = `${numericId}@xplusy.local`;
    const cred = EmailAuthProvider.credential(aliasEmail, pass);
    await linkWithCredential(anon.user, cred);
    await setDoc(doc(db, "ids", String(numericId)), { uid, email: aliasEmail, numericId }, { merge: true });
    msg.textContent = `Tayyor! Sizning ID: ${numericId}. Endi kirishda ID (${numericId}) va parolingizdan foydalaning.`;
    msg.classList.add("ok");
    closeModal(authModal);
  } catch (err) {
    console.error(err);
    msg.textContent = "Xatolik: " + niceAuthError(err);
    msg.classList.add("error");
  }
});


// ===== THEME =====
(function(){
  const root = document.documentElement;
  const saved = localStorage.getItem("xpy_theme");
  const prefersLight = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches;
  root.setAttribute("data-theme", saved || (prefersLight ? "light" : "dark"));
  const btn = document.getElementById("themeToggle");
  const set = (mode) => { root.setAttribute("data-theme", mode); localStorage.setItem("xpy_theme", mode); };
  if (btn){
    btn.addEventListener("click", () => {
      const cur = root.getAttribute("data-theme") || "dark";
      set(cur === "dark" ? "light" : "dark");
    });
  }
})();



// ===== Helpers: error mapping =====
function niceAuthError(err){
  const c = err?.code || "";
  if (c === "auth/admin-restricted-operation") {
    return "Ro‘yxatdan o‘tish hozir admin tomonidan cheklangan yoki bu amaliyot bloklangan. Iltimos, boshqa usulni sinab ko‘ring yoki keyinroq urinib ko‘ring.";
  }
  if (c === "auth/operation-not-allowed") {
    return "Ushbu kirish usuli serverda o‘chirilgan. Sign-in method sozlamalarini tekshiring.";
  }
  if (c === "auth/popup-closed-by-user") return "Oyna yopildi.";
  if (c === "auth/email-already-in-use") return "Bu email allaqachon mavjud.";
  if (c === "auth/weak-password") return "Parol juda zaif (kamida 6 belgi).";
  return err?.message || String(err);
}

// Link Google to anonymous if possible
async function googleSignupOrLink(auth, provider){
  const u = auth.currentUser;
  if (u && u.isAnonymous) {
    return await linkWithPopup(u, provider);
  } else {
    return await signInWithPopup(auth, provider);
  }
} else {
    return await signInWithPopup(auth, provider);
  }
}

// Email signup that upgrades anonymous user if exists
async function emailSignupOrLink(auth, email, pass){
  const u = auth.currentUser;
  if (u && u.isAnonymous) {
    const cred = EmailAuthProvider.credential(email, pass);
    return await linkWithCredential(u, cred);
  } else {
    return await createUserWithEmailAndPassword(auth, email, pass);
  }
} else {
    return await createUserWithEmailAndPassword(auth, email, pass);
  }
}
