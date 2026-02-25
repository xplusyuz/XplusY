import { auth } from "./firebase-config.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";

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
  busy: document.getElementById("auth-loading"),
};

function setBusy(v){
  if(!els.busy) return;
  els.busy.style.display = v ? "flex" : "none";
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
  let digits = String(raw||"").replace(/\D/g,"");
  if(digits.startsWith("998")) digits = digits.slice(3);
  digits = digits.slice(0, 9);
  return "+998" + digits;
}
function isValidUzPhone(phone){
  return /^\+998\d{9}$/.test(String(phone||""));
}
function attachUzPhoneMask(input){
  if(!input) return;
  if(!input.value) input.value = "+998";

  input.addEventListener("focus", ()=>{
    if(!input.value) input.value = "+998";
    if(!String(input.value).startsWith("+998")) input.value = normPhone(input.value);
  });

  input.addEventListener("input", ()=>{
    input.value = normPhone(input.value);
  });

  input.addEventListener("keydown", (e)=>{
    const start = input.selectionStart ?? 0;
    const end = input.selectionEnd ?? 0;
    if ((e.key === "Backspace" || e.key === "Delete") && start <= 4 && end <= 4) {
      e.preventDefault();
      input.setSelectionRange(4,4);
    }
  });
}

function phoneToEmail(phone){
  const digits = String(phone||"").replace(/[^0-9]/g,"");
  return `p${digits}@orzumall.phone`;
}

async function ensureUserLazy({ uid, phone, name }){
  // Firestore heavy module is loaded ONLY after auth success
  const mod = await import("./ensure-user.js");
  return mod.ensureUserDocFast({ uid, phone, name });
}

// Tabs
function setMode(mode){
  const isLogin = mode==="login";
  if(els.tabLogin) els.tabLogin.classList.toggle("active", isLogin);
  if(els.tabSignup) els.tabSignup.classList.toggle("active", !isLogin);
  if(els.loginForm) els.loginForm.style.display = isLogin ? "" : "none";
  if(els.signupForm) els.signupForm.style.display = isLogin ? "none" : "";
}
if(els.tabLogin) els.tabLogin.addEventListener("click", ()=>setMode("login"));
if(els.tabSignup) els.tabSignup.addEventListener("click", ()=>setMode("signup"));
setMode("login");

// Phone mask
attachUzPhoneMask(els.loginPhone);
attachUzPhoneMask(els.signupPhone);

// Password toggles
if(els.toggleLoginPass && els.loginPass){
  els.toggleLoginPass.addEventListener("click", ()=>{
    const show = els.loginPass.type === "password";
    els.loginPass.type = show ? "text" : "password";
    const icon = els.toggleLoginPass.querySelector("i");
    if(icon) icon.className = show ? "fa-solid fa-eye-slash" : "fa-solid fa-eye";
  });
}
if(els.toggleSignupPass && els.signupPass){
  els.toggleSignupPass.addEventListener("click", ()=>{
    const show = els.signupPass.type === "password";
    els.signupPass.type = show ? "text" : "password";
    const icon = els.toggleSignupPass.querySelector("i");
    if(icon) icon.className = show ? "fa-solid fa-eye-slash" : "fa-solid fa-eye";
  });
}

// Forgot password -> Telegram bot
if(els.forgotLink){
  els.forgotLink.addEventListener("click", (e)=>{
    e.preventDefault();
    showNotice("Parolni tiklash uchun @OrzuMallUZ_bot ga yozing", "ok");
  });
}

// Auto-redirect if already logged in
onAuthStateChanged(auth, (user)=>{
  if(user && allowAutoRedirect){
    location.replace("./index.html");
  }
});

// Login submit
if(els.loginForm){
  els.loginForm.addEventListener("submit", async (e)=>{
    e.preventDefault();
    allowAutoRedirect = false;
    setBusy(true);
    try{
      const phone = normPhone(els.loginPhone?.value || "");
      const pass = String(els.loginPass?.value || "");
      if(!isValidUzPhone(phone)) throw new Error("Telefon raqam noto‘g‘ri. Masalan: +998901234567");
      if(pass.length < 4) throw new Error("Parol juda qisqa");

      const email = phoneToEmail(phone);
      const cred = await signInWithEmailAndPassword(auth, email, pass);

      await ensureUserLazy({ uid: cred.user.uid, phone, name: "" });

      showNotice("Kirish muvaffaqiyatli! Yo‘naltirilmoqda...", "ok");
      location.replace("./index.html");
    }catch(err){
      console.error(err);
      showNotice(err?.message || "Kirishda xato", "err");
      allowAutoRedirect = true;
    }finally{
      setBusy(false);
    }
  });
}

// Signup submit
if(els.signupForm){
  els.signupForm.addEventListener("submit", async (e)=>{
    e.preventDefault();
    allowAutoRedirect = false;
    setBusy(true);
    try{
      const name = String(els.signupName?.value || "").trim();
      const phone = normPhone(els.signupPhone?.value || "");
      const pass = String(els.signupPass?.value || "");
      const pass2 = String(els.signupPass2?.value || "");

      if(name.length < 2) throw new Error("Ism/Familiya juda qisqa");
      if(!isValidUzPhone(phone)) throw new Error("Telefon raqam noto‘g‘ri. Masalan: +998901234567");
      if(pass.length < 4) throw new Error("Parol juda qisqa");
      if(pass !== pass2) throw new Error("Parollar mos emas");

      const email = phoneToEmail(phone);
      const cred = await createUserWithEmailAndPassword(auth, email, pass);

      await ensureUserLazy({ uid: cred.user.uid, phone, name });

      showNotice("Ro‘yxatdan o‘tildi! Yo‘naltirilmoqda...", "ok");
      location.replace("./index.html");
    }catch(err){
      console.error(err);
      showNotice(err?.message || "Ro‘yxatdan o‘tishda xato", "err");
      allowAutoRedirect = true;
    }finally{
      setBusy(false);
    }
  });
}
