// js/router.js
// SPA router: partials yuklash + sahifa modullarini lazy-import
import { attachAuthUI, initUX } from "./common.js";

const app = document.getElementById("app");

// Sahifa -> partial yo‘li
const routes = {
  home:        "./partials/home.html",
  tests:       "./partials/tests.html",
  live:        "./partials/live.html",
  simulator:   "./partials/simulator.html",
  leaderboard: "./partials/leaderboard.html",
  settings:    "./partials/settings.html",
};

// Kichik yordamchilar
async function ensureCSS(href) {
  // allaqachon ulangan bo‘lsa, qaytib ketamiz
  const exists = [...document.styleSheets].some(s => s.href && s.href.includes(href));
  if (exists) return;
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
  // "#/tests?src=..." -> { page:"tests", qs:"src=..." }
  const raw = (location.hash || "#/home").replace(/^#\/?/, "");
  const [pagePart, qs = ""] = raw.split("?");
  const page = (pagePart || "home").toLowerCase();
  return { page, qs };
}

async function loadPage(page) {
  const url = routes[page] || routes.home;

  // Loading placeholder (ixtiyoriy)
  app.innerHTML = `
    <div style="padding:20px">
      <div class="eh-note">Yuklanmoqda...</div>
    </div>
  `;

  try {
    const html = await loadPartial(url);
    app.innerHTML = html;
  } catch (e) {
    app.innerHTML = `<div class="card"><h2>Yuklashda xato</h2><p>${e.message}</p></div>`;
    console.error(e);
    return;
  }

  // Sahifaga mos CSS va JS
  try {
    if (page === "tests") {
      await ensureCSS("css/tests.css");
      const mod = await import("./tests.js");
      mod.default?.init?.();
    } else if (page === "live") {
      await ensureCSS("css/live.css");
      const mod = await import("./live-csv.js");
      mod.default?.init?.();
    } else if (page === "simulator") {
      const mod = await import("./simulator-csv.js");
      mod.default?.init?.();
    } else if (page === "leaderboard") {
      const mod = await import("./leaderboard.js");
      mod.default?.init?.();
    } else if (page === "settings") {
      const mod = await import("./settings.js");
      mod.default?.init?.();
    } else if (page === "home") {
      const mod = await import("./home-csv.js");
      mod.default?.init?.();
    }
  } catch (e) {
    // Modul xatosi bo‘lsa, foydali xabar chiqaramiz
    const msg = (e && e.message) ? e.message : String(e);
    const box = document.createElement("div");
    box.className = "eh-note";
    box.style.margin = "16px";
    box.style.borderColor = "#944";
    box.textContent = "Sahifa skriptini yuklashda xato: " + msg;
    app.prepend(box);
    console.error(e);
  }

  // Har safar tepaga scroll
  try { window.scrollTo({ top: 0, behavior: "instant" }); } catch {}
}

function router() {
  const { page } = parseRoute();
  loadPage(page);
}

window.addEventListener("hashchange", router);
window.addEventListener("DOMContentLoaded", () => {
  attachAuthUI?.({ requireSignIn: false });
  initUX && initUX();
  router();
});
