import { db } from "./firebase-config.js";
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

const OM_SESSION_KEY = "orzuMallSession_v1";

function qs(name){
  const u = new URL(location.href);
  return u.searchParams.get(name);
}

function saveSession(s){
  try{ localStorage.setItem(OM_SESSION_KEY, JSON.stringify(s||null)); }catch(_){}
}
function randId(){
  const a = crypto.getRandomValues(new Uint32Array(5));
  return "om_" + Array.from(a).map(x=>x.toString(36)).join("").slice(0,20);
}
async function sha256(text){
  const enc = new TextEncoder().encode(String(text||""));
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,"0")).join("");
}

function toast(msg){
  const el = document.getElementById("notice");
  if(el){ el.textContent = msg; el.style.display = msg ? "block":"none"; }
}

async function register({name, phone, pass}){
  const uid = randId();
  const passHash = await sha256(pass);
  await setDoc(doc(db,"users",uid), {
    uid,
    name: String(name||"").trim().slice(0,80),
    phone: String(phone||"").replace(/[^0-9+]/g,"").slice(0,32),
    passHash,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    balanceUZS: 0,
    lastActionAt: serverTimestamp(),
    lastAction: "register"
  });
  const session = { uid, name, phone, passHash, createdAt: Date.now() };
  saveSession(session);
  return session;
}

async function login({uid, pass}){
  const cleanUid = String(uid||"").trim();
  const snap = await getDoc(doc(db,"users",cleanUid));
  if(!snap.exists()) throw new Error("not_found");
  const d = snap.data();
  const passHash = await sha256(pass);
  if(String(d.passHash||"") !== passHash) throw new Error("bad_pass");
  const session = { uid: cleanUid, name: d.name || "Foydalanuvchi", phone: d.phone || "", passHash, createdAt: Date.now() };
  saveSession(session);
  try{
    await setDoc(doc(db,"users",cleanUid), { updatedAt: serverTimestamp(), lastActionAt: serverTimestamp(), lastAction:"login" }, { merge:true });
  }catch(_){}
  return session;
}

document.addEventListener("DOMContentLoaded", ()=>{
  // Patch labels to ID-based login (keep layout)
  const loginLabel = document.querySelector('label');
  if(loginLabel) loginLabel.textContent = "ID";
  const loginPhone = document.getElementById("loginPhone");
  if(loginPhone){
    loginPhone.placeholder = "Masalan: om_...";
    loginPhone.autocomplete = "username";
    loginPhone.inputMode = "text";
  }

  const loginForm = document.getElementById("loginForm");
  const signupForm = document.getElementById("signupForm");

  loginForm?.addEventListener("submit", async (e)=>{
    e.preventDefault();
    toast("");
    try{
      const uid = document.getElementById("loginPhone")?.value || "";
      const pass = document.getElementById("loginPass")?.value || "";
      const s = await login({uid, pass});
      toast("Kirish muvaffaqiyatli.");
      const next = qs("next") || "/index.html";
      setTimeout(()=>location.replace(next), 350);
    }catch(err){
      if(String(err.message)==="not_found") toast("Foydalanuvchi topilmadi.");
      else if(String(err.message)==="bad_pass") toast("Parol noto‘g‘ri.");
      else toast("Xatolik. Qayta urinib ko‘ring.");
    }
  });

  signupForm?.addEventListener("submit", async (e)=>{
    e.preventDefault();
    toast("");
    try{
      const name = document.getElementById("signupName")?.value || "";
      const phone = document.getElementById("signupPhone")?.value || "";
      const pass = document.getElementById("signupPass")?.value || "";
      const pass2 = document.getElementById("signupPass2")?.value || "";
      if(String(name).trim().length < 2) return toast("Ism kiriting.");
      if(String(pass).length < 4) return toast("Parol kamida 4 ta belgidan iborat bo‘lsin.");
      if(String(pass) !== String(pass2)) return toast("Parollar mos emas.");
      const s = await register({name, phone, pass});
      toast("Ro‘yxatdan o‘tildi. ID: " + s.uid);
      const next = qs("next") || "/index.html";
      setTimeout(()=>location.replace(next), 800);
    }catch(_){
      toast("Xatolik. Qayta urinib ko‘ring.");
    }
  });
});
