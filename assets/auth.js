import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, serverTimestamp, runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

const $ = (s, r=document) => r.querySelector(s);

function cfg(){
  const c = window.__FIREBASE_CONFIG__;
  if(!c || !c.apiKey) throw new Error("Firebase config topilmadi");
  return c;
}

function normPhone(v){
  v = String(v||"").trim();
  // keep digits
  const d = v.replace(/\D/g,"");
  if(!d) return "";
  // if starts with 998 already ok; if user typed 90..., add 998
  if(d.startsWith("998") && d.length===12) return "+"+d;
  if(d.length===9) return "+998"+d;
  if(d.length===12 && d.startsWith("998")) return "+"+d;
  // fallback: just prefix +
  return d.startsWith("998") ? "+"+d : "+998"+d.slice(-9);
}

function phoneToEmail(phone){
  const d = phone.replace(/\D/g,"");
  return `${d}@orzumall.local`;
}

function showErr(msg){
  const el = $("#errBox");
  el.textContent = msg;
  el.style.display = "block";
}

function clearErr(){ $("#errBox").style.display = "none"; $("#errBox").textContent=""; }

function omFromNumeric(n){
  const s = String(n).padStart(6,"0");
  return `OM${s}`;
}

const app = initializeApp(cfg());
const auth = getAuth(app);
const db = getFirestore(app);

/* Tabs */
$("#tabLogin").onclick = ()=>{
  $("#tabLogin").classList.add("active");
  $("#tabReg").classList.remove("active");
  $("#formLogin").style.display = "";
  $("#formReg").style.display = "none";
  clearErr();
};
$("#tabReg").onclick = ()=>{
  $("#tabReg").classList.add("active");
  $("#tabLogin").classList.remove("active");
  $("#formReg").style.display = "";
  $("#formLogin").style.display = "none";
  clearErr();
};

$("#forgot").onclick = (e)=>{
  e.preventDefault();
  // user asked earlier: redirect to telegram bot
  alert("Parol esdan chiqqan bo‘lsa, @OrzuMallUZ_bot ga murojaat qiling.");
  window.open("https://t.me/OrzuMallUZ_bot","_blank");
};

/* Auto format phone inputs */
for (const id of ["lPhone","rPhone"]){
  const inp = $("#"+id);
  inp.addEventListener("blur", ()=>{ inp.value = normPhone(inp.value); });
  inp.addEventListener("focus", ()=>{
    if(!inp.value) inp.value = "+998";
  });
}

/* Login */
$("#btnLogin").onclick = async ()=>{
  clearErr();
  const phone = normPhone($("#lPhone").value);
  const pass = $("#lPass").value || "";
  if(!pass || pass.length<6) return showErr("Parol kamida 6 ta belgidan iborat bo‘lsin.");
  if(!phone) return showErr("Telefon raqamni kiriting.");
  if(!pass2 || pass2.length<6) return showErr("Parol kamida 6 ta belgidan iborat bo‘lsin.");
  try{
    await signInWithEmailAndPassword(auth, phoneToEmail(phone), pass);
    window.location.href = "index.html";
  }catch(err){
    const code = err?.code || "";
    if(code.includes("auth/invalid-credential") || code.includes("auth/wrong-password")){
      showErr("Login yoki parol xato.");
    }else if(code.includes("auth/user-not-found")){
      showErr("Bu telefon ro‘yxatdan o‘tmagan.");
    }else{
      showErr("Xatolik: " + (err?.message || code));
    }
  }
};

/* Register */
$("#btnReg").onclick = async ()=>{
  clearErr();
  const name = ($("#rName").value||"").trim();
  const phone = normPhone($("#rPhone").value);
  const p1 = $("#rPass").value||"";
  const p2 = $("#rPass2").value||"";
  if(!name) return showErr("Ismni kiriting.");
  if(!phone) return showErr("Telefon raqamni kiriting.");
  if(p1.length<6) return showErr("Parol kamida 6 ta belgidan iborat bo‘lsin.");
  if(p1!==p2) return showErr("Parollar mos kelmadi.");

  try{
    const cred = await createUserWithEmailAndPassword(auth, phoneToEmail(phone), p1);
    const uid = cred.user.uid;
    // create user doc with OM counter transaction
    const uref = doc(db, "users", uid);
    const cref = doc(db, "meta", "counters");
    await runTransaction(db, async (tx)=>{
      const cs = await tx.get(cref);
      const prev = cs.exists() ? Number(cs.data().userCounter||0) : 0;
      const next = prev + 1;
      tx.set(cref, { userCounter: next }, { merge:true });
      tx.set(uref, {
        name,
        phone,
        numericId: next,
        omId: omFromNumeric(next),
        createdAt: serverTimestamp()
      }, { merge:true });
    });
    window.location.href = "index.html";
  }catch(err){
    const code = err?.code || "";
    if(code.includes("auth/email-already-in-use")){
      showErr("Bu telefon oldin ro‘yxatdan o‘tgan.");
    }else{
      showErr("Xatolik: " + (err?.message || code));
    }
  }
};

/* If already logged in, redirect */
onAuthStateChanged(auth, (u)=>{
  if(u) window.location.href = "index.html";
});
