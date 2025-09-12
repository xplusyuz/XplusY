// router.js — fail‑safe SPA router (default‑export aware)
import { attachAuthUI, initUX } from "./common.js";

const app = document.getElementById("app");
if (!app) console.error("[router] #app topilmadi — index.html markup tekshiring");

const routes = {
  home:        "partials/home.html",
  tests:       "partials/tests.html",
  live:        "partials/live.html",
  simulator:   "partials/simulator.html",
  leaderboard: "partials/leaderboard.html",
  settings:    "partials/settings.html",
  profile:     "partials/profile.html",

  admin:     "partials/admin.html",
};

let currentTeardown = null;

async function ensureCSS(href){
  if(!href) return;
  const exists = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
    .some(l => (l.getAttribute('href')||'').split('?')[0] === href);
  if (exists) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href + "?v=" + Date.now();
  document.head.appendChild(link);
}

async function loadHTML(url){
  try{
    const res = await fetch(url + (url.includes("?")?"&":"?") + "v=" + Date.now(), { cache:"no-store" });
    if(!res.ok) throw new Error(res.status + " " + res.statusText);
    return await res.text();
  }catch(e){
    console.warn("[router] partial yuklanmadi:", url, e.message);
    return `<div class="eh-note" style="margin:16px;border:1px solid #944;padding:12px;border-radius:12px">
      <b>Sahifa yuklanmadi</b><br><small>${url}</small><br>${e.message}</div>`;
  }
}

function callInitAndTeardown(mod){
  try{
    const ent = (mod && (mod.default||mod)) || null;
    if(ent && typeof ent.init === "function"){ ent.init(app); }
    if(ent && typeof ent.destroy === "function"){ currentTeardown = ent.destroy; }
    else if (typeof mod?.teardown === "function"){ currentTeardown = mod.teardown; }
    else currentTeardown = null;
  }catch(e){
    console.warn("[router] init/destroy chaqirishda xato:", e);
  }
}

async function navigate(){
  try{
    const page = (location.hash || "#home").replace(/^#/, "");
    const htmlPath = routes[page] || routes.home;

    try{ if(typeof currentTeardown === "function") currentTeardown(); }catch{}

    const html = await loadHTML(htmlPath);
    app.innerHTML = html;

    try{ initUX?.(); attachAuthUI?.(); }catch{}

    const opt = {
      home:        { css: "css/home.css",        mod: "./home-csv.js" },
      tests:       { css: "css/tests.css",       mod: "./tests.js" },
      live:        { css: "css/live.css",        mod: "./live-csv.js" },
      simulator:   { css: "css/simulator.css",   mod: "./simulator-csv.js" },
      leaderboard: { css: "css/leaderboard.css", mod: "./leaderboard.js" },
      settings:    { css: "css/settings.css",    mod: "./settings.js" },
      profile:     { css: "css/profile.css",     mod: "./profile.js" },
    }[page];

    if(opt?.css) await ensureCSS(opt.css);
    if(opt?.mod){
      try{ const mod = await import(opt.mod); callInitAndTeardown(mod); }
      catch(e){ console.warn("[router] modul import qilinmadi:", opt.mod, e.message); }
    } else currentTeardown = null;
  }catch(e){
    console.error("[router] navigate xatosi:", e);
  }
}

if(!window.__routerBound){
  window.addEventListener("hashchange", navigate, { passive:true });
  document.addEventListener("DOMContentLoaded", navigate, { once:true });
  window.__routerBound = true;
  console.log("[router] bound (v2 default‑export aware)");
}

window.__navigate = navigate;
