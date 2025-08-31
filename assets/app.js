import { auth, db, googleProvider, onAuthStateChanged, signOut, doc, getDoc, onSnapshot, collection, query, orderBy, limit, getDocs, ensureUserDoc } from './firebase.js';

// Inject header/footer
async function loadPartial(id, url){
  try{
    const el = document.getElementById(id);
    if(!el) return;
    const res = await fetch(url, {cache:"no-store"});
    el.innerHTML = await res.text();
    if(id === "site-header"){ wireHeader(); wirePanel(); }
  }catch(e){ console.error("Partial load failed:", url, e); }
}

function qs(sel, root=document){ return root.querySelector(sel); }
function qsa(sel, root=document){ return Array.from(root.querySelectorAll(sel)); }

// Header logic (drawer, signout)
function wireHeader(){
  const drawer = qs(".drawer");
  const burger = qs(".burger");
  const closeBtn = qs(".drawer-close");
  burger?.addEventListener("click", () => drawer?.classList.add("open"));
  closeBtn?.addEventListener("click", () => drawer?.classList.remove("open"));
  const logoutBtn = qs("[data-logout]");
  logoutBtn?.addEventListener("click", async (e) => {
    e.preventDefault();
    await signOut(auth);
    location.href = "registor.html";
  });
}

// User badge fill + title by points
function getTitleByPoints(points){
  points = Number(points||0);
  if(points >= 3000) return "👑 Kiber Ustoz";
  if(points >= 1500) return "🥇 Kiber Daho";
  if(points >= 700)  return "🚀 Kiber Professional";
  if(points >= 300)  return "🛡️ Kiber Usta";
  if(points >= 100)  return "⚡ Kiber Faol";
  return "🌱 Kiber O‘quvchi";
}

async function fillUserPanel(user){
  const nameEl = qs("[data-username]");
  const idEl   = qs("[data-userid]");
  const balEl  = qsa("[data-balance]");
  const ptsEl  = qsa("[data-points]");
  const anonEls= qsa("[data-anon]");
  const authedEls = qsa("[data-authed]");

  if(user){
    nameEl && (nameEl.textContent = user.displayName || (user.email ? user.email.split("@")[0] : "Foydalanuvchi"));
    anonEls.forEach(e=> e.style.display="none");
    authedEls.forEach(e=> e.style.display="inline-flex");

    const ref = doc(db, "users", user.uid);
    const snap = await getDoc(ref);
    if(snap.exists()){
      const data = snap.data();
      idEl && (idEl.textContent = (data.numericId ?? user.uid.slice(0,10)));
      balEl.forEach(e=> e.textContent = (data.balance ?? 0).toLocaleString("uz-UZ"));
      ptsEl.forEach(e=> e.textContent = (data.points ?? 0).toLocaleString("uz-UZ"));
      const titleEl = document.querySelector("[data-title]");
      if(titleEl){ titleEl.textContent = getTitleByPoints(data.points); }
    }
    // Live updates
    onSnapshot(ref, s=>{
      const d = s.data() || {};
      idEl && (idEl.textContent = (d.numericId ?? user.uid.slice(0,10)));
      balEl.forEach(e=> e.textContent = (d.balance ?? 0).toLocaleString("uz-UZ"));
      ptsEl.forEach(e=> e.textContent = (d.points ?? 0).toLocaleString("uz-UZ"));
      const titleEl = document.querySelector("[data-title]");
      if(titleEl){ titleEl.textContent = getTitleByPoints(d.points); }
    });
  }else{
    anonEls.forEach(e=> e.style.display="inline-flex");
    authedEls.forEach(e=> e.style.display="none");
  }
}

// Ads carousel
function runCarousel(){
  const frames = qsa(".ads-frame");
  if(!frames.length) return;
  let idx = 0;
  frames[idx].classList.add("active");
  setInterval(()=>{
    frames[idx].classList.remove("active");
    idx = (idx + 1) % frames.length;
    frames[idx].classList.add("active");
  }, 5000);
}

// === Touch Panel interactions ===
function openTouchPanel(){
  document.body.classList.add('panel-lock');
  document.getElementById('panelBackdrop')?.classList.add('open');
  document.getElementById('touchPanel')?.classList.add('open');
}
function closeTouchPanel(){
  document.body.classList.remove('panel-lock');
  document.getElementById('panelBackdrop')?.classList.remove('open');
  document.getElementById('touchPanel')?.classList.remove('open');
}
function wirePanel(){
  const openBtn = document.getElementById('panelOpen');
  const closeBtn = document.getElementById('panelClose');
  const backdrop = document.getElementById('panelBackdrop');
  const panel = document.getElementById('touchPanel');
  const burger = document.querySelector('.burger');

  const open = (e)=>{ e?.preventDefault(); openTouchPanel(); };
  const close = (e)=>{ e?.preventDefault(); closeTouchPanel(); };

  openBtn?.addEventListener('click', open, {passive:false});
  openBtn?.addEventListener('touchstart', open, {passive:false});
  burger?.addEventListener('click', open);

  closeBtn?.addEventListener('click', close);
  closeBtn?.addEventListener('touchstart', close, {passive:false});
  backdrop?.addEventListener('click', close);
  document.addEventListener('keydown', (e)=>{ if(e.key === 'Escape') close(); });

  // Swipe to close
  let startX = null;
  panel?.addEventListener('touchstart', (e)=>{ startX = e.touches[0].clientX; }, {passive:true});
  panel?.addEventListener('touchmove', (e)=>{
    if(startX == null) return;
    const dx = e.touches[0].clientX - startX;
    if(dx > 60){ close(); startX = null; }
  }, {passive:true});
}

// Boot
loadPartial("site-header", "components/header.html");
loadPartial("site-footer", "components/footer.html");
onAuthStateChanged(auth, async (u)=> { if(u){ try{ await ensureUserDoc(u); }catch(e){ console.warn('ensureUserDoc failed', e); } fillUserPanel(u); } else { fillUserPanel(null); } });
window.addEventListener("DOMContentLoaded", ()=>{ runCarousel(); wirePanel(); });
