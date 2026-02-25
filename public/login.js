import { auth, db } from "./firebase-config.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  fetchSignInMethodsForEmail,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import {
  doc,
  setDoc,
  serverTimestamp,
  runTransaction,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

let allowAutoRedirect = true;

const els = {
  tabLogin: document.getElementById("tabLogin"),
  tabSignup: document.getElementById("tabSignup"),
  loginForm: document.getElementById("loginForm"),
  signupForm: document.getElementById("signupForm"),

  loginPhone: document.getElementById("loginPhone"),
  loginPass: document.getElementById("loginPass"),
  toggleLoginPass: document.getElementById("toggleLoginPass"),

  signupName: document.getElementById("signupName"),
  signupPhone: document.getElementById("signupPhone"),
  signupPass: document.getElementById("signupPass"),
  signupPass2: document.getElementById("signupPass2"),
  toggleSignupPass: document.getElementById("toggleSignupPass"),

  notice: document.getElementById("notice"),
  forgotLink: document.getElementById("forgotLink"),

  loginBtn: document.getElementById("loginBtn"),
  signupBtn: document.getElementById("signupBtn"),
  loginPhoneStatus: document.getElementById("loginPhoneStatus"),
  signupPhoneStatus: document.getElementById("signupPhoneStatus"),
};

function setMiniStatus(el, msg, kind=""){
  if(!el) return;
  el.textContent = msg || "";
  el.className = "mini" + (kind ? " "+kind : "");
}

function withTimeout(promise, ms=12000){
  return Promise.race([
    promise,
    new Promise((_, rej)=> setTimeout(()=> rej(Object.assign(new Error("TIMEOUT"), { code: "timeout" })), ms))
  ]);
}

function mapAuthError(err){
  const code = String(err?.code || "");
  if(code.includes("timeout")) return "Internet sekin. Qayta urinib ko‘ring.";
  if(code.includes("auth/network-request-failed")) return "Internet bilan muammo. Qayta urinib ko‘ring.";
  if(code.includes("auth/too-many-requests")) return "Juda ko‘p urinish. Birozdan keyin qayta urinib ko‘ring.";
  if(code.includes("auth/user-not-found")) return "Bu telefon raqam ro‘yxatdan o‘tmagan.";
  if(code.includes("auth/wrong-password") || code.includes("auth/invalid-credential") || code.includes("auth/invalid-login-credentials")) return "Login yoki parol xato.";
  if(code.includes("auth/email-already-in-use")) return "Bu raqam allaqachon ro‘yxatdan o‘tgan.";
  if(code.includes("auth/weak-password")) return "Parol juda oddiy. Kamida 6 ta belgi bo‘lsin.";
  return "Kirishda xatolik yuz berdi. Qayta urinib ko‘ring.";
}

function showNotice(msg, kind="ok"){
  if(!els.notice) return;
  els.notice.className = "notice " + (kind==="err" ? "err" : "ok");
  els.notice.textContent = msg;
  els.notice.style.display = "";
  const ms = kind === "err" ? 6500 : 3500;
  clearTimeout(showNotice._t);
  showNotice._t = setTimeout(()=>{ els.notice.style.display="none"; }, ms);
}

// Uzbekistan phone helpers (+998XXXXXXXXX)
function normPhone(raw){
  // returns phone in +998XXXXXXXXX format if possible
  let digits = String(raw||"").replace(/\D/g,"");
  // strip country if user typed it
  if(digits.startsWith("998")) digits = digits.slice(3);
  // keep only 9 digits (operator+number)
  digits = digits.slice(0, 9);
  return "+998" + digits;
}
function isValidUzPhone(phone){
  return /^\+998\d{9}$/.test(String(phone||""));
}
function attachUzPhoneMask(input){
  if(!input) return;
  // default
  if(!input.value) input.value = "+998";

  input.addEventListener("focus", ()=>{
    if(!input.value) input.value = "+998";
    if(!String(input.value).startsWith("+998")) input.value = normPhone(input.value);
  });

  input.addEventListener("input", ()=>{
    const v = normPhone(input.value);
    input.value = v;
  });

  input.addEventListener("keydown", (e)=>{
    // prevent deleting the +998 prefix
    const start = input.selectionStart ?? 0;
    const end = input.selectionEnd ?? 0;
    if((e.key === "Backspace" || e.key === "Delete") && start <= 4 && end <= 4){
      e.preventDefault();
      input.setSelectionRange(4,4);
    }
  });
}
function phoneToEmail(phone){
  const digits = String(phone||"").replace(/[^0-9]/g,"");
  return `p${digits}@orzumall.phone`;
}


async function ensureUserDoc(uid, phone, name){
  const userRef = doc(db, "users", uid);

  // One transaction: assign numericId (once) + update profile fields + create fast lookup maps
  try{
    const assignedNumericId = await runTransaction(db, async (tx) => {
      const snap = await tx.get(userRef);
      const existing = snap.exists() ? (snap.data() || {}) : {};

      let numericId = Number(existing.numericId);
      const hasNumeric = Number.isFinite(numericId) && numericId > 0;

      if(!hasNumeric){
        const counterRef = doc(db, "meta", "counters");
        const cSnap = await tx.get(counterRef);

        let next = 1000;
        if (cSnap.exists()) {
          const d = cSnap.data() || {};
          if (Number.isFinite(Number(d.nextUserId))) next = Number(d.nextUserId);
          else if (Number.isFinite(Number(d.userIdCounter))) next = Number(d.userIdCounter); // legacy
        }

        numericId = next;
        tx.set(counterRef, { nextUserId: numericId + 1 }, { merge: true });
        tx.set(doc(db, "users_by_numeric", String(numericId)), { uid }, { merge: true });
      }

      const phoneSafe = phone || existing.phone || "";
      const nameSafe  = name  || existing.name  || "";

      tx.set(userRef, {
        phone: phoneSafe,
        name: nameSafe,
        numericId,
        updatedAt: serverTimestamp(),
        ...(snap.exists() ? {} : { createdAt: serverTimestamp() })
      }, { merge: true });

      if(phoneSafe && /^\+998\d{9}$/.test(phoneSafe)){
        tx.set(doc(db, "users_by_phone", phoneSafe), {
          uid,
          phone: phoneSafe,
          updatedAt: serverTimestamp(),
          ...(snap.exists() ? {} : { createdAt: serverTimestamp() })
        }, { merge: true });
      }

      return numericId;
    });

    return { numericId: assignedNumericId };
  }catch(err){
    // If rules block meta/users_by_numeric, don't block login.
    // We still ensure /users/{uid} exists with phone/name.
    console.warn("ensureUserDoc fallback", err);
    await setDoc(userRef, {
      phone: phone || "",
      name: name || "",
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    }, { merge: true });
    return { numericId: null };
  }
}

// ===== Fast pre-check (NO Firestore, uses Auth public method) =====
let _checkTok = 0;
let _checkTimer = null;
async function precheckPhone(rawPhone, mode){
  const phone = normPhone(rawPhone);
  const valid = isValidUzPhone(phone);
  const statusEl = mode === "signup" ? els.signupPhoneStatus : els.loginPhoneStatus;
  const btn = mode === "signup" ? els.signupBtn : els.loginBtn;

  if(!btn) return;

  if(!valid){
    setMiniStatus(statusEl, "Telefon formati: 90 123 45 67", "");
    btn.disabled = true;
    return;
  }

  // Debounce
  clearTimeout(_checkTimer);
  const tok = ++_checkTok;
  _checkTimer = setTimeout(async ()=>{
    if(tok !== _checkTok) return;
    setMiniStatus(statusEl, "Tekshirilmoqda...", "loading");
    btn.disabled = true;
    try{
      const email = phoneToEmail(phone);
      const methods = await withTimeout(fetchSignInMethodsForEmail(auth, email), 8000);
      const exists = Array.isArray(methods) && methods.length > 0;
      if(mode === "login"){
        if(exists){
          setMiniStatus(statusEl, "Bu raqam ro‘yxatdan o‘tgan. Kirishingiz mumkin.", "ok");
          btn.disabled = false;
        }else{
          setMiniStatus(statusEl, "Bu raqam ro‘yxatdan o‘tmagan. Ro‘yxatdan o‘ting.", "err");
          btn.disabled = true;
        }
      }else{
        // signup
        if(exists){
          setMiniStatus(statusEl, "Bu raqam allaqachon ro‘yxatdan o‘tgan. Kirish bo‘limidan kiring.", "err");
          btn.disabled = true;
        }else{
          setMiniStatus(statusEl, "Raqam bo‘sh. Ro‘yxatdan o‘tishingiz mumkin.", "ok");
          btn.disabled = false;
        }
      }
    }catch(err){
      console.warn("precheck error", err);
      setMiniStatus(statusEl, "Tekshiruvda xatolik. Internetni tekshiring.", "err");
      // allow action anyway (don't block user forever)
      btn.disabled = false;
    }
  }, 260);
}


// Tabs
function setMode(mode){
  const isLogin = mode==="login";
  els.tabLogin.classList.toggle("active", isLogin);
  els.tabSignup.classList.toggle("active", !isLogin);
  els.loginForm.style.display = isLogin ? "" : "none";
  els.signupForm.style.display = isLogin ? "none" : "";
}
els.tabLogin.addEventListener("click", ()=>setMode("login"));
els.tabSignup.addEventListener("click", ()=>setMode("signup"));
setMode("login");

// Phone auto +998 formatting
attachUzPhoneMask(els.loginPhone);
attachUzPhoneMask(els.signupPhone);

// Precheck while typing
if(els.loginPhone){
  els.loginBtn && (els.loginBtn.disabled = true);
  setMiniStatus(els.loginPhoneStatus, "Telefon kiriting (90 123 45 67)");
  els.loginPhone.addEventListener("input", ()=> precheckPhone(els.loginPhone.value, "login"));
  // initial
  precheckPhone(els.loginPhone.value, "login");
}
if(els.signupPhone){
  els.signupBtn && (els.signupBtn.disabled = true);
  setMiniStatus(els.signupPhoneStatus, "Telefon kiriting (90 123 45 67)");
  els.signupPhone.addEventListener("input", ()=> precheckPhone(els.signupPhone.value, "signup"));
  precheckPhone(els.signupPhone.value, "signup");
}

// Password toggles
els.toggleLoginPass.addEventListener("click", ()=>{
  const show = els.loginPass.type === "password";
  els.loginPass.type = show ? "text" : "password";
  els.toggleLoginPass.querySelector("i").className = show ? "fa-solid fa-eye-slash" : "fa-solid fa-eye";
});
els.toggleSignupPass.addEventListener("click", ()=>{
  const show = els.signupPass.type === "password";
  els.signupPass.type = show ? "text" : "password";
  els.toggleSignupPass.querySelector("i").className = show ? "fa-solid fa-eye-slash" : "fa-solid fa-eye";
});



// Forgot password -> Telegram bot
if(els.forgotLink){
  els.forgotLink.addEventListener("click", (e)=>{
    e.preventDefault();
    showNotice("Parolni tiklash uchun @OrzuMallUZ_bot ga yozing", "ok");
    setTimeout(()=> window.open("https://t.me/OrzuMallUZ_bot", "_blank"), 180);
  });
}

// If already logged in, go to profile
onAuthStateChanged(auth, (user)=>{
  if(user && allowAutoRedirect) {
    const next = new URLSearchParams(location.search).get("next") || "index.html#profile";
    location.replace(next);
  }
});

// Login
els.loginForm.addEventListener("submit", async (e)=>{
  e.preventDefault();
  allowAutoRedirect = false;
  const phone = normPhone(els.loginPhone.value);
  const pass = els.loginPass.value || "";
  if(!isValidUzPhone(phone)) return showNotice("Telefon raqam noto‘g‘ri. Masalan: +998901234567", "err");
  if(pass.length < 6) return showNotice("Parol kamida 6 ta belgidan iborat bo‘lsin", "err");

  const btn = els.loginBtn;
  const oldHtml = btn?.innerHTML;
  if(btn){ btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="margin-right:8px"></i> Kuting...'; }

  try{
    const email = phoneToEmail(phone);
    const cred = await withTimeout(signInWithEmailAndPassword(auth, email, pass), 12000);

    // ensure numericId exists + keep name if already known
    const uid = cred.user.uid;
    // Keep login fast: ensure doc, but don't let it hang forever
    await withTimeout(ensureUserDoc(uid, phone, ""), 8000);

    const next = new URLSearchParams(location.search).get("next") || "index.html#profile";
    location.replace(next);
  }catch(err){
    console.error(err);
    showNotice(mapAuthError(err), "err");
  }

  if(btn){ btn.disabled = false; btn.innerHTML = oldHtml || btn.innerHTML; }
});

// Signup
els.signupForm.addEventListener("submit", async (e)=>{
  e.preventDefault();
  allowAutoRedirect = false;
  const name = (els.signupName.value || "").trim();
  const phone = normPhone(els.signupPhone.value);
  const pass = els.signupPass.value || "";
  const pass2 = els.signupPass2.value || "";

  if(!name) return showNotice("Ismni kiriting", "err");
  if(!isValidUzPhone(phone)) return showNotice("Telefon raqam noto‘g‘ri. Masalan: +998901234567", "err");
  if(pass.length < 6) return showNotice("Parol kamida 6 ta belgidan iborat bo‘lsin", "err");
  if(pass !== pass2) return showNotice("Parollar mos emas", "err");

  const btn = els.signupBtn;
  const oldHtml = btn?.innerHTML;
  if(btn){ btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="margin-right:8px"></i> Kuting...'; }

  try{
    // fast pre-check again (avoid long wait and then email-already-in-use)
    const emailPre = phoneToEmail(phone);
    const methods = await withTimeout(fetchSignInMethodsForEmail(auth, emailPre), 8000);
    if(Array.isArray(methods) && methods.length > 0){
      showNotice("Bu raqam allaqachon ro‘yxatdan o‘tgan. Kirish bo‘limidan parol bilan kiring.", "err");
      try{ els.tabLogin?.click(); els.loginPhone.value = phone; els.loginPass?.focus(); }catch(_){ }
      if(btn){ btn.disabled = false; btn.innerHTML = oldHtml || btn.innerHTML; }
      return;
    }

    const email = phoneToEmail(phone);
    const cred = await withTimeout(createUserWithEmailAndPassword(auth, email, pass), 12000);

    const uid = cred.user.uid;
    const { numericId } = await withTimeout(ensureUserDoc(uid, phone, name), 8000);

    showNotice(`Tayyor! Sizning ID: ${numericId}`, "ok");

    const next = new URLSearchParams(location.search).get("next") || "index.html#profile";
    setTimeout(()=> location.replace(next), 350);
  }catch(err){
    console.error(err);
    showNotice(mapAuthError(err), "err");
  }

  if(btn){ btn.disabled = false; btn.innerHTML = oldHtml || btn.innerHTML; }
});
