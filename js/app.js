// app.js — SPA router loading partials + header/footer/menu injection
function log(){ try{ console.debug.apply(console, arguments) }catch(_){} }
async function __boot(){

import { auth, onAuth, login, logout, ensureUser, db } from "./firebase.js";
import { initMenu, setActive } from "./menu.js";

// mount header/footer/menu
async function loadFragment(el, url){
  try{
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(url + " => " + res.status);
    el.innerHTML = await res.text();
  }catch(e){
    console.error("[fragment]", e);
    el.innerHTML = `<div class="card" style="margin:10px">Fragment yuklab bo'lmadi: <code>${url}</code><br/>${e?.message||e}</div>`;
  }
}

const header = document.getElementById("header");
const footer = document.getElementById("footer");
const menu = document.getElementById("menu");

await loadFragment(header, "header.html");
  const {{ initAuthUI }} = await import("./auth-ui.js");
  initAuthUI();
await loadFragment(footer, "footer.html");
await loadFragment(menu, "menu.html");

initMenu(); // initialize drawer

// counters + auth button wiring
const userIdEl = () => document.getElementById("userId");
const balanceEl = () => document.getElementById("balance");
const gemsEl = () => document.getElementById("gems");
const authBtn = () => document.getElementById("authBtn");

// auth button opens modal (handled in auth-ui.js)

onAuth(async (user) => {
  if (!user){
    if (authBtn()) authBtn().textContent = "Kirish";
    if (userIdEl()) userIdEl().textContent = "—";
    if (balanceEl()) balanceEl().textContent = "0";
    if (gemsEl()) gemsEl().textContent = "0";
    return;
  }
  if (authBtn()) authBtn().textContent = "Chiqish";
  const data = await ensureUser(user.uid, user);
  if (userIdEl()) userIdEl().textContent = data.numericId ?? "—";
  if (balanceEl()) balanceEl().textContent = data.balance ?? 0;
  if (gemsEl()) gemsEl().textContent = data.gems ?? 0;
});

// --- Router ---
const routes = [
  "home","tests","live","simulator","leaderboard",
  "courses","news","about","contact","profile"
];

function currentRoute(){
  const h = location.hash.replace(/^#\/?/, "");
  const [seg] = h.split("?");
  return routes.includes(seg) ? seg : "home";
}

async function render(){
  const page = currentRoute();
  setActive(page);
  const html = await fetch(`partials/${page}.html?ts=${Date.now()}`, { cache: "no-store" }).then(r=>r.text());
  const app = document.getElementById("app");
  app.innerHTML = html;
  app.scrollIntoView({ behavior:"smooth", block:"start" });
}

window.addEventListener("hashchange", render);
window.addEventListener("load", render);

// First paint: set default hash if empty (prevents empty state on first load)
if (!location.hash) location.hash = "#/home";

}
__boot().catch(e=>{console.error('[boot]', e); const app=document.getElementById('app'); if(app){app.innerHTML = `<div class='card'>Ilova ishga tushmadi: ${e?.message||e}</div>`}});
