import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, linkWithCredential, linkWithPopup, EmailAuthProvider, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp, runTransaction, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";

const $ = (s,r=document)=>r.querySelector(s); const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const y=$("#year"); if(y) y.textContent=String(new Date().getFullYear());

(function(){ const root=document.documentElement; const saved=localStorage.getItem("xpy_theme"); const prefersLight=window.matchMedia&&window.matchMedia("(prefers-color-scheme: light)").matches; root.setAttribute("data-theme", saved || (prefersLight?"light":"dark")); const b=$("#themeToggle"); const set=m=>{root.setAttribute("data-theme",m); localStorage.setItem("xpy_theme",m)}; if(b) b.addEventListener("click", ()=>{ const cur=root.getAttribute("data-theme")||"dark"; set(cur==="dark"?"light":"dark"); }); })();

const app=$("#app"); const routes=["home","tests","live","leaderboard","about"];
async function loadRoute(){ const hash=location.hash.replace("#","")||"home"; const route=routes.includes(hash)?hash:"home"; try{ const res=await fetch(`./partials/${route}.html`,{cache:"no-store"}); if(!res.ok) throw 0; app.innerHTML=await res.text(); }catch{ app.innerHTML=`<div class="card" style="padding:16px; border:1px solid rgba(255,255,255,.06); border-radius:14px; background:var(--card); box-shadow: var(--shadow);"><h2 style="margin-top:0">${route}</h2><p class="muted">Partial (partials/${route}.html) hali yaratilmagan.</p></div>`; } }
addEventListener("hashchange", loadRoute); loadRoute();

const sidePanel=$("#sidePanel"); const menuBtn=$("#menuBtn");
function openPanel(){ sidePanel.setAttribute("aria-hidden","false"); if(menuBtn) menuBtn.setAttribute("aria-expanded","true"); document.body.style.overflow="hidden"; const card=$(".panel-card",sidePanel); if(card) card.focus(); }
function closePanel(){ sidePanel.setAttribute("aria-hidden","true"); if(menuBtn) menuBtn.setAttribute("aria-expanded","false"); document.body.style.overflow=""; }
if(menuBtn) menuBtn.addEventListener("click", ()=>{ const hid=sidePanel.getAttribute("aria-hidden")!=="false"; hid?openPanel():closePanel(); });
$$("[data-close-panel]", sidePanel).forEach(el=>el.addEventListener("click", closePanel));
addEventListener("keydown", e=>{ if(e.key==="Escape") closePanel(); });
const panelOpenAuth=$("#panelOpenAuth"); if(panelOpenAuth) panelOpenAuth.addEventListener("click", ()=>{ closePanel(); openModal($("#authModal")); });

function openModal(m){ m.setAttribute("aria-hidden","false"); document.body.style.overflow="hidden"; }
function closeModal(m){ m.setAttribute("aria-hidden","true"); document.body.style.overflow=""; }
const authModal=$("#authModal"); const openAuthBtn=$("#openAuth"); if(openAuthBtn) openAuthBtn.addEventListener("click", ()=>openModal(authModal));
$$("[data-close]", authModal).forEach(el=>el.addEventListener("click", ()=>closeModal(authModal)));
$$(".tab").forEach(btn=>btn.addEventListener("click", ()=>{ $$(".tab").forEach(b=>b.classList.remove("active")); btn.classList.add("active"); const name=btn.dataset.tab; $$(".tab-panel").forEach(p=>p.classList.toggle("active", p.dataset.panel===name)); }));
$$(".subtab").forEach(btn=>btn.addEventListener("click", ()=>{ $$(".subtab").forEach(b=>b.classList.remove("active")); btn.classList.add("active"); const name=btn.dataset.sub; $$(".subpanel").forEach(p=>p.classList.toggle("active", p.dataset.subpanel===name)); }));

if(!window.FIREBASE_CONFIG) console.warn("[XplusY] FIREBASE_CONFIG yo‘q (index.htmlni tekshiring).");
const appFB=initializeApp(window.FIREBASE_CONFIG||{apiKey:"DUMMY",authDomain:"dummy.firebaseapp.com",projectId:"dummy"});
const auth=getAuth(appFB); const db=getFirestore(appFB); const provider=new GoogleAuthProvider();

async function ensureUserNumericId(uid,email,name){
  const uref=doc(db,"users",uid); const usnap=await getDoc(uref); if(usnap.exists()&&usnap.data().numericId) return usnap.data().numericId;
  const metaRef=doc(db,"meta","counters");
  const id=await runTransaction(db, async tx=>{
    const m=await tx.get(metaRef); let next=1000001; if(m.exists()&&m.data().nextNumericId){ const raw=m.data().nextNumericId; next=typeof raw==="number"?raw:parseInt(raw,10)||next; }
    tx.set(metaRef,{nextNumericId:next+1},{merge:true});
    tx.set(uref,{uid,email:email||null,name:name||null,numericId:next,balance:0,gems:0,createdAt:serverTimestamp(),updatedAt:serverTimestamp()},{merge:true});
    tx.set(doc(db,"ids",String(next)),{uid,email:email||null,numericId:next,createdAt:serverTimestamp()},{merge:true});
    return next;
  });
  return id;
}
async function getEmailByNumericId(numericId){
  const s=await getDoc(doc(db,"ids",String(numericId))); if(!s.exists()) throw new Error("ID topilmadi");
  const {email}=s.data(); if(!email) throw new Error("Ushbu ID uchun email bog‘lanmagan (parol o‘rnatilmagan)."); return email;
}
function niceAuthError(err){ const c=err?.code||"";
  if(c==="auth/admin-restricted-operation") return "Ro‘yxatdan o‘tish cheklangan. Provider yoki user-creation sozlamalarini tekshiring.";
  if(c==="auth/operation-not-allowed") return "Ushbu kirish usuli o‘chirilgan (Sign-in method).";
  if(c==="auth/popup-closed-by-user") return "Oyna yopildi.";
  if(c==="auth/email-already-in-use") return "Bu email allaqachon ro‘yxatdan o‘tgan.";
  if(c==="auth/weak-password") return "Parol juda zaif (kamida 6 belgi).";
  if(c==="permission-denied") return "Ruxsat berilmagan (Firestore rulesni tekshiring).";
  return err?.message||String(err);
}

const authChip=$("#authChip"); const panelUser=$("#panelUser");
function renderAuthChipData(d){ const id=d?.numericId??"—"; const balance=d?.balance??0; const gems=d?.gems??0;
  authChip.innerHTML=`<div class="id-badge" title="Profil ma'lumotlari">
    <span class="pill"><svg class="icon-12" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16v16H4z" opacity=".15"/><path d="M7 8h10v2H7zM7 12h6v2H7z"/></svg><span class="lbl"><b>ID:</b></span> <span>${id}</span></span>
    <span class="sep"></span>
    <span class="pill"><svg class="icon-12" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h18v10H3z" opacity=".15"/><path d="M4 9h16v2H4zM6 13h8v2H6z"/></svg><span class="lbl">Balans:</span> <span>${balance.toLocaleString()}</span></span>
    <span class="pill"><svg class="icon-12" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l4 7-4 13-4-13z" opacity=".15"/></svg><span class="lbl">Olmos:</span> <span>${gems}</span></span>
  </div>`;
}
function renderSignedOut(){ if(window.__unsubUser){try{window.__unsubUser()}catch{} window.__unsubUser=null;}
  authChip.innerHTML=`<button id="openAuth" class="btn primary">Kirish / Ro‘yxatdan o‘tish</button>`; const b=$("#openAuth"); if(b) b.addEventListener("click", ()=>openModal(authModal));
  if(panelUser){ panelUser.innerHTML=`Mehmon. Kirish uchun quyidagi tugmadan foydalaning.<div style="display:grid; gap:8px; margin-top:8px"><button class="btn" id="panelOpenAuth2">Kirish / Ro‘yxatdan o‘tish</button></div>`; const b2=$("#panelOpenAuth2"); if(b2) b2.addEventListener("click", ()=>{ closePanel(); openModal(authModal); }); }
}
async function renderSignedIn(user){ try{
  const uref=doc(db,"users",user.uid); if(window.__unsubUser){try{window.__unsubUser()}catch{}}
  window.__unsubUser=onSnapshot(uref, us=>{ const d=us.exists()?us.data():{}; renderAuthChipData(d);
    const id=d.numericId||"—", balance=d.balance??0, gems=d.gems??0;
    if(panelUser){ panelUser.innerHTML=`<div><b>ID:</b> ${id}</div><div class="meta" style="color:var(--muted)">Balans: ${balance.toLocaleString()} so‘m • Olmos: ${gems}</div><div style="display:grid; gap:8px; margin-top:10px"><a href="#profile" class="panel-link" data-panel-link>👤 Profil</a><button class="btn" id="panelLogout">Chiqish</button></div>`; const lo=$("#panelLogout"); if(lo) lo.onclick=async()=>{ await signOut(auth); closePanel(); }; }
  }, err=>console.error(err));
}catch(e){ console.error(e); renderSignedOut(); } }
onAuthStateChanged(auth, user=>{ user?renderSignedIn(user):renderSignedOut(); });

const loginForm=$("#loginForm"); if(loginForm) loginForm.addEventListener("submit", async e=>{ e.preventDefault();
  const id=($("#loginId").value||"").trim(); const pass=$("#loginPass").value; const msg=$("#loginMsg"); msg.textContent="Tekshirilmoqda..."; msg.className="msg";
  try{ const email=await getEmailByNumericId(id); await signInWithEmailAndPassword(auth, email, pass); msg.textContent="Kirdingiz."; msg.classList.add("ok"); closeModal(authModal); }
  catch(err){ console.error(err); msg.textContent="Kirish xatosi: "+niceAuthError(err); msg.classList.add("error"); }
});

const signupEmailForm=$("#signupEmailForm"); if(signupEmailForm) signupEmailForm.addEventListener("submit", async e=>{ e.preventDefault();
  const name=$("#seName").value.trim()||null; const email=$("#seEmail").value.trim(); const pass=$("#sePass").value; const msg=$("#signupEmailMsg"); msg.textContent="Ro‘yxatdan o‘tkazilmoqda..."; msg.className="msg";
  try{ const u=auth.currentUser; let cred;
    if(u&&u.isAnonymous){ const c=EmailAuthProvider.credential(email,pass); cred=await linkWithCredential(u,c); }
    else{ cred=await createUserWithEmailAndPassword(auth,email,pass); }
    const uid=cred.user.uid; const numericId=await ensureUserNumericId(uid,email,name); await setDoc(doc(db,"ids",String(numericId)),{uid,email,numericId},{merge:true});
    msg.textContent=`Tayyor! Sizning ID: ${numericId}. Endi kirishda faqat ID + parol.`; msg.classList.add("ok"); closeModal(authModal);
  }catch(err){ console.error(err); msg.textContent="Ro‘yxatdan o‘tishda xatolik: "+niceAuthError(err); msg.classList.add("error"); }
});

const googleBtn=$("#googleBtn"); const signupGoogleMsg=$("#signupGoogleMsg"); const googleSetPassForm=$("#googleSetPassForm"); const signupGoogleStepSetPass=$("#signupGoogleStepSetPass");
if(googleBtn) googleBtn.addEventListener("click", async()=>{ signupGoogleMsg.textContent="Google orqali kirmoqda..."; signupGoogleMsg.className="msg";
  try{ const u=auth.currentUser; let userCred; if(u&&u.isAnonymous){ userCred=await linkWithPopup(u,new GoogleAuthProvider()); } else { userCred=await signInWithPopup(auth,new GoogleAuthProvider()); }
    const gUser=userCred.user; await ensureUserNumericId(gUser.uid,gUser.email,gUser.displayName||null);
    signupGoogleStepSetPass.classList.remove("hidden"); signupGoogleMsg.textContent="Google bog‘landi. Endi parol belgilang (kelgusi kirish ID+Parol).";
  }catch(err){ console.error(err); signupGoogleMsg.textContent="Google ro‘yxatdan o‘tishda xatolik: "+niceAuthError(err); signupGoogleMsg.classList.add("error"); }
});
if(googleSetPassForm) googleSetPassForm.addEventListener("submit", async e=>{ e.preventDefault(); signupGoogleMsg.textContent="Parol ulanmoqda..."; signupGoogleMsg.className="msg";
  try{ const user=auth.currentUser; if(!user||!user.email) throw new Error("Google foydalanuvchisi aniqlanmadi."); const pass=$("#sgPass").value; const cred=EmailAuthProvider.credential(user.email,pass); await linkWithCredential(user,cred);
    const usnap=await getDoc(doc(db,"users",user.uid)); const numericId=usnap.exists()?usnap.data().numericId:null; if(numericId) await setDoc(doc(db,"ids",String(numericId)),{uid:user.uid,email:user.email,numericId},{merge:true});
    signupGoogleMsg.textContent="Parol o‘rnatildi. Endi kirishda faqat ID + Parol."; signupGoogleMsg.classList.add("ok"); closeModal(authModal);
  }catch(err){ console.error(err); signupGoogleMsg.textContent="Parol ulashda xatolik: "+niceAuthError(err); signupGoogleMsg.classList.add("error"); }
});

const oneClickForm=$("#oneClickForm"); if(oneClickForm) oneClickForm.addEventListener("submit", async e=>{ e.preventDefault();
  const name=$("#ocName").value.trim()||null; const pass=$("#ocPass").value; const msg=$("#oneClickMsg"); msg.textContent="Yaratilmoqda..."; msg.className="msg";
  try{ const cur=auth.currentUser; const anon=(cur&&cur.isAnonymous)?{user:cur}:await signInAnonymously(auth); const uid=anon.user.uid;
    const numericId=await ensureUserNumericId(uid,null,name); const aliasEmail=`${numericId}@xplusy.local`; const cred=EmailAuthProvider.credential(aliasEmail,pass); await linkWithCredential(anon.user,cred);
    await setDoc(doc(db,"ids",String(numericId)),{uid,email:aliasEmail,numericId},{merge:true});
    msg.textContent=`Tayyor! Sizning ID: ${numericId}. Endi kirishda ID (${numericId}) va parol.`; msg.classList.add("ok"); closeModal(authModal);
  }catch(err){ console.error(err); msg.textContent="Xatolik: "+niceAuthError(err); msg.classList.add("error"); }
});
