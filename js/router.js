// js/router.js — robust router (Home, Simulator, Leaderboard)
import { attachAuthUI, initUX } from "./common.js";

const app = document.getElementById("app");

// Mavjud sahifalar:
const routes = {
  home:        "partials/home.html",
  simulator:   "partials/simulator.html",
  leaderboard: "partials/leaderboard.html",

  courses:     "partials/courses.html",

  admin:       "partials/admin.html",
};

let currentTeardown = null;

/* ---- Utils ---- */
async function ensureCSS(href) {
  try {
    // allaqachon ulangan bo‘lsa — qaytamiz
    if ([...document.styleSheets].some(s => s.href && s.href.includes(href))) return;
  } catch {}
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}

async function loadPartial(url) {
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) throw new Error(`${url} yuklanmadi (${res.status})`);
  return res.text();
}

function parseRoute() {
  // "#/home?x=1" -> "home"
  const raw = (location.hash || "#/home").replace(/^#\/?/, "");
  const [name] = raw.split("?");
  return (name || "home").toLowerCase();
}

function callInit(mod) {
  const initFn =
    (typeof mod?.init === "function" && mod.init) ||
    (typeof mod?.default?.init === "function" && mod.default.init) ||
    (typeof mod?.default === "function" && mod.default) ||
    null;

  const destroyFn =
    (typeof mod?.destroy === "function" && mod.destroy) ||
    (typeof mod?.dispose === "function" && mod.dispose) ||
    (typeof mod?.default?.destroy === "function" && mod.default.destroy) ||
    (typeof mod?.default?.dispose === "function" && mod.default.dispose) ||
    null;

  if (initFn) initFn();
  currentTeardown = destroyFn || null;
}

/* ---- Core ---- */
async function loadPage(page) {
  // Avval eski sahifaning tozalash funksiyasi
  if (currentTeardown) {
    try { currentTeardown(); } catch (e) { console.warn("teardown error:", e); }
    currentTeardown = null;
  }

  const url = routes[page] || routes.home;
  app.innerHTML = `<div style="padding:20px"><div class="eh-note">Yuklanmoqda...</div></div>`;

  try {
    const html = await loadPartial(url);
    \1

    /* settings-modal removed */catch(e){} }
  } catch (e) {
    app.innerHTML = `<div class="eh-note danger" style="margin:16px">Sahifa yuklash xatosi: ${e.message}</div>`;
    console.error(e);
    return;
  }

  // Sahifa skriptlari + CSS
  try {
    if (page === "home") {
      await ensureCSS("css/home.css");
      const mod = await import("./home-csv.js");
      callInit(mod);
    } else if (page === "simulator") {
      await ensureCSS("css/simulator.css");
      const mod = await import("./simulator-csv.js");
      callInit(mod);
    } else if (page === "leaderboard") {
      await ensureCSS("css/leaderboard.css");
      const mod = await import("./leaderboard.js");
      callInit(mod);
    }
  } catch (e) {
    const msg = e?.message || String(e);
    const box = document.createElement("div");
    box.className = "eh-note";
    box.style.margin = "16px";
    box.style.borderColor = "#944";
    box.textContent = "Sahifa skriptini yuklashda xato: " + msg;
    app.prepend(box);
    console.error(e);
  }

  try { window.scrollTo({ top: 0, behavior: "instant" }); } catch {}
}

function router() {
  loadPage(parseRoute());
}

/* ---- Boot ---- */
window.addEventListener("hashchange", router);
window.addEventListener("DOMContentLoaded", () => {
  try { attachAuthUI?.({ requireSignIn: false }); } catch {}
  try { initUX && initUX(); } catch {}
  router();
});
