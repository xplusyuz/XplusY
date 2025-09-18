// router.js — minimal SPA router for hash-based partials
// Author: XplusY

const ROUTES = new Set(["home","tests","live","leaderboard","about"]);
const DEFAULT_ROUTE = "home";
const APP_SELECTOR = "#app";

async function fetchPartial(route) {
  // 1) <template id="tpl-*> mavjud bo'lsa, bevosita undan foydalanamiz (tezkor)
  const tpl = document.querySelector(`#tpl-${route}`);
  if (tpl) return tpl.innerHTML;

  // 2) Aks holda networkdan yuklaymiz
  const url = `./partials/${route}.html`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Partial not found: ${url}`);
  return await res.text();
}

function normalizeHash(hash) {
  const h = (hash || "").replace(/^#/, "") || DEFAULT_ROUTE;
  return ROUTES.has(h) ? h : DEFAULT_ROUTE;
}

async function render(route) {
  const app = document.querySelector(APP_SELECTOR);
  if (!app) {
    console.error(`[router] ${APP_SELECTOR} topilmadi`);
    return;
  }

  try {
    const html = await fetchPartial(route);
    app.innerHTML = html;

    // Side-panel linklari bosilganda panelni yopish
    document.querySelectorAll("[data-panel-link]").forEach(a => {
      a.addEventListener("click", () => {
        const side = document.querySelector("#sidePanel");
        if (side) side.setAttribute("aria-hidden", "true");
        const menuBtn = document.querySelector("#menuBtn");
        if (menuBtn) menuBtn.setAttribute("aria-expanded", "false");
        document.body.style.overflow = "";
      });
    });

    // CSV bannerlarni jonlantirish (agar global funksiya bor bo'lsa)
    if (typeof window.hydrateCsvBanners === "function") {
      try { await window.hydrateCsvBanners(); } catch (e) { console.warn("[router] hydrateCsvBanners xato:", e); }
    }

    // After-route hooklar (ixtiyoriy)
    // window.__afterRouteHooks = [fn1, fn2, ...]
    if (Array.isArray(window.__afterRouteHooks)) {
      for (const fn of window.__afterRouteHooks) {
        try { await fn(route); } catch (e) { console.warn("[router] afterRoute hook xato:", e); }
      }
    }
  } catch (err) {
    console.error("[router] render xato:", err);
    app.innerHTML = `
      <div class="card" style="padding:16px; border:1px solid rgba(255,255,255,.08); border-radius:14px;">
        <h3 style="margin-top:0">Sahifa topilmadi</h3>
        <p class="muted">partials/${route}.html mavjud emas.</p>
      </div>`;
  }
}

async function onHashChange() {
  const route = normalizeHash(location.hash);
  await render(route);
}

export const Router = {
  init() {
    // birinchi yuklash
    onHashChange();
    // hash o'zgarishlarini eshitish
    window.addEventListener("hashchange", onHashChange);

    // (ixtiyoriy) ichki <a href="#..."> linklarni SPA tarzida ishlatish
    document.addEventListener("click", (e) => {
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;
      // browser default’i ham ishlaydi, lekin bu yerda future hooklar uchun joy qoldirildi
    });
  },
  navigate(hash) {
    location.hash = hash.startsWith("#") ? hash : `#${hash}`;
  }
};

// Auto-init, agar module sifatida qo'shilsa va body yuklangan bo'lsa
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => Router.init());
} else {
  Router.init();
}
