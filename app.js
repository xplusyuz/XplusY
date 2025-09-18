// app.js — core UI + Auth (eng ixcham)

// Firebase v10
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

// --------- Helpers ---------
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const y=$("#year"); if (y) y.textContent=String(new Date().getFullYear());

// --------- Side panel + modal (faqat funksional) ---------
const sidePanel=$("#sidePanel"), menuBtn=$("#menuBtn");
function openPanel(){ sidePanel?.setAttribute("aria-hidden","false"); menuBtn?.setAttribute("aria-expanded","true"); document.body.style.overflow="hidden"; }
function closePanel(){ sidePanel?.setAttribute("aria-hidden","true");  menuBtn?.setAttribute("aria-expanded","false"); document.body.style.overflow=""; }
window.closePanel = closePanel; // router.js shu funksiyadan foydalanadi
menuBtn?.addEventListener("click",()=> (sidePanel?.getAttribute("aria-hidden")!=="false") ? openPanel() : closePanel());
sidePanel?.addEventListener("click",e=>{ if(e.target.matches("[data-close-panel], .panel-backdrop")) closePanel(); });
addEventListener("keydown",e=>{ if(e.key==="Escape") closePanel(); });

const authModal=$("#authModal");
function openModal(m){ m?.setAttribute("aria-hidden","false"); document.body.style.overflow="hidden"; }
function closeModal(m){ m?.setAttribute("aria-hidden","true");  document.body.style.overflow=""; }
$("#openAuth")?.addEventListener("click",()=>openModal(authModal));
authModal?.addEventListener("click",e=>{ if(e.target.matches("[data-close], .modal-backdrop")) closeModal(authModal); });

// Tabs/subtabs (sodda)
document.addEventListener("click", e=>{
  const t=e.target.closest(".tab"); if(t){ $$(".tab").forEach(b=>b.classList.remove("active")); t.classList.add("active"); const n=t.dataset.tab; $$(".tab-panel").forEach(p=>p.classList.toggle("active", p.dataset.panel===n)); }
  const s=e.target.closest(".subtab"); if(s){ $$(".subtab").forEach(b=>b.classList.remove("active")); s.classList.add("active"); const n=s.dataset.sub; $$(".subpanel").forEach(p=>p.classList.toggle("active", p.dataset.subpanel===n)); }
});

// --------- Firebase init ---------
const appFB = initializeApp(window.FIREBASE_CONFIG);
const auth  = getAuth(appFB);
const db    = getFirestore(appFB);

// --------- Firestore helpers ---------
async function ensureUserNumericId(uid,email,name){
  const uref=doc(db,"users",uid); const us=await getDoc(uref);
  if(us.exists() && us.data().numericId) return us.data().numericId;

  const meta=doc(db,"meta","counters");
  const id=await runTransaction(db, async tx=>{
    const m=await tx.get(meta); let next=1000001;
    if(m.exists() && m.data().nextNumericId){ const raw=m.data().nextNumericId; next=typeof raw==="number"?raw:parseInt(raw,10)||next; }
    tx.set(meta,{nextNumericId:next+1},{merge:true});
    tx.set(uref,{uid,email:email||null,name:name||null,numericId:next,balance:0,gems:0,createdAt:serverTimestamp(),updatedAt:serverTimestamp()},{merge:true});
    tx.set(doc(db,"ids",String(next)),{uid,email:email||null,numericId:next,createdAt:serverTimestamp()},{merge:true});
    return next;
  });
  return id;
}
async function emailById(nid){
  const s=await getDoc(doc(db,"ids",String(nid)));
  if(!s.exists()) throw new Error("ID topilmadi");
  const email=s.data().email;
  if(!email) throw new Error("Ushbu ID uchun email/alias bog‘lanmagan.");
  return email;
}
const errTxt = (e)=>({
  "auth/admin-restricted-operation":"Provider yoki user-creation cheklangan.",
  "auth/operation-not-allowed":"Sign-in method yoqilmagan.",
  "auth/popup-closed-by-user":"Oyna yopildi.",
  "auth/email-already-in-use":"Bu email allaqachon ro‘yxatdan o‘tgan.",
  "auth/weak-password":"Parol juda zaif (≥6).",
  "permission-denied":"Firestore rules ruxsat bermadi."
}[e?.code]||e?.message||String(e));

// --------- Header/panel live data ---------
const authChip=$("#authChip"), panelUser=$("#panelUser");
function paintUser(d){
  const id=d?.numericId??"—", bal=d?.balance??0, gm=d?.gems??0;
  authChip.innerHTML=`<div class="id-badge">
    <span class="pill"><b>ID:</b> ${id}</span>
    <span class="sep"></span>
    <span class="pill">Balans: ${bal.toLocaleString()}</span>
    <span class="pill">Olmos: ${gm}</span>
  </div>`;
}
function onSignedOut(){
  authChip.innerHTML=`<button id="openAuth2" class="btn primary">Kirish / Ro‘yxatdan</button>`;
  $("#openAuth2")?.addEventListener("click",()=>openModal(authModal));
  if(panelUser){
    panelUser.innerHTML=`Mehmon. Kirish uchun quyidagi tugmadan foydalaning.
      <div style="display:grid; gap:8px; margin-top:8px"><button class="btn" id="panelOpenAuth2">Kirish / Ro‘yxatdan</button></div>`;
    $("#panelOpenAuth2")?.addEventListener("click",()=>{ closePanel(); openModal(authModal); });
  }
}
async function onSignedIn(user){
  const uref=doc(db,"users",user.uid);
  if(window.__unsubUser){ try{window.__unsubUser();}catch{} }
  window.__unsubUser = onSnapshot(uref, us=>{
    const d=us.exists()?us.data():{};
    paintUser(d);
    const id=d.numericId||"—", bal=d.balance??0, gm=d.gems??0;
    if(panelUser){
      panelUser.innerHTML=`<div><b>ID:</b> ${id}</div><div class="muted">Balans: ${bal.toLocaleString()} • Olmos: ${gm}</div>
        <div style="display:grid; gap:8px; margin-top:10px">
          <a href="#profile" class="panel-link" data-panel-link>👤 Profil</a>
          <button class="btn" id="panelLogout">Chiqish</button>
        </div>`;
      $("#panelLogout")?.addEventListener("click", async()=>{ await signOut(auth); closePanel(); });
    }
  });
}
onAuthStateChanged(auth, u=> u?onSignedIn(u):onSignedOut());

// --------- Auth flows ---------
// Login: ID + Parol
$("#loginForm")?.addEventListener("submit", async e=>{
  e.preventDefault();
  const id=($("#loginId").value||"").trim(), pass=$("#loginPass").value, msg=$("#loginMsg");
  msg.textContent="Tekshirilmoqda..."; msg.className="msg";
  try{ const email=await emailById(id); await signInWithEmailAndPassword(auth,email,pass); msg.textContent="Kirdingiz."; msg.classList.add("ok"); closeModal(authModal); }
  catch(err){ msg.textContent="Kirish xatosi: "+errTxt(err); msg.classList.add("error"); }
});

// Signup: Email
$("#signupEmailForm")?.addEventListener("submit", async e=>{
  e.preventDefault();
  const name=$("#seName").value.trim()||null, email=$("#seEmail").value.trim(), pass=$("#sePass").value, msg=$("#signupEmailMsg");
  msg.textContent="Ro‘yxatdan o‘tkazilmoqda..."; msg.className="msg";
  try{
    const cur=auth.currentUser; let cred;
    if(cur&&cur.isAnonymous){ const c=EmailAuthProvider.credential(email,pass); cred=await linkWithCredential(cur,c); }
    else{ cred=await createUserWithEmailAndPassword(auth,email,pass); }
    const uid=cred.user.uid, nid=await ensureUserNumericId(uid,email,name);
    await setDoc(doc(db,"ids",String(nid)),{uid,email,numericId:nid},{merge:true});
    msg.textContent=`Tayyor! Sizning ID: ${nid}. Kelgusida ID+Parol bilan kirasiz.`; msg.classList.add("ok"); closeModal(authModal);
  }catch(err){ msg.textContent="Ro‘yxatdan o‘tishda: "+errTxt(err); msg.classList.add("error"); }
});

// Signup: Google → set password
const gMsg=$("#signupGoogleMsg"), gStep=$("#signupGoogleStepSetPass");
$("#googleBtn")?.addEventListener("click", async ()=>{
  gMsg.textContent="Google orqali kirmoqda..."; gMsg.className="msg";
  try{
    const cur=auth.currentUser; let cr;
    if(cur&&cur.isAnonymous){ cr=await linkWithPopup(cur,new GoogleAuthProvider()); }
    else{ cr=await signInWithPopup(auth,new GoogleAuthProvider()); }
    await ensureUserNumericId(cr.user.uid, cr.user.email, cr.user.displayName||null);
    gStep.classList.remove("hidden");
    gMsg.textContent="Google bog‘landi. Endi parol belgilang.";
  }catch(err){ gMsg.textContent="Google xatolik: "+errTxt(err); gMsg.classList.add("error"); }
});
$("#googleSetPassForm")?.addEventListener("submit", async e=>{
  e.preventDefault();
  gMsg.textContent="Parol ulanmoqda..."; gMsg.className="msg";
  try{
    const u=auth.currentUser; if(!u||!u.email) throw new Error("Google foydalanuvchisi aniqlanmadi.");
    const pass=$("#sgPass").value; await linkWithCredential(u, EmailAuthProvider.credential(u.email,pass));
    const us=await getDoc(doc(db,"users",u.uid)); const nid=us.exists()?us.data().numericId:null;
    if(nid) await setDoc(doc(db,"ids",String(nid)),{uid:u.uid,email:u.email,numericId:nid},{merge:true});
    gMsg.textContent="Parol o‘rnatildi. Endi ID+Parol bilan kirasiz."; gMsg.classList.add("ok"); closeModal(authModal);
  }catch(err){ gMsg.textContent="Parol ulash: "+errTxt(err); gMsg.classList.add("error"); }
});

// Signup: One-click (anon → alias email)
$("#oneClickForm")?.addEventListener("submit", async e=>{
  e.preventDefault();
  const name=$("#ocName").value.trim()||null, pass=$("#ocPass").value, msg=$("#oneClickMsg");
  msg.textContent="Yaratilmoqda..."; msg.className="msg";
  try{
    const cur=auth.currentUser, anon=(cur&&cur.isAnonymous)?{user:cur}:await signInAnonymously(auth);
    const uid=anon.user.uid, nid=await ensureUserNumericId(uid,null,name);
    const alias=`${nid}@xplusy.local`;
    await linkWithCredential(anon.user, EmailAuthProvider.credential(alias,pass));
    await setDoc(doc(db,"ids",String(nid)),{uid:uid,email:alias,numericId:nid},{merge:true});
    msg.textContent=`Tayyor! Sizning ID: ${nid}. Endi ID (${nid}) + parol.`; msg.classList.add("ok"); closeModal(authModal);
  }catch(err){ msg.textContent="Xatolik: "+errTxt(err); msg.classList.add("error"); }
});

// Signup: Phone (SMS → confirm → set password via alias)
let _phConf=null,_recaptcha=null; function recaptcha(){ return _recaptcha||(_recaptcha=new RecaptchaVerifier(auth,"phoneCaptcha",{size:"invisible"})); }
$("#phoneStartForm")?.addEventListener("submit", async e=>{
  e.preventDefault(); const msg=$("#phoneMsg"); msg.textContent="SMS yuborilmoqda..."; msg.className="msg";
  try{ const phone=$("#phNumber").value.trim(); _phConf=await signInWithPhoneNumber(auth, phone, recaptcha()); msg.textContent="Kod yuborildi. Kiriting."; $("#phoneVerifyForm")?.classList.remove("hidden"); }
  catch(err){ msg.textContent="SMS xato: "+errTxt(err); msg.classList.add("error"); }
});
$("#phoneVerifyForm")?.addEventListener("submit", async e=>{
  e.preventDefault(); const msg=$("#phoneMsg"); msg.textContent="Tekshirilmoqda..."; msg.className="msg";
  try{ const code=$("#phCode").value.trim(); const res=await _phConf.confirm(code); await ensureUserNumericId(res.user.uid, res.user.email||null, res.user.displayName||null); msg.textContent="Tasdiqlandi. Endi parol o‘rnating."; msg.classList.add("ok"); $("#phoneSetPassForm")?.classList.remove("hidden"); }
  catch(err){ msg.textContent="Kod xato/muddati o‘tgan: "+errTxt(err); msg.classList.add("error"); }
});
$("#phoneSetPassForm")?.addEventListener("submit", async e=>{
  e.preventDefault(); const msg=$("#phoneMsg"); msg.textContent="Parol ulanmoqda..."; msg.className="msg";
  try{
    const u=auth.currentUser; if(!u) throw new Error("Foydalanuvchi aniqlanmadi.");
    let nid=(await getDoc(doc(db,"users",u.uid))).data()?.numericId;
    if(!nid) nid=await ensureUserNumericId(u.uid, u.email||null, u.displayName||null);
    const alias=`${nid}@xplusy.local`, pass=$("#phPass").value;
    await linkWithCredential(u, EmailAuthProvider.credential(alias,pass));
    await setDoc(doc(db,"ids",String(nid)),{uid:u.uid,email:alias,numericId:nid},{merge:true});
    msg.textContent="Parol o‘rnatildi. Endi ID+Parol bilan kirasiz."; msg.classList.add("ok"); closeModal(authModal);
  }catch(err){ msg.textContent="Parol ulash: "+errTxt(err); msg.classList.add("error"); }
});
