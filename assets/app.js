import { auth, db, googleProvider, onAuthStateChanged, signOut, doc, getDoc, onSnapshot } from './firebase.js';

// Inject header/footer
async function loadPartial(id, url){
  try{
    const el = document.getElementById(id);
    if(!el) return;
    const res = await fetch(url, {cache:"no-store"});
    el.innerHTML = await res.text();
    if(id === "site-header"){ wireHeader(); }
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
  logoutBtn?.addEventListener("click", async () => {
    await signOut(auth);
    location.href = "registor.html";
  });
}

// User badge fill
async function fillUserPanel(user){
  const nameEl = qs("[data-username]");
  const idEl   = qs("[data-userid]");
  const balEl  = qsa("[data-balance]");
  const ptsEl  = qsa("[data-points]");
  const anonEls= qsa("[data-anon]");
  const authedEls = qsa("[data-authed]");

  if(user){
    nameEl && (nameEl.textContent = user.displayName || (user.email ? user.email.split("@")[0] : "Foydalanuvchi"));
    idEl && (idEl.textContent = user.uid.slice(0,10));
    anonEls.forEach(e=> e.style.display="none");
    authedEls.forEach(e=> e.style.display="inline-flex");

    const ref = doc(db, "users", user.uid);
    const snap = await getDoc(ref);
    if(snap.exists()){
      const data = snap.data();
      balEl.forEach(e=> e.textContent = (data.balance ?? 0).toLocaleString("uz-UZ"));
      ptsEl.forEach(e=> e.textContent = (data.points ?? 0).toLocaleString("uz-UZ"));
    }
    // Live updates
    onSnapshot(ref, s=>{
      const d = s.data() || {};
      balEl.forEach(e=> e.textContent = (d.balance ?? 0).toLocaleString("uz-UZ"));
      ptsEl.forEach(e=> e.textContent = (d.points ?? 0).toLocaleString("uz-UZ"));
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

// Boot
loadPartial("site-header", "components/header.html");
loadPartial("site-footer", "components/footer.html");
onAuthStateChanged(auth, (u)=> fillUserPanel(u));
window.addEventListener("DOMContentLoaded", runCarousel);
