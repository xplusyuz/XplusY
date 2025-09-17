// router.js — v5 NO SETTINGS: every page is standalone (partials/*.html + js/*.js)
import { attachAuthUI, initUX } from "./common.js";

const app = document.getElementById("app");
if (!app) console.error("[router] #app topilmadi — index.html markup tekshiring");

const ROUTES = {
  home:        { html: "partials/home.html",        css: "css/home.css",        mod: "./js/home-csv.js" },
  tests:       { html: "partials/tests.html",       css: "css/tests.css",       mod: "./js/tests.js" },
  live:        { html: "partials/live.html",        css: "css/live.css",        mod: "./js/live-csv.js" },
  simulator:   { html: "partials/simulator.html",   css: "css/simulator.css",   mod: "./js/simulator-csv.js" },
  leaderboard: { html: "partials/leaderboard.html", css: "css/leaderboard.css", mod: "./js/leaderboard.js" },
  courses:     { html: "partials/courses.html",     css: "css/courses.css",     mod: "./js/courses.js" },

  // Standalone pages (former settings)
  profile:     { html: "partials/profile.html",     css: "css/settings.css",    mod: "./js/profile.js" },
  results:     { html: "partials/results.html",     css: "css/settings.css",    mod: "./js/results.js" },
  topup:       { html: "partials/topup.html",       css: "css/settings.css",    mod: "./js/topup.js" },
  badges:      { html: "partials/badges.html",      css: "css/settings.css",    mod: "./js/badges.js" },
  promo:       { html: "partials/promo.html",       css: "css/settings.css",    mod: "./js/promo.js" },
  admin:       { html: "partials/admin.html",       css: "css/settings.css",    mod: "./js/admin.js" },
};

let currentTeardown = null;

async function ensureCSS(href){
  if(!href) return;
  const clean = (x)=> (x||'').split('?')[0];
  const exists = Array.from(document.querySelectorAll('link[rel=\"stylesheet\"]'))
    .some(l => clean(l.getAttribute('href')) === href);
  if (exists) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href + '?v=' + Date.now();
  document.head.appendChild(link);
}
async function loadHTML(url){
  try{
    const u = url + (url.includes('?')?'&':'?') + 'v=' + Date.now();
    const res = await fetch(u, { cache:'no-store' });
    if(!res.ok) throw new Error(res.status + ' ' + res.statusText);
    return await res.text();
  }catch(e){
    console.warn('[router] partial yuklanmadi:', url, e.message);
    return `<div class=\"eh-note\" style=\"margin:16px;border:1px solid #944;padding:12px;border-radius:12px\">
      <b>Sahifa yuklanmadi</b><br><small>${url}</small><br>${e.message}</div>`;
  }
}
function callInitAndTeardown(mod){
  try{
    const ent = (mod && (mod.default||mod)) || null;
    if(ent && typeof ent.init === 'function'){ ent.init(app); }
    if(ent && typeof ent.destroy === 'function'){ currentTeardown = ent.destroy; }
    else if (typeof mod?.teardown === 'function'){ currentTeardown = mod.teardown; }
    else currentTeardown = null;
  }catch(e){
    console.warn('[router] init/destroy chaqirishda xato:', e);
  }
}
function pageFromHash(){ return (location.hash || '#home').replace(/^#/, '') || 'home'; }

export async function navigate(){
  try{
    const page = pageFromHash();
    const cfg = ROUTES[page] || ROUTES.home;

    try{ if(typeof currentTeardown === 'function') currentTeardown(); }catch{}

    const html = await loadHTML(cfg.html);
    app.innerHTML = html;

    try{ initUX?.(); attachAuthUI?.(); }catch{}

    if(cfg.css) await ensureCSS(cfg.css);
    if(cfg.mod){
      try{ const mod = await import(cfg.mod); callInitAndTeardown(mod); }
      catch(e){ console.warn('[router] modul import qilinmadi:', cfg.mod, e.message); currentTeardown = null; }
    } else currentTeardown = null;
  }catch(e){
    console.error('[router] navigate xatosi:', e);
  }
}

// Global API for FAB / other scripts
if(!window.router){
  window.router = {
    go(p){ const path = (p||'').replace(/^#/, ''); if(location.hash !== '#'+path) location.hash = '#'+path; else window.dispatchEvent(new HashChangeEvent('hashchange')); },
    navigate,
  };
}

if(!window.__routerBound){
  window.addEventListener('hashchange', navigate, { passive:true });
  document.addEventListener('DOMContentLoaded', navigate, { once:true });
  window.__routerBound = true;
  console.log('[router] bound (v5 no-settings)');
}

window.__navigate = navigate;
