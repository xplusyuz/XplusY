// js/router.js
import { attachAuthUI, initUX } from "./common.js";

const app = document.getElementById("app");

const routes = {
  home: "./partials/home.html",
  tests: "./partials/tests.html",
  live: "./partials/live.html",
  simulator: "./partials/simulator.html",
  leaderboard: "./partials/leaderboard.html",
  settings: "./partials/settings.html",
};

async function loadPage(page) {
  const url = routes[page] || routes.home;
  try{
    const res = await fetch(url, { cache: "no-cache" });
    const html = await res.text();
    app.innerHTML = html;
  }catch(e){
    app.innerHTML = `<div class="card"><h2>Yuklashda xato</h2><p>${e.message}</p></div>`;
  }

  // Page-specific JS (lazy)
  if (page === "tests") {
    // CSS ni ulab qo'yamiz (bir marta)
    if (!document.querySelector('link[href*="css/tests.css"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "css/tests.css?v=4";      // cache-bust
      document.head.appendChild(link);
    }
    // MUHIM: init() ni chaqirish
    import("./tests.js?v=4").then(m => m.default.init());
  }
  if (page === "live") import("./live-csv.js");
  if (page === "simulator") import("./simulator-csv.js");
  if (page === "leaderboard") import("./leaderboard.js");
  if (page === "settings") import("./settings.js");
  if (page === "home") import("./home-csv.js");
}

function router() {
  const hash = (location.hash.replace("#", "") || "home");
  loadPage(hash);
}

window.addEventListener("hashchange", router);
window.addEventListener("DOMContentLoaded", () => {
  attachAuthUI({ requireSignIn: false });
  initUX && initUX();
  router();
});