// router.js
const ROUTES = ["home","courses","tests","simulators","results","profile"];
const app = document.getElementById("app");

// Helpers
const partialUrl = (name)=> `partials/${name}.html?v=${Date.now()}`;

// Load partial (network-first; SW will cache)
async function loadPartial(route){
  try{
    const res = await fetch(partialUrl(route), {cache:"no-store"});
    if(!res.ok) throw new Error("Request failed");
    return await res.text();
  }catch(err){
    return `<div class="content" style="padding:16px;">
      <h2 style="margin:0.2rem 0;">${route}</h2>
      <p>Namuna sahifa (fallback).</p>
    </div>`;
  }
}

// Active state for FAB menu (uses your existing classes)
function setActive(route){
  document.querySelectorAll('.fab-menu .chip')
    .forEach(b=> b.classList.toggle('active', b.getAttribute('data-route')===route));
}

// Navigate
export async function navigate(route){
  if(!ROUTES.includes(route)) route = "home";
  const html = await loadPartial(route);
  app.innerHTML = html;
  setActive(route);
  history.replaceState({route}, "", `#${route}`);
  window.scrollTo({top:0, behavior:"smooth"});
  // Re-run any per-partial setup if your project has it:
  if(typeof window.onPartialLoaded === "function"){
    try { window.onPartialLoaded(route); } catch(e){}
  }
}

// Hash listener
window.addEventListener("hashchange", ()=>{
  const r = (location.hash || "#home").slice(1);
  navigate(r);
});

// Prefetch on hover for faster UX
document.addEventListener("mouseover", (e)=>{
  const btn = e.target.closest(".chip[data-route]");
  if(!btn) return;
  const r = btn.getAttribute("data-route");
  if(btn._prefetched) return;
  btn._prefetched = true;
  fetch(partialUrl(r)).catch(()=>{});
});

// Click handler for FAB
document.querySelector(".fab-menu")?.addEventListener("click", (e)=>{
  const btn = e.target.closest(".chip[data-route]");
  if(!btn) return;
  e.preventDefault();
  const r = btn.getAttribute("data-route");
  navigate(r);
});

// Boot
document.addEventListener("DOMContentLoaded", ()=>{
  const start = (location.hash || "#home").slice(1) || "home";
  navigate(start);
});