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
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

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
};

function showNotice(msg, kind="ok"){
  if(!els.notice) return;
  els.notice.className = "notice " + (kind==="err" ? "err" : "ok");
  els.notice.textContent = msg;
  els.notice.style.display = "";
  setTimeout(()=>{ els.notice.style.display="none"; }, 2500);
}
function normPhone(raw){
  let p = (raw||"").trim();
  // keep + and digits
  p = p.replace(/[^0-9+]/g,"");
  if(!p.startsWith("+")) p = "+" + p.replace(/^\+*/,"");
  return p;
}
function phoneToEmail(phone){
  const digits = String(phone||"").replace(/[^0-9]/g,"");
  return `p${digits}@orzumall.phone`;
}


function uidToOmId(uid){
  // deterministic 6-digit numeric id derived from uid
  let h = 0;
  const s = String(uid||"");
  for(let i=0;i<s.length;i++){
    h = (h * 31 + s.charCodeAt(i)) % 1000000;
  }
  return "OM" + String(h).padStart(6,"0");
}

async function ensureUserDoc(uid, phone, name){
  const userRef = doc(db, "users", uid);
  const snap = await getDoc(userRef);
  const existing = snap.exists() ? (snap.data()||{}) : {};
  const omId = existing.omId || uidToOmId(uid);

  await setDoc(userRef, {
    phone: phone || existing.phone || "",
    name: name || existing.name || "",
    omId,
    updatedAt: serverTimestamp(),
    ...(snap.exists() ? {} : { createdAt: serverTimestamp() })
  }, { merge:true });

  return { omId, name: (name || existing.name || "User"), phone: (phone || existing.phone || "") };
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

// If already logged in, go to profile
onAuthStateChanged(auth, (user)=>{
  if(user) {
    const next = new URLSearchParams(location.search).get("next") || "index.html#profile";
    location.replace(next);
  }
});

// Login
els.loginForm.addEventListener("submit", async (e)=>{
  e.preventDefault();
  const phone = normPhone(els.loginPhone.value);
  const pass = els.loginPass.value || "";
  if(phone.length < 10) return showNotice("Telefon raqam noto‘g‘ri", "err");
  if(pass.length < 6) return showNotice("Parol kamida 6 ta belgidan iborat bo‘lsin", "err");

  try{
    const email = phoneToEmail(phone);
    const cred = await signInWithEmailAndPassword(auth, email, pass);

    // ensure omId exists + keep name if already known
    const uid = cred.user.uid;
    await ensureUserDoc(uid, phone, "");

    const next = new URLSearchParams(location.search).get("next") || "index.html#profile";
    location.replace(next);
  }catch(err){
    console.error(err);
    showNotice("Kirish xatosi: raqam yoki parol noto‘g‘ri", "err");
  }
});

// Signup
els.signupForm.addEventListener("submit", async (e)=>{
  e.preventDefault();
  const name = (els.signupName.value || "").trim();
  const phone = normPhone(els.signupPhone.value);
  const pass = els.signupPass.value || "";
  const pass2 = els.signupPass2.value || "";

  if(!name) return showNotice("Ismni kiriting", "err");
  if(phone.length < 10) return showNotice("Telefon raqam noto‘g‘ri", "err");
  if(pass.length < 6) return showNotice("Parol kamida 6 ta belgidan iborat bo‘lsin", "err");
  if(pass !== pass2) return showNotice("Parollar mos emas", "err");

  try{
    const email = phoneToEmail(phone);
    const cred = await createUserWithEmailAndPassword(auth, email, pass);

    const uid = cred.user.uid;
    const { omId } = await ensureUserDoc(uid, phone, name);

    showNotice(`Tayyor! Sizning ID: ${omId}`, "ok");

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
