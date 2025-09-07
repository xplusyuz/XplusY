
// Global UI: header/footer include, theme toggle, menu overlay, auth gating
import { auth, onAuth, signInGoogle, signOutNow, ensureUserDoc, getUserDoc } from "./firebase.js";

const QS = (s, r=document)=>r.querySelector(s);
const QSA = (s, r=document)=>[...r.querySelectorAll(s)];

function applyTheme(next) {
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("mc-theme", next);
  document.body.classList.toggle("dark", next==="dark");
}
function initTheme() {
  const saved = localStorage.getItem("mc-theme");
  if (saved) return applyTheme(saved);
  const prefers = matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(prefers?"dark":"light");
}

async function include(selector, url) {
  const el = QS(selector);
  const res = await fetch(url);
  el.innerHTML = await res.text();
}

function openMenu(){ document.body.setAttribute("data-menu-open","true"); }
function closeMenu(){ document.body.removeAttribute("data-menu-open"); }
function openModal(id){ document.body.setAttribute("data-modal-open","true"); QS(id).setAttribute("aria-hidden","false"); }
function closeModal(id){ QS(id).setAttribute("aria-hidden","true"); document.body.removeAttribute("data-modal-open"); }

async function boot() {
  initTheme();
  await include("#header-include", "/partials/header.html");
  await include("#footer-include", "/partials/footer.html");

  // Wire theme
  QSA('[data-action="toggle-theme"],#themeToggle').forEach(b=>b.addEventListener("click",()=>{
    const cur = document.documentElement.getAttribute("data-theme")||"light";
    applyTheme(cur==="dark"?"light":"dark");
  }));

  // Wire menu
  QSA('[data-action="open-menu"],#menuToggle').forEach(b=>b.addEventListener("click",openMenu));
  QSA('[data-action="close-menu"],#menuClose').forEach(b=>b.addEventListener("click",closeMenu));
  QSA(".site-overlay").forEach(ov=>ov.addEventListener("click",()=>{ closeMenu(); closeModal("#authModal"); }));
  document.addEventListener("keydown",(e)=>{ if(e.key==="Escape"){ closeMenu(); closeModal("#authModal"); }});

  // Auth buttons
  const btnLogin = document.getElementById("btnLogin");
  const btnLogout = document.getElementById("btnLogout");
  if (btnLogin) btnLogin.addEventListener("click", async ()=>{ await signInGoogle(); });
  if (btnLogout) btnLogout.addEventListener("click", async ()=>{ await signOutNow(); });

  const loginFromModal = document.getElementById("loginFromModal");
  if (loginFromModal) loginFromModal.addEventListener("click", async ()=>{ await signInGoogle(); });

  // Auth state
  onAuth(async (user)=>{
    if (!user) {
      // block UI with login modal
      const authModal = document.getElementById("authModal");
      if (authModal) openModal("#authModal");
      // header badges to default
      const fields = [["uId","—"],["uBalance","💵 0"],["uGems","💎 0"]];
      fields.forEach(([id,val])=>{ const e= document.getElementById(id); if(e) e.textContent = val; });
      if (btnLogin) btnLogin.style.display = "";
      if (btnLogout) btnLogout.style.display = "none";
      return;
    }

    if (btnLogin) btnLogin.style.display = "none";
    if (btnLogout) btnLogout.style.display = "";

    await ensureUserDoc(user);
    const data = await getUserDoc(user.uid);

    // Header badges
    const uId = document.getElementById("uId");
    if (uId) uId.textContent = `ID: ${data.numericId ?? "—"}`;
    const uBal = document.getElementById("uBalance");
    if (uBal) uBal.textContent = `💵 ${data.balance ?? 0}`;
    const uG = document.getElementById("uGems");
    if (uG) uG.textContent = `💎 ${data.gems ?? 0}`;

    // Close login modal if open
    const authModal = document.getElementById("authModal");
    if (authModal) closeModal("#authModal");

    // Mandatory profile completion (basic)
    const need = !data.profile || !data.profile.firstName || !data.profile.lastName || !data.profile.dob;
    if (need && location.pathname !== "/profile.html") {
      location.href = "/profile.html";
    }
  });
}
boot();
