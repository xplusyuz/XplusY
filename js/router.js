import { toggleAdminUI } from './common.js';
const routes={
  home:{ file:'partials/home.html', js:()=>import('./views/home.js') },
  tests:{ file:'partials/tests.html', js:()=>import('./views/tests.js') },
  live:{ file:'partials/live.html', js:()=>import('./views/live.js') },
  leaderboard:{ file:'partials/leaderboard.html', js:()=>import('./views/leaderboard.js') },
  wallet:{ file:'partials/wallet.html', js:()=>import('./views/wallet.js') },
  admin:{ file:'partials/admin.html', js:()=>import('./views/admin.js') },
};
async function loadPartial(p){ const r=await fetch(p,{cache:'no-store'}); if(!r.ok) throw new Error('Partial yuklanmadi: '+p); return await r.text(); }
function activateNav(route){ document.querySelectorAll('.nav-item').forEach(a=> a.classList.toggle('active', a.getAttribute('data-route')===route)); }
export function startRouter(){
  async function render(){ const route=(location.hash||'#/home').replace('#/',''); const def=routes[route]||routes.home; try{ const html=await loadPartial(def.file); const app=document.getElementById('app'); app.innerHTML=html; const mod=await def.js(); await (mod.mount?.() ?? mod.default?.()); activateNav(route); toggleAdminUI(); }catch(e){ document.getElementById('app').innerHTML=`<div class="card">Yuklash xatosi: ${e.message}</div>`; } }
  window.addEventListener('hashchange', render); render();
}
