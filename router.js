// router.js — hash-based SPA router (eng ixcham)

const ROUTES = new Set(["home","tests","live","leaderboard","about"]);
const APP_SEL = "#app";
const DEF = "home";

async function getPartial(route){
  const tpl = document.querySelector(`#tpl-${route}`);
  if (tpl) return tpl.innerHTML;
  const res = await fetch(`./partials/${route}.html`, {cache:"no-store"});
  if (!res.ok) throw new Error("partial not found");
  return await res.text();
}
function norm(h){ const r=(h||"").replace(/^#/,"")||DEF; return ROUTES.has(r)?r:DEF; }

async function render(route){
  const app=document.querySelector(APP_SEL); if(!app) return console.error("[router] #app yo‘q");
  try{
    app.innerHTML = await getPartial(route);

    // panel link → panelni yopish
    document.querySelectorAll("[data-panel-link]").forEach(a=>{
      a.addEventListener("click", ()=> (typeof window.closePanel==="function") ? window.closePanel() : null);
    });

    // CSV bannerlar
    if (typeof window.hydrateCsvBanners==="function") await window.hydrateCsvBanners();

    // After-route hooklar
    if (Array.isArray(window.__afterRouteHooks)) for (const fn of window.__afterRouteHooks) try{ await fn(route); }catch(e){ console.warn("[router] afterRoute:",e); }
  }catch(e){
    app.innerHTML = `<div class="card" style="padding:16px; border:1px solid rgba(255,255,255,.08); border-radius:14px;">
      <h3 style="margin-top:0">Sahifa topilmadi</h3><p class="muted">partials/${route}.html mavjud emas.</p></div>`;
  }
}
async function onHash(){ await render(norm(location.hash)); }

export const Router={ init(){ onHash(); addEventListener("hashchange", onHash); }, goto(h){ location.hash=h.startsWith("#")?h:"#"+h; } };
(document.readyState==="loading")?document.addEventListener("DOMContentLoaded",()=>Router.init()):Router.init();
