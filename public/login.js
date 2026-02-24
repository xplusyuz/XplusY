import { auth, db } from "./firebase-config.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import {
  doc,
  getDoc,
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
};

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

  // Ensure numericId (1000+) is assigned exactly once via a counter doc (meta/counters)
  const assignedNumericId = await runTransaction(db, async (tx) => {
    const snap = await tx.get(userRef);
    const existing = snap.exists() ? (snap.data() || {}) : {};
    if (existing.numericId && Number.isFinite(Number(existing.numericId))) {
      // still update name/phone below outside tx
      return Number(existing.numericId);
    }

    const counterRef = doc(db, "meta", "counters");
    const cSnap = await tx.get(counterRef);

    let next = 1000;
    if (cSnap.exists()) {
      const d = cSnap.data() || {};
      if (Number.isFinite(Number(d.nextUserId))) next = Number(d.nextUserId);
      else if (Number.isFinite(Number(d.userIdCounter))) next = Number(d.userIdCounter); // legacy
    }

    const numericId = next;

    // advance counter
    tx.set(counterRef, { nextUserId: numericId + 1 }, { merge: true });

    // set user numericId
    tx.set(userRef, {
      numericId,
      updatedAt: serverTimestamp(),
      ...(snap.exists() ? {} : { createdAt: serverTimestamp() })
    }, { merge: true });

    // mapping for server-side lookup: users_by_numeric/{numericId} -> { uid }
    const mapRef = doc(db, "users_by_numeric", String(numericId));
    tx.set(mapRef, { uid }, { merge: true });

    return numericId;
  });

  // Update profile fields (not sensitive)
  const snap2 = await getDoc(userRef);
  const existing2 = snap2.exists() ? (snap2.data()||{}) : {};

  await setDoc(userRef, {
    phone: phone || existing2.phone || "",
    name: name || existing2.name || "",
    numericId: assignedNumericId,
    updatedAt: serverTimestamp(),
    ...(snap2.exists() ? {} : { createdAt: serverTimestamp() })
  }, { merge:true });

  return {
    numericId: assignedNumericId,
    name: (name || existing2.name || "User"),
    phone: (phone || existing2.phone || "")
  };
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

// Phone auto-format (+998)
attachUzPhoneMask(els.loginPhone);
attachUzPhoneMask(els.signupPhone);

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

  try{
    const email = phoneToEmail(phone);
    const cred = await signInWithEmailAndPassword(auth, email, pass);

    // ensure numericId exists + keep name if already known
    const uid = cred.user.uid;
    await ensureUserDoc(uid, phone, "");

    const next = new URLSearchParams(location.search).get("next") || "index.html#profile";
    location.replace(next);
  }catch(err){
    console.error(err);
    const code = String(err?.code || "");
    if(code.includes("user-not-found")){
      showNotice("Bu telefon raqam ro'yxatdan o'tmagan", "err");
    }else if(code.includes("wrong-password") || code.includes("invalid-credential") || code.includes("invalid-login-credentials")){
      showNotice("Login yoki parol xato", "err");
    }else if(code.includes("too-many-requests")){
      showNotice("Juda ko‘p urinish. Birozdan keyin qayta urinib ko‘ring.", "err");
    }else{
      // fallback
      showNotice("Kirishda xatolik yuz berdi. Qayta urinib ko‘ring.", "err");
    }
  }
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

  try{
    const email = phoneToEmail(phone);
    const cred = await createUserWithEmailAndPassword(auth, email, pass);

    const uid = cred.user.uid;
    const { numericId } = await ensureUserDoc(uid, phone, name);

    showNotice(`Tayyor! Sizning ID: ${numericId}`, "ok");

    const next = new URLSearchParams(location.search).get("next") || "index.html#profile";
    setTimeout(()=> location.replace(next), 350);
  }catch(err){
    console.error(err);
    // common: email already in use
    if(String(err?.code||"").includes("email-already-in-use")){
      showNotice("Bu raqam allaqachon ro‘yxatdan o‘tgan. Kirish bo‘limidan parol bilan kiring.", "err");
      // auto switch to login tab
      try{
        els.tabLogin?.click();
        if(els.loginPhone) els.loginPhone.value = phone;
        els.loginPass?.focus();
      }catch(_){}
    }else{
      if(String(err?.code||"").includes("weak-password")){
      showNotice("Parol juda oddiy. Kamida 6 ta belgi bo‘lsin.", "err");
    }else if(String(err?.code||"").includes("invalid-email")){
      showNotice("Telefon raqam formati noto‘g‘ri.", "err");
    }else{
      showNotice("Ro‘yxatdan o‘tishda xatolik", "err");
    }
    }
  }
});
