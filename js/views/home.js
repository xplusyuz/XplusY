import { loadCSV } from '../utils-csv.js';
import { redeemPromo, el } from '../common.js';

export async function mount(){
  const hero = document.getElementById('homeHero');
  const listBox = document.getElementById('homeCards');
  hero.innerHTML = '<div class="skeleton card-cover"></div><div class="skeleton card-cover"></div>';
  listBox.innerHTML = '<div class="skeleton card-cover"></div><div class="skeleton card-cover"></div><div class="skeleton card-cover"></div><div class="skeleton card-cover"></div>';
  try{
    const items = await loadCSV('csv/home.csv');
    const mk = (it)=> el(`<div class="card">
        <img class="card-cover" src="${it.Img||''}" onerror="this.outerHTML='<div class=img-fallback card-cover>Rasm yo\'q</div>'">
        <h4 style="margin:8px 0 4px">${it.Title||'Sarlavha'}</h4>
        <div style="color:#475569; font-size:14px">${it.Meta||''}</div>
      </div>`);
    hero.innerHTML = ''; listBox.innerHTML='';
    items.slice(0,2).forEach(it => hero.appendChild(mk(it)));
    items.forEach(it => listBox.appendChild(mk(it)));
  }catch(e){ hero.innerHTML = '<div class="card">home.csv yuklanmadi</div>'; listBox.innerHTML=''; }

  const inp = document.getElementById('promoInput');
  const btn = document.getElementById('btnRedeem');
  const msg = document.getElementById('promoMsg');
  btn.onclick = async () => {
    msg.textContent = '';
    try{ await redeemPromo(inp.value); msg.textContent = 'Muvaffaqiyatli!'; }
    catch(err){ msg.textContent = err.message; }
  };
}
