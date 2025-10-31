// Bannerlar uchun player skripti
const DUR_MS = 5000;
const WRAP = true;
let DATA = { sections: [] };
let playlist = [];
let ptr = 0;
let active = 'A';
let timer = null, lastTick = 0, remaining = DUR_MS, paused = false;
const $ = s=>document.querySelector(s);
const A = $('#A'), B = $('#B');
const L = $('#left'), R = $('#right');

function escapeClosingScript(html=''){return String(html).replace(/<\/script/gi,'<\\/script');}
function wrapHtml(bn={}, sec={}){
  const bg = bn.bg || (sec?.darkish ? '#0f1814' : '#ffffff');
  const baseCSS='<style>*{box-sizing:border-box}html,body{height:100%;margin:0;background:'+bg+';font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif}</style>';
  return baseCSS+(bn.html?escapeClosingScript(bn.html):'<div style="display:grid;place-items:center;height:100%;color:#888">Bo‘sh banner</div>');
}
async function fetchJSON(u){const r=await fetch(u,{cache:'no-store'});if(!r.ok)throw new Error('fail');return r.json();}
function buildPlaylist(){playlist=[];(DATA.sections||[]).forEach((sec,sI)=>(sec.banners||[]).forEach((bn,bI)=>playlist.push({secIdx:sI,idx:bI,srcdoc:wrapHtml(bn,sec)})));}
function renderTo(t,i){t.srcdoc=i.srcdoc;}
function show(i,reset=false){if(!playlist.length)return;ptr=((i%playlist.length)+playlist.length)%playlist.length;const item=playlist[ptr];const n=active==='A'?B:A;const c=active==='A'?A:B;renderTo(n,item);n.classList.add('show');c.classList.remove('show');active=active==='A'?'B':'A';remaining=reset?DUR_MS:remaining;clearTimeout(timer);if(!paused){lastTick=performance.now();timer=setTimeout(()=>next(),remaining);}}
function next(){if(!playlist.length)return;const nx=ptr+1;if(nx>=playlist.length){if(WRAP)show(0,true);}else show(nx,true);}
function prev(){if(!playlist.length)return;const pv=ptr-1;if(pv<0){if(WRAP)show(playlist.length-1,true);}else show(pv,true);}
function pause(){if(paused)return;paused=true;clearTimeout(timer);const e=performance.now()-lastTick;remaining=Math.max(0,remaining-e);}
function resume(){if(!paused)return;paused=false;lastTick=performance.now();timer=setTimeout(()=>next(),remaining);}
L.addEventListener('click',prev);R.addEventListener('click',next);
['left','right'].forEach(id=>{const el=document.getElementById(id);el.addEventListener('pointerdown',pause);el.addEventListener('pointerup',resume);el.addEventListener('pointerleave',resume);});
let sx=0,sy=0;document.addEventListener('touchstart',e=>{if(!e.touches[0])return;sx=e.touches[0].clientX;sy=e.touches[0].clientY;pause();},{passive:true});
document.addEventListener('touchend',e=>{resume();const t=e.changedTouches[0];if(!t)return;const dx=t.clientX-sx,dy=t.clientY-sy;if(Math.abs(dx)>40&&Math.abs(dx)>Math.abs(dy)){dx<0?next():prev();}},{passive:true});
window.addEventListener('keydown',e=>{if(e.key==='ArrowRight')next();else if(e.key==='ArrowLeft')prev();else if(e.code==='Space'){paused?resume():pause();e.preventDefault();}});
(async function init(){try{DATA=await fetchJSON('./banner.json');buildPlaylist();if(!playlist.length){A.srcdoc='<style>html,body{height:100%;margin:0;display:grid;place-items:center;background:#111;color:#fff}</style><div>banner.json bo‘sh</div>';A.classList.add('show');return;}A.srcdoc=playlist[0].srcdoc;A.classList.add('show');active='A';if(playlist[1])renderTo(B,playlist[1]);remaining=DUR_MS;lastTick=performance.now();timer=setTimeout(()=>next(),remaining);}catch(err){A.srcdoc='<style>html,body{height:100%;margin:0;display:grid;place-items:center;background:#111;color:#fff}</style><div>banner.json yuklanmadi</div>';A.classList.add('show');}})();