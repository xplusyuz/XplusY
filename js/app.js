// app.js — minimal SPA with draggable floating menu
const $ = (s, el=document)=> el.querySelector(s);

const routes = {
  home: () => section('🏠 Bosh sahifa', `Xush kelibsiz!`),
  tests: () => section('📝 Testlar', `Testlar sahifasi demo.`),
  live: () => section('🔥 Live', `Live mashg\'ulotlar ro\'yxati.`),
  simulator: () => section('🎮 Simulator', `Simulyator sahifasi.`),
  leaderboard: () => section('🏅 Reyting', `Eng yaxshi natijalar.`),
  profile: () => section('👤 Profil', `Profil ma\'lumotlari.`),
  results: () => section('📊 Natijalar', `So'ngi natijalar.`),
  topup: () => section('💳 Balans to‘ldirish', `To'lov bo'limi.`),
  badges: () => section('🏆 Yutuqlar', `Yutuqlar va badge'lar.`),
  promo: () => section('🎁 Promo', `Promo-kod kiriting.`),
  admin: () => section('🛠️ Admin', `Admin panel demo.`),
};

function section(title, text){
  const el = document.createElement('section');
  el.className = 'grid';
  el.innerHTML = `<div class="card"><h2>${title}</h2><p class="sub">${text}</p></div>`;
  return el;
}

const app = document.getElementById('app');

function render(){
  const page = (location.hash || '#home').slice(1);
  const view = routes[page] ? routes[page]() : routes.home();
  app.innerHTML = '';
  app.appendChild(view);
  closeSheet();
}

window.addEventListener('hashchange', render, { passive:true });
document.addEventListener('DOMContentLoaded', () => {
  setupTheme();
  setupFab();
  setupMenu();
  render();
});

function setupTheme(){
  const btn = document.getElementById('themeToggle');
  let dark = localStorage.getItem('themeDark') === '1';
  apply();
  btn.addEventListener('click', () => { dark = !dark; localStorage.setItem('themeDark', dark ? '1':'0'); apply(); });
  function apply(){ document.documentElement.classList.toggle('dark', dark); btn.textContent = dark ? '☀️' : '🌙'; }
}

function setupFab(){
  const fab = document.getElementById('fab');
  const pos = JSON.parse(localStorage.getItem('fabPos')||'null');
  if(pos) applyPos(pos.x, pos.y);
  let dragging=false, sx=0, sy=0, ox=0, oy=0;
  fab.addEventListener('pointerdown', (e)=>{
    fab.setPointerCapture(e.pointerId);
    dragging = true; sx = e.clientX; sy = e.clientY;
    const r = fab.getBoundingClientRect(); ox = r.left; oy = r.top;
  });
  window.addEventListener('pointermove', (e)=>{
    if(!dragging) return;
    const x = ox + (e.clientX - sx); const y = oy + (e.clientY - sy);
    applyPos(x, y);
  });
  window.addEventListener('pointerup', ()=>{
    if(!dragging) return; dragging = false;
    const r = fab.getBoundingClientRect();
    localStorage.setItem('fabPos', JSON.stringify({ x:r.left, y:r.top }));
  });
  fab.addEventListener('click', toggleSheet);
  fab.addEventListener('keydown', (e)=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); toggleSheet(); } });
  function applyPos(x,y){
    const vw=innerWidth,vh=innerHeight; const r={w:58,h:58,m:8};
    const nx=Math.min(vw-r.w-r.m, Math.max(r.m,x));
    const ny=Math.min(vh-r.h-r.m, Math.max(r.m,y));
    fab.style.left=nx+'px'; fab.style.top=ny+'px'; fab.style.right='auto'; fab.style.bottom='auto';
  }
}

const TILES = [
  { icon:'🏠', title:'Bosh sahifa', route:'home' },
  { icon:'📝', title:'Testlar', route:'tests' },
  { icon:'🔥', title:'Live', route:'live' },
  { icon:'🎮', title:'Simulator', route:'simulator' },
  { icon:'🏅', title:'Reyting', route:'leaderboard' },
  { icon:'👤', title:'Profil', route:'profile' },
  { icon:'📊', title:'Natijalar', route:'results' },
  { icon:'💳', title:'To‘ldirish', route:'topup' },
  { icon:'🏆', title:'Yutuqlar', route:'badges' },
  { icon:'🎁', title:'Promo', route:'promo' },
  { icon:'🛠️', title:'Admin', route:'admin' },
];
function setupMenu(){
  const wrap = document.getElementById('menuTiles'); wrap.innerHTML='';
  for(const t of TILES){
    const a = document.createElement('a'); a.className='tile'; a.href='#'+t.route;
    a.innerHTML = `<span>${t.icon}</span><b>${t.title}</b>`;
    a.addEventListener('click', ()=> closeSheet());
    wrap.appendChild(a);
  }
}
function toggleSheet(){ const s=$('#sheet'), b=$('#backdrop'); const open=s.hasAttribute('open'); if(open){ s.removeAttribute('open'); s.hidden=true; b.hidden=true; } else { s.setAttribute('open',''); s.hidden=false; b.hidden=false; } }
function closeSheet(){ const s=$('#sheet'), b=$('#backdrop'); s.removeAttribute('open'); s.hidden=true; b.hidden=true; }
document.getElementById('backdrop').addEventListener('click', closeSheet);
