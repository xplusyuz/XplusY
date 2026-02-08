import { auth, db } from "./firebase-config.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc,
  runTransaction,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

const els = {
  tabLogin: document.getElementById("tabLogin"),
  tabSignup: document.getElementById("tabSignup"),
  loginForm: document.getElementById("loginForm"),
  signupForm: document.getElementById("signupForm"),
  loginPhone: document.getElementById("loginPhone"),
  loginPass: document.getElementById("loginPass"),
  signupName: document.getElementById("signupName"),
  signupPhone: document.getElementById("signupPhone"),
  signupPass: document.getElementById("signupPass"),
  signupPass2: document.getElementById("signupPass2"),
  authNotice: document.getElementById("authNotice"),
  authNotice2: document.getElementById("authNotice2"),
};

function getNextUrl(){
  const u = new URL(location.href);
  const next = u.searchParams.get("next");
  // only allow same-origin relative paths
  if(!next) return "/";
  if(next.startsWith("/") && !next.startsWith("//")) return next;
  return "/";
}

function normPhone(raw){
  const s = String(raw||"").trim().replace(/[\s\-\(\)]/g,"");
  if(!s) return "";
  let p = s;
  if(p.startsWith("00")) p = "+" + p.slice(2);
  if(!p.startsWith("+")) p = "+" + p;
  p = "+" + p.replace(/[^0-9]/g,"");
  if(!/^\+\d{7,15}$/.test(p)) return "";
  return p;
}
function phoneToEmail(phone){
  const digits = String(phone||"").replace(/[^0-9]/g,"");
  return `p${digits}@orzumall.phone`;
}

function showNotice(el, msg, kind="info"){
  if(!el) return;
  el.style.display = "";
  el.textContent = String(msg||"");
  el.classList.remove("isError","isOk");
  if(kind==="error") el.classList.add("isError");
  if(kind==="ok") el.classList.add("isOk");
}
function clearNotices(){
  if(els.authNotice){ els.authNotice.style.display="none"; els.authNotice.textContent=""; els.authNotice.classList.remove("isError","isOk"); }
  if(els.authNotice2){ els.authNotice2.style.display="none"; els.authNotice2.textContent=""; els.authNotice2.classList.remove("isError","isOk"); }
}

function setTab(tab){
  const isLogin = tab === "login";
  els.tabLogin?.classList.toggle("isActive", isLogin);
  els.tabSignup?.classList.toggle("isActive", !isLogin);
  els.tabLogin?.setAttribute("aria-selected", isLogin ? "true":"false");
  els.tabSignup?.setAttribute("aria-selected", !isLogin ? "true":"false");
  if(els.loginForm) els.loginForm.style.display = isLogin ? "" : "none";
  if(els.signupForm) els.signupForm.style.display = !isLogin ? "" : "none";
  clearNotices();
}

function wireEyeButtons(){
  document.querySelectorAll("[data-eye]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const id = btn.getAttribute("data-eye");
      const inp = document.getElementById(id);
      if(!inp) return;
      inp.type = (inp.type === "password") ? "text" : "password";
    });
  });
}

async function ensureUserDoc(uid, data){
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if(snap.exists()) return;
  await setDoc(ref, {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

async function assignNumericId(uid){
  const counterRef = doc(db, "meta", "counters");
  const newId = await runTransaction(db, async (tx)=>{
    const snap = await tx.get(counterRef);
    let cur = 0;
    if(snap.exists()){
      cur = Number(snap.data().userCounter || 0);
    } else {
      tx.set(counterRef, { userCounter: 0 }, { merge: true });
      cur = 0;
    }
    const next = cur + 1;
    tx.set(counterRef, { userCounter: next }, { merge: true });
    const userRef = doc(db, "users", uid);
    tx.set(userRef, { numericId: next, updatedAt: serverTimestamp() }, { merge: true });
    return next;
  });
  return newId;
}

els.tabLogin?.addEventListener("click", ()=> setTab("login"));
els.tabSignup?.addEventListener("click", ()=> setTab("signup"));
wireEyeButtons();

// If already logged in, go to app immediately
onAuthStateChanged(auth, (user)=>{
  if(user){
    location.replace(getNextUrl());
  }
});

els.loginForm?.addEventListener("submit", async (e)=>{
  e.preventDefault();
  clearNotices();

  const phone = normPhone(els.loginPhone?.value);
  const pass = String(els.loginPass?.value || "");

  if(!phone) return showNotice(els.authNotice, "Telefon raqam noto‘g‘ri. Masalan: +998901234567", "error");
  if(pass.length < 6) return showNotice(els.authNotice, "Parol kamida 6 ta belgi bo‘lsin.", "error");

  const email = phoneToEmail(phone);

  try{
    await signInWithEmailAndPassword(auth, email, pass);
    showNotice(els.authNotice, "Kirish muvaffaqiyatli ✅", "ok");
    setTimeout(()=> location.replace(getNextUrl()), 300);
  }catch(err){
    const code = err?.code || "";
    let msg = "Kirishda xatolik. Qayta urinib ko‘ring.";
    if(code.includes("invalid-credential") || code.includes("wrong-password")) msg = "Telefon yoki parol noto‘g‘ri.";
    if(code.includes("user-not-found")) msg = "Bunday foydalanuvchi topilmadi. Ro‘yxatdan o‘ting.";
    if(code.includes("too-many-requests")) msg = "Ko‘p urinish. Birozdan so‘ng qayta urinib ko‘ring.";
    showNotice(els.authNotice, msg, "error");
  }
});

els.signupForm?.addEventListener("submit", async (e)=>{
  e.preventDefault();
  clearNotices();

  const name = String(els.signupName?.value || "").trim();
  const phone = normPhone(els.signupPhone?.value);
  const pass1 = String(els.signupPass?.value || "");
  const pass2 = String(els.signupPass2?.value || "");

  if(!name) return showNotice(els.authNotice2, "Ismingizni kiriting.", "error");
  if(!phone) return showNotice(els.authNotice2, "Telefon raqam noto‘g‘ri. Masalan: +998901234567", "error");
  if(pass1.length < 6) return showNotice(els.authNotice2, "Parol kamida 6 ta belgi bo‘lsin.", "error");
  if(pass1 !== pass2) return showNotice(els.authNotice2, "Parollar mos emas.", "error");

  const email = phoneToEmail(phone);

  try{
    const cred = await createUserWithEmailAndPassword(auth, email, pass1);
    const uid = cred.user.uid;

    await ensureUserDoc(uid, {
      name,
      phone,
      email,
    });

    const numericId = await assignNumericId(uid);
    showNotice(els.authNotice2, `Ro‘yxatdan o‘tildi ✅ Sizning ID: ${numericId}`, "ok");

    setTimeout(()=> location.replace(getNextUrl()), 650);
  }catch(err){
    const code = err?.code || "";
    let msg = "Ro‘yxatdan o‘tishda xatolik. Qayta urinib ko‘ring.";
    if(code.includes("email-already-in-use")) msg = "Bu telefon raqam bilan foydalanuvchi mavjud. Kirish qiling.";
    if(code.includes("weak-password")) msg = "Parol juda oddiy. Kamida 6 ta belgi kiriting.";
    showNotice(els.authNotice2, msg, "error");
  }
});
