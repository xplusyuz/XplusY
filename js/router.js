// router.js — SPA router with nested 'settings/*' partials + default-export aware
import { attachAuthUI, initUX } from "./common.js";

const app = document.getElementById("app");
if (!app) console.error("[router] #app topilmadi — index.html markup tekshiring");

// Page -> [css, module]
const PAGE_META = {
  home:        { css: "css/home.css",        mod: "./home-csv.js" },
  tests:       { css: "css/tests.css",       mod: "./tests.js" },
  live:        { css: "css/live.css",        mod: "./live-csv.js" },
  simulator:   { css: "css/simulator.css",   mod: "./simulator-csv.js" },
  leaderboard: { css: "css/leaderboard.css", mod: "./leaderboard.js" },
  // 'settings/*' handled specially below
};

let currentTeardown = null;

async function ensureCSS(href){
  if(!href) return;
  const clean = (x)=> (x||"").split("?")[0];
  const exists = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
    .some(l => clean(l.getAttribute('href')) === href);
  if (exists) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href + "?v=" + Date.now();
  document.head.appendChild(link);
}

async function loadHTML(url){
  try{
    const u = url + (url.includes("?")?"&":"?") + "v=" + Date.now();
    const res = await fetch(u, { cache:"no-store" });
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

function parseHash(){
  // "#settings/profile?x=1" => {page:"settings", sub:"profile"}
  const raw = (location.hash || "#home").replace(/^#/, "");
  const [path] = raw.split("?");
  const [page, sub] = path.split("/");
  return { page: page || "home", sub: sub || null };
}

async function navigate(){
  try{
    const { page, sub } = parseHash();

    // run teardown of previous view
    try{ if(typeof currentTeardown === "function") currentTeardown(); }catch{}

    let htmlPath = "";
    let css = "";
    let modPath = "";

    if(page === "settings"){
      // Nested settings/* partials
      const leaf = sub || "index";
      htmlPath = `partials/settings/${leaf}.html`;
      css = "css/settings.css";
      modPath = "./settings.js";
    } else if (page === "profile") {
      // Backward compatibility: old '#profile' goes to settings/profile
      htmlPath = "partials/settings/profile.html";
      css = "css/settings.css";
      modPath = "./settings.js";
    } else {
      // Regular pages
      htmlPath = `partials/${page}.html`;
      css = PAGE_META[page]?.css || "";
      modPath = PAGE_META[page]?.mod || "";
    }

    const html = await loadHTML(htmlPath);
    app.innerHTML = html;

    try{ initUX?.(); attachAuthUI?.(); }catch{}

    if(css) await ensureCSS(css);

    if (modPath) {
      try {
        const mod = await import(modPath);
        // Special initializer mapping for settings/*
        if (modPath.endsWith("settings.js") && (window.Settings || mod?.Settings)) {
          const S = window.Settings || mod.Settings;
          const map = {
            index: "initIndex",
            profile: "initProfile",
            results: "initResults",
            topup: "initTopup",
            badges: "initBadges",
            promo: "initPromo",
            admin: "initAdmin",
          };
          const leaf = (page === "profile") ? "profile" : (sub || "index");
          const fn = map[leaf];
          if (typeof S?.[fn] === "function") S[fn]();
          currentTeardown = null; // Settings API uses idempotent inits
        } else {
          // default-export aware init/destroy
          callInitAndTeardown(mod);
        }
      } catch (e) {
        console.warn("[router] modul import qilinmadi:", modPath, e.message);
      }
    } else {
      currentTeardown = null;
    }

  }catch(e){
    console.error("[router] navigate xatosi:", e);
  }
}

// Public small API so other scripts can navigate (FAB uses router.go)
if(!window.router){
  window.router = {
    go(p){
      const path = (p||"").replace(/^#/, "");
      if(location.hash !== "#"+path) location.hash = "#"+path;
      else window.dispatchEvent(new HashChangeEvent("hashchange"));
    },
    navigate, // optional direct call
  };
}

if(!window.__routerBound){
  window.addEventListener("hashchange", navigate, { passive:true });
  document.addEventListener("DOMContentLoaded", navigate, { once:true });
  window.__routerBound = true;
  console.log("[router] bound (v3 settings/* aware)");
}

window.__navigate = navigate;
