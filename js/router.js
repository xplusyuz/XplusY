import { initApp } from './common.js';

const app = document.getElementById('app');
const sidePanel = document.getElementById('sidePanel');
const menuBtn = document.getElementById('menuBtn');
const spLogout = document.getElementById('spLogout');

menuBtn?.addEventListener('click', ()=> sidePanel.classList.toggle('open'));
spLogout?.addEventListener('click', ()=> window.appAPI?.signOut());

const routes = {
  home: 'partials/home.html',
  tests: 'partials/tests.html',
  live: 'partials/live.html',
  leaderboard: 'partials/leaderboard.html',
  wallet: 'partials/wallet.html',
  admin: 'partials/admin.html',
};

async function fetchHTML(url){
  const tpl = document.getElementById('tpl-loader');
  app.innerHTML = tpl?.innerHTML ?? '<div>...</div>';
  const res = await fetch(url, {cache:'no-cache'});
  return await res.text();
}

async function render(route){
  const path = routes[route] || routes.home;
  app.innerHTML = await fetchHTML(path);
  // attach page scripts
  const mod = await import(`./${route}.js`).catch(()=>({onMount:()=>{}}));
  mod.onMount?.();
}

window.addEventListener('hashchange', ()=>{
  const route = location.hash.replace('#/','') || 'home';
  render(route);
});

// First boot
await initApp();
const initial = location.hash.replace('#/','') || 'home';
render(initial);
