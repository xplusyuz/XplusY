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
  home:        "./home-csv.js",
  tests:       "./tests.js",
  courses:     "./courses-csv.js",
  live:        "./live-csv.js",
  simulator:   "./simulator-csv.js",
  leaderboard: "./leaderboard.js",
  profile:     "./profile.js",
  results:     "./results.js",
  topup:       "./topup.js",
  badges:      "./badges.js",
  promo:       "./promo.js",
  admin:       "./admin.js",
};
let _activeMod = null;

// --- Route-scoped CSS loader ---
// Prefixes (naively) all simple selectors with .route-<name> to keep styles inside the partial only.
async function ensureRouteScopedCSS(route){
  const href = `./css/${route}.css`;
  // remove old styles for other routes
  document.querySelectorAll('style[data-route-style]').forEach(st => {
    if (st.getAttribute('data-route-style') !== route) st.remove();
  });
  try {
    const res = await fetch(href, { cache: "no-store" });
    if (!res.ok) return; // silently skip if not found
    const css = await res.text();
    const scoped = scopeCSS(css, `.route-${route}`);
    const st = document.createElement("style");
    st.setAttribute("data-route-style", route);
    st.textContent = scoped;
    document.head.appendChild(st);
  } catch {}
}

function scopeCSS(css, prefix){
  // Very lightweight scoper: handles regular rules and @media/@supports blocks.
  // Leaves @keyframes and @font-face as-is.
  const lines = css.split(/(?<=\})/g);
  const scoped = lines.map(block => {
    if (!block.trim()) return block;
    if (/@(keyframes|font-face)/.test(block)) return block; // keep global
    if (/^@media|^@supports/i.test(block.trim())){
      // prefix inner selectors between { ... }
      return block.replace(/\{([\s\S]*?)\}/g, (m, inner) => `{${prefixSelectors(inner, prefix)}}`);
    }
    return prefixSelectors(block, prefix);
  }).join("");
  return scoped;
}

function prefixSelectors(cssChunk, prefix){
  // Add prefix before each selector (naive: splits by } or , within rule prelude)
  return cssChunk.replace(/(^|}|;)\s*([^{@}][^{]*?)\s*\{/g, (m, p1, sel) => {
    // keep HTML/Body root selectors from affecting outside by prefixing them too
    const scopedSel = sel.split(',').map(s => {
      s = s.trim();
      if (!s) return s;
      // don't prefix with :root or @..
      return `${prefix} ${s}`;
    }).join(', ');
    return `${p1} ${scopedSel} {`;
  });
}

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




function ensureRouteCSS(route){
  const href = `./css/${route}.css`;
  const already = [...document.head.querySelectorAll('link[rel="stylesheet"]')].some(l => l.getAttribute('href') === href);
  if (!already){
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = href + `?v=${Date.now()}`;
    document.head.appendChild(l);
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
