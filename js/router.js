// router.js — Partial-driven SPA (hash-based)
import { attachAuthUI, initUX, isSignedIn, requireAuthOrModal } from "./common.js";

const app = document.getElementById("app");
if (!app) console.error("[router] #app topilmadi — index.html markup tekshiring");

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

// Map route -> module path (ESM default export with optional {init, destroy})
const ROUTE_MODULES = {
  home:        "./js/home-csv.js",
  tests:       "./js/tests.js",
  courses:     "./js/courses-csv.js",
  live:        "./js/live-csv.js",
  simulator:   "./js/simulator-csv.js",
  leaderboard: "./js/leaderboard.js",
  profile:     "./js/profile.js",
  results:     "./js/results.js",
  topup:       "./js/topup.js",
  badges:      "./js/badges.js",
  promo:       "./js/promo.js",
  admin:       "./js/admin.js",
};
let _activeMod = null;
async function mountModuleFor(route){
  const modPath = ROUTE_MODULES[route];
  if (!modPath) return;
  try {
    const m = await import(modPath + "?v=" + Date.now());
    _activeMod = m?.default || m;
    if (_activeMod?.init) await _activeMod.init();
  } catch (e){
    console.warn("[router] Modul yuklash imkoni bo'lmadi:", modPath, e);
  }
}
async function unmountActive(){
  try { if (_activeMod?.destroy) await _activeMod.destroy(); } catch {}
  _activeMod = null;
}



function getRouteFromHash(){
  const h = (location.hash || "#home").slice(1);
  const [name] = h.split("?");
  return name || "home";
}

async function fetchText(url){
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`[partials] Yuklab bo'lmadi: ${url} (${res.status})`);
  return await res.text();
}

function dedupeLink(href){
  const links = [...document.head.querySelectorAll('link[rel="stylesheet"]')];
  return links.some(l => l.getAttribute("href") === href);
}

function execScriptsFrom(container){
  const scripts = [...container.querySelectorAll("script")];
  for (const old of scripts){
    const s = document.createElement("script");
    if (old.type) s.type = old.type;
    if (old.src){
      s.src = old.getAttribute("src");
      s.async = false;
    } else {
      s.textContent = old.textContent;
    }
    old.replaceWith(s);
  }
}

function hoistHeadAssetsFrom(container){
  // Move <link rel="stylesheet"> to <head> (dedupe by href)
  const links = [...container.querySelectorAll('link[rel="stylesheet"]')];
  for (const l of links){
    const href = l.getAttribute("href");
    if (!href) continue;
    if (!dedupeLink(href)){
      const newL = document.createElement("link");
      newL.rel = "stylesheet";
      newL.href = href;
      document.head.appendChild(newL);
    }
    l.remove();
  }
  // Inline <style> blocks — append to head to ensure precedence
  const styles = [...container.querySelectorAll("style")];
  for (const st of styles){
    const clone = document.createElement("style");
    clone.textContent = st.textContent;
    document.head.appendChild(clone);
    st.remove();
  }
}

function authGate(routeCfg){
  if (!routeCfg?.auth) return true;
  if (isSignedIn()) return true;
  requireAuthOrModal();
  app.innerHTML = `
    <section class="hero"><h1>Kirish talab qilinadi</h1>
      <p class="sub">Davom etish uchun tizimga kiring.</p>
    </section>`;
  attachAuthUI(app);
  return false;
}

async function render(route){
  const key = ROUTES[route] ? route : "home";
  await unmountActive();
  const cfg = ROUTES[key];

  if (!authGate(cfg)) return;

  try {
    const html = await fetchText(cfg.partial);
    // Parse to DOM fragment
    const wrapper = document.createElement("div");
    wrapper.innerHTML = html;

    // Hoist CSS/STYLE from partial to document head, then set content
    hoistHeadAssetsFrom(wrapper);

    // Replace app content
    app.innerHTML = "";
    // Move only the body children or all content
    const nodes = [...wrapper.childNodes];
    nodes.forEach(n => app.appendChild(n));

    // Execute scripts inside the partial (including type="module")
    execScriptsFrom(app);

    // Bind auth buttons within the partial
    attachAuthUI(app);

    await mountModuleFor(key);

    // Focus + scroll top
    app.focus({preventScroll:true});
    window.scrollTo({ top: 0, behavior: "smooth" });

  } catch (err){
    console.error("[router] partial yuklash xatosi:", err);
    app.innerHTML = `
      <section class="hero"><h1>404</h1>
        <p class="sub">Sahifa topilmadi yoki yuklashda xato: <code>${cfg.partial}</code></p>
      </section>`;
  }
}

function onHashChange(){ render(getRouteFromHash()); }

window.addEventListener("hashchange", onHashChange);

document.addEventListener("DOMContentLoaded", () => {
  render(getRouteFromHash());
  initUX();
});
