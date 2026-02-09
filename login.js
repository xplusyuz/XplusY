import { db } from "./firebase.js";
import {
  doc, getDoc, setDoc, serverTimestamp, runTransaction
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

const state = { mode: "login" };

function toast(msg){
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(()=>t.classList.remove("show"), 1800);
}

function setMode(m){
  state.mode = m;
  $("#tabLogin").classList.toggle("active", m==="login");
  $("#tabReg").classList.toggle("active", m==="reg");
  $("#regFields").style.display = (m==="reg") ? "block" : "none";
  $("#loginBtnText").textContent = (m==="reg") ? "Ro‘yxatdan o‘tish" : "Kirish";
}

$("#tabLogin").addEventListener("click", ()=>setMode("login"));
$("#tabReg").addEventListener("click", ()=>setMode("reg"));

$("#togglePass").addEventListener("click", ()=>{
  const i = $("#pass");
  const show = i.type === "password";
  i.type = show ? "text" : "password";
  $("#togglePass i").className = show ? "fas fa-eye-slash" : "fas fa-eye";
});

async function sha256(text){
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,"0")).join("");
}

function normPhone(raw){
  let p = (raw||"").replace(/[^\d+]/g,"").trim();
  if(!p.startsWith("+")) p = "+" + p.replace(/^\+*/,"");
  // basic: require +998 and 12 digits after +
  return p;
}

async function getNextNumericId(){
  const counterRef = doc(db, "meta", "counters");
  const res = await runTransaction(db, async (tx)=>{
    const snap = await tx.get(counterRef);
    const data = snap.exists() ? snap.data() : {};
    const cur = Number(data.users || 100000);
    const next = cur + 1;
    tx.set(counterRef, { users: next }, { merge:true });
    return next;
  });
  return res;
}

$("#form").addEventListener("submit", async (e)=>{
  e.preventDefault();
  const phone = normPhone($("#phone").value);
  const pass = $("#pass").value || "";
  const name = ($("#name").value || "").trim();
  const pass2 = $("#pass2").value || "";

  if(!phone || phone.length < 10) return toast("Telefon raqamni to‘g‘ri kiriting");
  if(pass.length < 4) return toast("Parol kamida 4 ta belgidan iborat bo‘lsin");

  try{
    const userRef = doc(db, "users", phone);
    const snap = await getDoc(userRef);

    if(state.mode === "login"){
      if(!snap.exists()) return toast("Bunday raqam topilmadi. Ro‘yxatdan o‘ting.");
      const u = snap.data();
      const hash = await sha256(pass);
      if(u.passHash !== hash) return toast("Parol noto‘g‘ri");
      localStorage.setItem("om_user", JSON.stringify({ phone, name:u.name||"", numericId:u.numericId||null }));
      const next = new URLSearchParams(location.search).get("next") || "index.html";
      location.href = next;
    }else{
      if(!name) return toast("Ismni kiriting");
      if(pass !== pass2) return toast("Parollar mos emas");
      if(snap.exists()) return toast("Bu raqam allaqachon ro‘yxatdan o‘tgan");
      const numericId = await getNextNumericId();
      const passHash = await sha256(pass);
      await setDoc(userRef, { phone, name, numericId, passHash, createdAt: serverTimestamp() });
      localStorage.setItem("om_user", JSON.stringify({ phone, name, numericId }));
      toast("Ro‘yxatdan o‘tildi");
      const next = new URLSearchParams(location.search).get("next") || "index.html";
      setTimeout(()=> location.href = next, 350);
    }
  }catch(err){
    console.error(err);
    toast("Xatolik. Firebase config / rules ni tekshiring");
  }
});

setMode("login");
