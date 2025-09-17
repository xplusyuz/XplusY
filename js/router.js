// router.js — tiny hash‑based SPA router
import { attachAuthUI, initUX, isSignedIn, requireAuthOrModal, getCurrentUserData } from "./common.js";

const app = document.getElementById("app");
if (!app) console.error("[router] #app topilmadi — index.html markup tekshiring");

const routes = {
  home: () => `
    <section class="hero">
      <h1>MathCenter — matematika markazi</h1>
      <p class="sub">Tests • Live • Real‑time — hammasi bitta platformada.</p>
    </section>
    <div class="grid cards">
      <div class="card">
        <img class="hero" src="https://picsum.photos/seed/math1/1200/600" alt="Banner">
        <h3 style="margin-top:8px">DTM Maxsus Test</h3>
        <p class="sub">Boshlanish: tez orada • Kirish bepul</p>
        <p style="margin-top:6px"><a class="btn primary" href="#tests">Testlarga o'tish</a></p>
      </div>
      <div class="card">
        <h3>Reyting</h3>
        <p class="sub">Olmos bo'yicha TOP‑100</p>
        <p style="margin-top:6px"><a class="btn" href="#leaderboard">Ko'rish</a></p>
      </div>
      <div class="card">
        <h3>Balansni to‘ldirish</h3>
        <p class="sub">Click / Xazna havolalari, chek yuklash</p>
        <p style="margin-top:6px"><a class="btn" href="#topup">To‘ldirish</a></p>
      </div>
    </div>
  `,

  tests: () => `
    <section class="hero">
      <h1>Testlar</h1>
      <p class="sub">CSV orqali boshqariladigan testlar (soon). Hozircha demo.</p>
    </section>
    <div class="grid cards">
      <div class="card">
        <h3>DTM Demo</h3>
        <p class="sub">Har gal yechish 5 000 so'm • +olmos / −olmos tizimi</p>
        <p style="margin-top:6px"><a class="btn" href="#results">Demo natijalar</a></p>
      </div>
    </div>
  `,

  courses: () => `
    <section class="hero"><h1>Kurslar</h1><p class="sub">Tez orada</p></section>
  `,

  live: () => `
    <section class="hero"><h1>Live</h1><p class="sub">Real‑time musobaqalar — tez orada.</p></section>
  `,

  simulator: () => `
    <section class="hero"><h1>Simulator</h1><p class="sub">CSV dan turli simulyatorlar — tez orada.</p></section>
  `,

  leaderboard: () => `
    <section class="hero"><h1>Reyting</h1><p class="sub">Olmos bo'yicha TOP‑100 (demo)</p></section>
    <div class="card"><p>Tez orada Firestoredan jonli reyting.</p></div>
  `,

  profile: () => authGate(() => {
    const u = getCurrentUserData();
    return `
      <section class="hero"><h1>Profil</h1><p class="sub">Ma'lumotlarni to'ldiring</p></section>
      <div class="card">
        <p><b>ID:</b> ${u?.numericId ?? "—"}</p>
        <p><b>Balance:</b> ${u?.balance ?? 0}</p>
        <p><b>Gems:</b> ${u?.gems ?? 0}</p>
      </div>
    `;
  }),

  results: () => authGate(() => `
    <section class="hero"><h1>Natijalar</h1><p class="sub">Sizning yakunlangan testlaringiz (demo)</p></section>
    <div class="card"><p>Tez orada.</p></div>
  `),

  topup: () => authGate(() => `
    <section class="hero"><h1>Balansni to‘ldirish</h1><p class="sub">To'lov havolalari va chek yuklash</p></section>
    <div class="grid cards">
      <div class="card"><h3>Click</h3><p class="sub">Havola: indoor.click.uz</p></div>
      <div class="card"><h3>Xazna</h3><p class="sub">Havola: pay.xazna.uz</p></div>
      <div class="card"><h3>Chek yuklash</h3><p class="sub">Tez orada Storage orqali</p></div>
    </div>
  `),

  badges: () => `
    <section class="hero"><h1>Yutuqlar</h1><p class="sub">Badgellar tez orada.</p></section>
  `,

  promo: () => `
    <section class="hero"><h1>Promo</h1><p class="sub">Promokod va bonuslar tez orada.</p></section>
  `,

  admin: () => authGate(() => `
    <section class="hero"><h1>Admin</h1><p class="sub">Faqat adminlar uchun (demo)</p></section>
    <div class="card"><p>Panel tez orada.</p></div>
  `),
};

function authGate(renderFn){
  if (!isSignedIn()){
    requireAuthOrModal();
    return `<section class="hero"><h1>Kirish talab qilinadi</h1><p class="sub">Davom etish uchun tizimga kiring.</p></section>`;
  }
  return renderFn();
}

function render(route){
  const key = route || "home";
  const view = routes[key] || routes["home"];
  app.innerHTML = view();
  // focus for a11y
  app.focus({preventScroll:true});
  // bind auth buttons within the view
  attachAuthUI(app);
  // scroll to top on navigation
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// Hash router
function getRouteFromHash(){
  return (location.hash.replace(/^#/, "") || "home").split("?")[0];
}

function onHashChange(){
  render(getRouteFromHash());
}

window.addEventListener("hashchange", onHashChange);

// Boot
document.addEventListener("DOMContentLoaded", () => {
  render(getRouteFromHash());
  initUX();
});
