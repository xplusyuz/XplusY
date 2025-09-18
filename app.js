// Firebase v10 modular
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signOut, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup,
  linkWithCredential, linkWithPopup, EmailAuthProvider, signInAnonymously,
  RecaptchaVerifier, signInWithPhoneNumber
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, serverTimestamp, runTransaction, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";

// helpers
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const y=$("#year"); if(y) y.textContent=String(new Date().getFullYear());

// Router (fallback tpl)
const app=$("#app"); const routes=["home","tests","live","leaderboard","about"];
async function loadRoute(){
  const hash=location.hash.replace("#","")||"home";
  const route=routes.includes(hash)?hash:"home";
  const tpl=$("#tpl-"+route);
  if(tpl){ app.innerHTML=tpl.innerHTML; return; }
  try{
    const res=await fetch(`./partials/${route}.html`,{cache:"no-store"});
    if(!res.ok) throw 0; app.innerHTML=await res.text();
  }catch{
    app.innerHTML=`<div class="card" style="padding:16px; border:1px solid rgba(255,255,255,.06); border-radius:14px; background:var(--card); box-shadow: var(--shadow);"><h2 style="margin-top:0">${route}</h2><p class="muted">Partial (partials/${route}.html) topilmadi.</p></div>`;
  }
}
addEventListener("hashchange", loadRoute); loadRoute();

// Side panel (interaction only)
const sidePanel=$("#sidePanel"), menuBtn=$("#menuBtn");
function openPanel(){ sidePanel.setAttribute("aria-hidden","false"); if(menuBtn) menuBtn.setAttribute("aria-expanded","true"); document.body.style.overflow="hidden"; const card=$(".panel-card",sidePanel); if(card) card.focus(); }
function closePanel(){ sidePanel.setAttribute("aria-hidden","true"); if(menuBtn) menuBtn.setAttribute("aria-expanded","false"); document.body.style.overflow=""; }
if(menuBtn) menuBtn.addEventListener("click", ()=>{ const hid=sidePanel.getAttribute("aria-hidden")!=="false"; hid?openPanel():closePanel(); });
$$("[data-close-panel]", sidePanel).forEach(el=>el.addEventListener("click", closePanel));
addEventListener("keydown", e=>{ if(e.key==="Escape") closePanel(); });
const panelOpenAuth=$("#panelOpenAuth"); if(panelOpenAuth) panelOpenAuth.addEventListener("click", ()=>{ closePanel(); openModal($("#authModal")); });

// Modal + tabs (interaction only)
function openModal(m){ m.setAttribute("aria-hidden","false"); document.body.style.overflow="hidden"; }
function closeModal(m){ m.setAttribute("aria-hidden","true"); document.body.style.overflow=""; }
const authModal=$("#authModal");
const openAuthBtn=$("#openAuth"); if(openAuthBtn) openAuthBtn.addEventListener("click", ()=> openModal(authModal));
$$("[data-close]", authModal).forEach(el=>el.addEventListener("click", ()=> closeModal(authModal)));
$$(".tab").forEach(btn=>btn.addEventListener("click", ()=>{ $$(".tab").forEach(b=>b.classList.remove("active")); btn.classList.add("active"); const name=btn.dataset.tab; $$(".tab-panel").forEach(p=>p.classList.toggle("active", p.dataset.panel===name)); }));
$$(".subtab").forEach(btn=>btn.addEventListener("click", ()=>{ $$(".subtab").forEach(b=>b.classList.remove("active")); btn.classList.add("active"); const name=btn.dataset.sub; $$(".subpanel").forEach(p=>p.classList.toggle("active", p.dataset.subpanel===name)); }));

// Firebase
const appFB=initializeApp(window.FIREBASE_CONFIG);
const auth=getAuth(appFB); const db=getFirestore(appFB);

// Helpers: numeric ID
async function ensureUserNumericId(uid,email,name){
  const uref=doc(db,"users",uid); const usnap=await getDoc(uref);
  if(usnap.exists()&&usnap.data().numericId) return usnap.data().numericId;

  const metaRef=doc(db,"meta","counters");
  const id=await runTransaction(db, async tx=>{
    const m=await tx.get(metaRef); let next=1000001;
    if(m.exists()&&m.data().nextNumericId){ const raw=m.data().nextNumericId; next=typeof raw==="number"?raw:parseInt(raw,10)||next; }
    tx.set(metaRef,{nextNumericId:next+1},{merge:true});
    tx.set(uref,{uid,email:email||null,name:name||null,numericId:next,balance:0,gems:0,createdAt:serverTimestamp(),updatedAt:serverTimestamp()},{merge:true});
    tx.set(doc(db,"ids",String(next)),{uid,email:email||null,numericId:next,createdAt:serverTimestamp()},{merge:true});
    return next;
  });
  return id;
}
async function getEmailByNumericId(numericId){
  const s=await getDoc(doc(db,"ids",String(numericId)));
  if(!s.exists()) throw new Error("ID topilmadi");
  const { email } = s.data();
  if(!email) throw new Error("Ushbu ID uchun email/alias bog‘lanmagan.");
  return email;
}
function niceAuthError(err){
  const c=err?.code||"";
  if(c==="auth/admin-restricted-operation") return "Provider yoki user-creation cheklangan.";
  if(c==="auth/operation-not-allowed") return "Sign-in method yoqilmagan.";
  if(c==="auth/popup-closed-by-user") return "Oyna yopildi.";
  if(c==="auth/email-already-in-use") return "Bu email allaqachon ro‘yxatdan o‘tgan.";
  if(c==="auth/weak-password") return "Parol juda zaif (≥6).";
  if(c==="permission-denied") return "Firestore rules ruxsat bermadi.";
  return err?.message||String(err);
}

// Header & panel (live)
const authChip=$("#authChip"); const panelUser=$("#panelUser");
function renderAuthChipData(d){
  const id=d?.numericId??"—", balance=d?.balance??0, gems=d?.gems??0;
  authChip.innerHTML=`<div class="id-badge" title="Profil">
    <span class="pill">🆔:${id}</span>
    <span class="sep"></span>
    <span class="pill">💳: ${balance.toLocaleString()}</span>
	<span class="sep"></span>
    <span class="pill">💎: ${gems}</span>
  </div>`;
}
function renderSignedOut(){
  if(window.__unsubUser){try{window.__unsubUser();}catch{} window.__unsubUser=null;}
  authChip.innerHTML=`<button id="openAuth" class="btn primary">Kirish / Ro‘yxatdan o‘tish</button>`;
  const b=$("#openAuth"); if(b) b.addEventListener("click", ()=> openModal(authModal));
  if(panelUser){
    panelUser.innerHTML=`Mehmon. Kirish uchun quyidagi tugmadan foydalaning.
      <div style="display:grid; gap:8px; margin-top:8px"><button class="btn" id="panelOpenAuth2">Kirish / Ro‘yxatdan o‘tish</button></div>`;
    const b2=$("#panelOpenAuth2"); if(b2) b2.addEventListener("click", ()=>{ closePanel(); openModal(authModal); });
  }
}
async function renderSignedIn(user){
  try{
    const uref=doc(db,"users",user.uid);
    if(window.__unsubUser){try{window.__unsubUser();}catch{}}
    window.__unsubUser=onSnapshot(uref, us=>{
      const d=us.exists()?us.data():{};
      renderAuthChipData(d);
      const id=d.numericId||"—", balance=d.balance??0, gems=d.gems??0;
      if(panelUser){
        panelUser.innerHTML=`<div class="id-badge" title="Profil">
    <span class="pill">🆔:${id}</span>
    <span class="sep"></span>
    <span class="pill">💳: ${balance.toLocaleString()}</span>
	<span class="sep"></span>
    <span class="pill">💎: ${gems}</span>
  </div>
          <div style="display:grid; gap:8px; margin-top:10px">
            <a href="#profile" class="panel-link" data-panel-link>👤 Profil</a>
            <button class="btn" id="panelLogout">Chiqish</button>
          </div>`;
        const lo=$("#panelLogout"); if(lo) lo.onclick=async()=>{ await signOut(auth); closePanel(); };
      }
    }, err=>console.error(err));
  }catch(e){ console.error(e); renderSignedOut(); }
}
onAuthStateChanged(auth, u=>{ u?renderSignedIn(u):renderSignedOut(); });

// Login: ID + Password
const loginForm=$("#loginForm");
if (loginForm) loginForm.addEventListener("submit", async e=>{
  e.preventDefault();
  const id=($("#loginId").value||"").trim();
  const pass=$("#loginPass").value;
  const msg=$("#loginMsg"); msg.textContent="Tekshirilmoqda..."; msg.className="msg";
  try{
    const email=await getEmailByNumericId(id);
    await signInWithEmailAndPassword(auth, email, pass);
    msg.textContent="Kirdingiz."; msg.classList.add("ok"); closeModal(authModal);
  }catch(err){
    console.error(err); msg.textContent="Kirish xatosi: "+niceAuthError(err); msg.classList.add("error");
  }
});

// Signup: Email
const signupEmailForm=$("#signupEmailForm");
if (signupEmailForm) signupEmailForm.addEventListener("submit", async e=>{
  e.preventDefault();
  const name=$("#seName").value.trim()||null;
  const email=$("#seEmail").value.trim();
  const pass=$("#sePass").value;
  const msg=$("#signupEmailMsg"); msg.textContent="Ro‘yxatdan o‘tkazilmoqda..."; msg.className="msg";
  try{
    const u=auth.currentUser; let cred;
    if(u&&u.isAnonymous){ const c=EmailAuthProvider.credential(email,pass); cred=await linkWithCredential(u,c); }
    else{ cred=await createUserWithEmailAndPassword(auth,email,pass); }
    const uid=cred.user.uid;
    const numericId=await ensureUserNumericId(uid,email,name);
    await setDoc(doc(db,"ids",String(numericId)),{uid,email,numericId},{merge:true});
    msg.textContent=`Tayyor! Sizning ID: ${numericId}. Endi kirishda ID+Parol.`; msg.classList.add("ok"); closeModal(authModal);
  }catch(err){
    console.error(err); msg.textContent="Ro‘yxatdan o‘tishda xatolik: "+niceAuthError(err); msg.classList.add("error");
  }
});

// Signup: Google (faqat ro‘yhatdan → set password)
const googleBtn=$("#googleBtn");
const signupGoogleMsg=$("#signupGoogleMsg");
const googleSetPassForm=$("#googleSetPassForm");
const signupGoogleStepSetPass=$("#signupGoogleStepSetPass");
if (googleBtn) googleBtn.addEventListener("click", async ()=>{
  signupGoogleMsg.textContent="Google orqali kirmoqda..."; signupGoogleMsg.className="msg";
  try{
    const u=auth.currentUser; let userCred;
    if(u&&u.isAnonymous){ userCred=await linkWithPopup(u, new GoogleAuthProvider()); }
    else{ userCred=await signInWithPopup(auth, new GoogleAuthProvider()); }
    const gUser=userCred.user;
    await ensureUserNumericId(gUser.uid, gUser.email, gUser.displayName||null);
    signupGoogleStepSetPass.classList.remove("hidden");
    signupGoogleMsg.textContent="Google bog‘landi. Endi parol belgilang (kelgusi kirish ID+Parol).";
  }catch(err){
    console.error(err); signupGoogleMsg.textContent="Google ro‘yxatdan o‘tishda xatolik: "+niceAuthError(err); signupGoogleMsg.classList.add("error");
  }
});
if (googleSetPassForm) googleSetPassForm.addEventListener("submit", async e=>{
  e.preventDefault();
  signupGoogleMsg.textContent="Parol ulanmoqda..."; signupGoogleMsg.className="msg";
  try{
    const user=auth.currentUser; if(!user||!user.email) throw new Error("Google foydalanuvchisi aniqlanmadi.");
    const pass=$("#sgPass").value;
    const cred=EmailAuthProvider.credential(user.email, pass);
    await linkWithCredential(user, cred);
    const usnap=await getDoc(doc(db,"users",user.uid));
    const numericId=usnap.exists()?usnap.data().numericId:null;
    if(numericId) await setDoc(doc(db,"ids",String(numericId)),{uid:user.uid,email:user.email,numericId},{merge:true});
    signupGoogleMsg.textContent="Parol o‘rnatildi. Endi kirishda faqat ID + Parol."; signupGoogleMsg.classList.add("ok");
    closeModal(authModal);
  }catch(err){
    console.error(err); signupGoogleMsg.textContent="Parol ulashda xatolik: "+niceAuthError(err); signupGoogleMsg.classList.add("error");
  }
});

// Signup: One-click (email yo‘q → alias email)
const oneClickForm=$("#oneClickForm");
if (oneClickForm) oneClickForm.addEventListener("submit", async e=>{
  e.preventDefault();
  const name=$("#ocName").value.trim()||null;
  const pass=$("#ocPass").value;
  const msg=$("#oneClickMsg"); msg.textContent="Yaratilmoqda..."; msg.className="msg";
  try{
    const cur=auth.currentUser;
    const anon=(cur&&cur.isAnonymous)?{user:cur}:await signInAnonymously(auth);
    const uid=anon.user.uid;
    const numericId=await ensureUserNumericId(uid,null,name);
    const aliasEmail=`${numericId}@xplusy.local`;
    const cred=EmailAuthProvider.credential(aliasEmail, pass);
    await linkWithCredential(anon.user, cred);
    await setDoc(doc(db,"ids",String(numericId)),{uid,email:aliasEmail,numericId},{merge:true});
    msg.textContent=`Tayyor! Sizning ID: ${numericId}. Endi kirishda ID (${numericId}) va parol.`; msg.classList.add("ok");
    closeModal(authModal);
  }catch(err){
    console.error(err); msg.textContent="Xatolik: "+niceAuthError(err); msg.classList.add("error");
  }
});

// Signup: Phone (SMS → confirm → set password -> alias email)
let __phoneConf=null, __recaptcha=null;
function getRecaptcha(){ if(!__recaptcha){ __recaptcha=new RecaptchaVerifier(auth, "phoneCaptcha", { size:"invisible" }); } return __recaptcha; }
const phoneStartForm=$("#phoneStartForm");
const phoneVerifyForm=$("#phoneVerifyForm");
const phoneSetPassForm=$("#phoneSetPassForm");
const phoneMsg=$("#phoneMsg");

if (phoneStartForm) phoneStartForm.addEventListener("submit", async e=>{
  e.preventDefault();
  phoneMsg.textContent="SMS yuborilmoqda..."; phoneMsg.className="msg";
  try{
    const phone=$("#phNumber").value.trim();
    const appVerifier=getRecaptcha();
    __phoneConf = await signInWithPhoneNumber(auth, phone, appVerifier);
    phoneMsg.textContent="Kod yuborildi. Iltimos, tasdiqlash kodini kiriting.";
    phoneVerifyForm.classList.remove("hidden");
  }catch(err){
    console.error(err); phoneMsg.textContent="SMS yuborishda xatolik: "+niceAuthError(err); phoneMsg.classList.add("error");
  }
});
if (phoneVerifyForm) phoneVerifyForm.addEventListener("submit", async e=>{
  e.preventDefault();
  phoneMsg.textContent="Kod tekshirilmoqda..."; phoneMsg.className="msg";
  try{
    const code=$("#phCode").value.trim();
    const result=await __phoneConf.confirm(code);
    const user=result.user;
    await ensureUserNumericId(user.uid, user.email||null, user.displayName||null);
    phoneMsg.textContent="Tasdiqlandi. Endi parol o‘rnating."; phoneMsg.classList.add("ok");
    phoneSetPassForm.classList.remove("hidden");
  }catch(err){
    console.error(err); phoneMsg.textContent="Kod xato yoki muddati o‘tgan: "+niceAuthError(err); phoneMsg.classList.add("error");
  }
});
if (phoneSetPassForm) phoneSetPassForm.addEventListener("submit", async e=>{
  e.preventDefault();
  phoneMsg.textContent="Parol ulanmoqda..."; phoneMsg.className="msg";
  try{
    const user=auth.currentUser; if(!user) throw new Error("Foydalanuvchi aniqlanmadi.");
    const usnap=await getDoc(doc(db,"users",user.uid));
    let numericId=null; if(usnap.exists()) numericId=usnap.data().numericId;
    if(!numericId) numericId=await ensureUserNumericId(user.uid, user.email||null, user.displayName||null);
    const aliasEmail=`${numericId}@xplusy.local`;
    const pass=$("#phPass").value;
    const cred=EmailAuthProvider.credential(aliasEmail, pass);
    await linkWithCredential(user, cred);
    await setDoc(doc(db,"ids",String(numericId)),{uid:user.uid,email:aliasEmail,numericId},{merge:true});
    phoneMsg.textContent="Parol o‘rnatildi. Endi kirishda faqat ID + Parol."; phoneMsg.classList.add("ok");
    closeModal(authModal);
  }catch(err){
    console.error(err); phoneMsg.textContent="Parol ulashda xatolik: "+niceAuthError(err); phoneMsg.classList.add("error");
  }
});
// Theme boshqaruvi
const themeBtn = document.createElement('button');
themeBtn.className = 'theme-btn';
themeBtn.innerHTML = '🌓';
themeBtn.setAttribute('aria-label', 'Change theme');
themeBtn.setAttribute('title', 'Change theme');

const themeSwitcher = document.createElement('div');
themeSwitcher.className = 'theme-switcher';
themeSwitcher.appendChild(themeBtn);
document.body.appendChild(themeSwitcher);

// Theme ni o'qib olish
function getTheme() {
  return localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
}

// Theme ni o'rnatish
function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  
  // Tugma ikonkasini yangilash
  themeBtn.innerHTML = theme === 'dark' ? '☀️' : '🌙';
}

// Boshlang'ich theme ni o'rnatish
setTheme(getTheme());

// Theme tugmasi bosilganda
themeBtn.addEventListener('click', () => {
  const currentTheme = getTheme();
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  setTheme(newTheme);
});

// Tizim theme o'zgarishini kuzatish
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
  if (!localStorage.getItem('theme')) {
    setTheme(e.matches ? 'dark' : 'light');
  }
});