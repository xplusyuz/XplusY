// js/router.js — SPA router with init/destroy + CSS ensure
import { attachAuthUI, initUX } from "./common.js";

const app = document.getElementById("app");

const routes = {
  home:        "./partials/home.html",
  tests:       "./partials/tests.html",
  live:        "./partials/live.html",
  simulator:   "./partials/simulator.html",
  leaderboard: "./partials/leaderboard.html",
  settings:    "./partials/settings.html",
};

let currentTeardown = null;

async function ensureCSS(href) {
  try {
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
  const raw = (location.hash || "#/home").replace(/^#\/?/, "");
  const [pagePart] = raw.split("?");
  return (pagePart || "home").toLowerCase();
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

async function loadPage(page) {
  if (currentTeardown) { try { currentTeardown(); } catch (e) { console.warn("teardown error:", e); } currentTeardown = null; }

  const url = routes[page] || routes.home;
  app.innerHTML = `<div style="padding:20px"><div class="eh-note">Yuklanmoqda...</div></div>`;

  try {
    const html = await loadPartial(url);
    app.innerHTML = html;
  } catch (e) {
    app.innerHTML = `<div class="card"><h2>Yuklashda xato</h2><p>${e.message}</p></div>`;
    console.error(e);
    return;
  }

  try {
    if (page === "tests") {
      await ensureCSS("css/tests.css");
      const mod = await import("./tests.js");
      callInit(mod);
    } else if (page === "live") {
      await ensureCSS("css/live.css");
      const mod = await import("./live-csv.js");
      callInit(mod);
    } else if (page === "simulator") {
      await ensureCSS("css/simulator.css");
      const mod = await import("./simulator-csv.js");
      callInit(mod);
    } else if (page === "leaderboard") {
      const mod = await import("./leaderboard.js");
      callInit(mod);
    } else if (page === "settings") {
      const mod = await import("./settings.js");
      callInit(mod);
    } else if (page === "home") {
      await ensureCSS("css/home.css");
      const mod = await import("./home-csv.js").catch(()=>null);
      if (mod) callInit(mod);
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

window.addEventListener("hashchange", router);
window.addEventListener("DOMContentLoaded", () => {
  try { attachAuthUI?.({ requireSignIn: false }); } catch {}
  try { initUX && initUX(); } catch {}
  router();
});
