import { state } from './common.js';

const routes = {
  home: { file: 'partials/home.html', js: () => import('./views/home.js') },
  tests: { file: 'partials/tests.html', js: () => import('./views/tests.js') },
  live: { file: 'partials/live.html', js: () => import('./views/live.js') },
  leaderboard: { file: 'partials/leaderboard.html', js: () => import('./views/leaderboard.js') },
  wallet: { file: 'partials/wallet.html', js: () => import('./views/wallet.js') },
  admin: { file: 'partials/admin.html', js: () => import('./views/admin.js') },
};

async function loadPartial(path){
  const res = await fetch(path, {cache:'no-store'});
  if (!res.ok) throw new Error('Partial yuklanmadi: '+path);
  return await res.text();
}

function activateNav(route){
  document.querySelectorAll('.nav-item').forEach(a => {
    a.classList.toggle('active', a.getAttribute('data-route') === route);
  });
}

export function startRouter(){
  async function render(){
    const hash = location.hash || '#/home';
    const route = hash.replace('#/','');
    const def = routes[route] || routes.home;
    try{
      const html = await loadPartial(def.file);
      document.getElementById('app').innerHTML = html;
      const mod = await def.js();
      await (mod.mount?.() ?? mod.default?.());
      activateNav(route);
      // Ensure admin visibility after render
      import('./common.js').then(m => m && m['toggleAdminUI']?.());
    }catch(e){
      document.getElementById('app').innerHTML = `<div class="card"><b>Yuklash xatosi:</b> ${e.message}</div>`;
    }
  }
  window.addEventListener('hashchange', render);
  render();
}
