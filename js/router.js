// router.js — Partial-driven SPA with route modules (isolated)
import { attachAuthUI, initUX, isSignedIn, requireAuthOrModal } from "./common.js";

const app = document.getElementById("app");
if(!app) console.error("[router] #app not found");

const ROUTES = {
  home:        { partial: "partials/home.html" },
  tests:       { partial: "partials/tests.html" },
  courses:     { partial: "partials/courses.html" },
  live:        { partial: "partials/live.html" },
  simulator:   { partial: "partials/simulator.html" },
  leaderboard: { partial: "partials/leaderboard.html" },
  profile:     { partial: "partials/profile.html", auth: true },
  results:     { partial: "partials/results.html", auth: true },
  topup:       { partial: "partials/topup.html", auth: true },
  badges:      { partial: "partials/badges.html" },
  promo:       { partial: "partials/promo.html" },
  admin:       { partial: "partials/admin.html", auth: true },
};

// Route -> module (relative to this file)
const ROUTE_MODULES = {
  home:        "./home.js",
  tests:       "./tests.js",
  courses:     "./courses.js",
  live:        "./live.js",
  simulator:   "./simulator.js",
  leaderboard: "./leaderboard.js",
  profile:     "./profile.js",
  results:     "./results.js",
  topup:       "./topup.js",
  badges:      "./badges.js",
  promo:       "./promo.js",
  admin:       "./admin.js",
};

let _activeMod=null;

function getRouteFromHash(){ const h=(location.hash||"#home").slice(1); return (h.split("?")[0]||"home"); }

async function fetchText(url){
  const abs = new URL(url, location.href).toString();
  const bust = abs.includes("?") ? "&" : "?";
  const res = await fetch(abs + bust + "v=" + Date.now(), { cache: "no-store" });
  if(!res.ok) throw new Error(`[partials] Yuklab bo'lmadi: ${url} (${res.status})`);
  return await res.text();
}

function authGate(cfg){
  if(!cfg?.auth) return true;
  if(isSignedIn()) return true;
  requireAuthOrModal();
  app.innerHTML = `<section class="page"><h2 class="page-title">Kirish talab qilinadi</h2><div class="card">Davom etish uchun tizimga kiring.</div></section>`;
  attachAuthUI(app);
  return false;
}

async function unmountActive(){ try{ if(_activeMod?.destroy) await _activeMod.destroy(); }catch{} _activeMod=null; }
async function mountModuleFor(route){
  const modPath = ROUTE_MODULES[route];
  if(!modPath) return;
  try{
    const m = await import(modPath + "?v=" + Date.now());
    _activeMod = m?.default || m;
    if(_activeMod?.init) await _activeMod.init();
  }catch(e){ console.warn("[router] modul yuklanmadi:", modPath, e); }
}

async function render(route){
  const key = ROUTES[route] ? route : "home";
  const cfg = ROUTES[key];
  await unmountActive();
  if(!authGate(cfg)) return;
  try{
    const html = await fetchText(cfg.partial);
    const host = document.createElement("div");
    host.className = `route route-${key}`;
    host.setAttribute("data-route", key);
    host.innerHTML = html;
    app.innerHTML = "";
    app.appendChild(host);
    attachAuthUI(app);
    ensureRouteCSS(key);
    await mountModuleFor(key);
    app.focus({preventScroll:true});
    window.scrollTo({top:0, behavior:"smooth"});
  }catch(err){
    console.error("[router] xato:", err);
    app.innerHTML = `<section class="page"><h2 class="page-title" style="color:#21c26e">404</h2><div class="sub">Sahifa topilmadi yoki yuklashda xato: <code>${cfg.partial}</code></div></section>`;
  }
}

function ensureRouteCSS(route){
  const href = `./css/${route}.css`;
  const exists = [...document.head.querySelectorAll('link[rel="stylesheet"]')].some(l=>l.getAttribute("href")===href);
  if(!exists){ const l=document.createElement("link"); l.rel="stylesheet"; l.href=href+"?v="+Date.now(); document.head.appendChild(l); }
}

function onHashChange(){ render(getRouteFromHash()); }
window.addEventListener("hashchange", onHashChange);

document.addEventListener("DOMContentLoaded", ()=>{ render(getRouteFromHash()); initUX(); });
