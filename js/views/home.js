import { loadCSV } from '../utils-csv.js';
import { redeemPromo, el, img } from '../common.js';

export async function mount(){
  // skeletons
  const hero = document.getElementById('homeHero');
  const listBox = document.getElementById('homeCards');
  hero.innerHTML = '<div class="skeleton card-cover"></div><div class="skeleton card-cover"></div>';
  listBox.innerHTML = '<div class="skeleton card-cover"></div><div class="skeleton card-cover"></div><div class="skeleton card-cover"></div><div class="skeleton card-cover"></div>';

  try{
    const items = await loadCSV('csv/home.csv');
    hero.innerHTML = '';
    listBox.innerHTML = '';
    items.slice(0,2).forEach(it => {
      const card = el('<div class="card"></div>');
      card.appendChild(img(it.Img||'', it.Title||''));
      card.appendChild(el(`<h4 style="margin:8px 0 4px">${it.Title||'Sarlavha'}</h4>`));
      card.appendChild(el(`<div style="color:#475569; font-size:14px">${it.Meta||''}</div>`));
      hero.appendChild(card);
    });
    items.forEach(it => {
      const card = el('<div class="card"></div>');
      card.appendChild(img(it.Img||'', it.Title||''));
      card.appendChild(el(`<h4 style="margin:8px 0 4px">${it.Title||'Sarlavha'}</h4>`));
      card.appendChild(el(`<div style="color:#475569; font-size:14px">${it.Meta||''}</div>`));
      listBox.appendChild(card);
    });
  }catch(e){
    hero.innerHTML = '<div class="card">home.csv yuklanmadi</div>';
    listBox.innerHTML = '';
  }

  // Promo
  const inp = document.getElementById('promoInput');
  const btn = document.getElementById('btnRedeem');
  const msg = document.getElementById('promoMsg');
  btn.onclick = async () => {
    msg.textContent = '';
    try{ await redeemPromo(inp.value); msg.textContent = 'Muvaffaqiyatli!'; }
    catch(err){ msg.textContent = err.message; }
  };
}
