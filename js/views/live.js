import { loadCSV } from '../utils-csv.js';
import { el } from '../common.js';

function countdown(ts){
  const d = ts - Date.now();
  if (d<=0) return "00:00:00";
  const h = Math.floor(d/3600000), m=Math.floor((d%3600000)/60000), s=Math.floor((d%60000)/1000);
  return [h,m,s].map(x=>String(x).padStart(2,'0')).join(':');
}

export async function mount(){
  const grid = document.getElementById('liveGrid');
  try{
    const items = await loadCSV('csv/live.csv');
    grid.innerHTML = '';
    items.forEach(it => {
      const start = new Date(it.StartISO||new Date().toISOString()).getTime();
      const card = el(`<div class="card">
        <h4 style="margin:0 0 6px">${it.Title||'Musobaqa'}</h4>
        <div style="font-size:13px; color:#60708a">${it.Meta||''}</div>
        <div style="margin-top:8px"><b>Start:</b> ${new Date(start).toLocaleString()}</div>
        <div class="timer" style="font-weight:700; margin-top:6px">00:00:00</div>
        <button class="btn primary" style="margin-top:8px">Ishtirok etish</button>
      </div>`);
      const tEl = card.querySelector('.timer');
      const tick = ()=> tEl.textContent = countdown(start);
      tick(); const id = setInterval(tick, 1000);
      grid.appendChild(card);
    });
  }catch(e){
    grid.innerHTML = '<div class="card">live.csv yuklanmadi</div>';
  }
}
