import { loadCSV } from '../utils-csv.js';
import { redeemPromo, el } from '../common.js';

export async function mount(){
  // Home cards from CSV
  try{
    const items = await loadCSV('csv/home.csv');
    const box = document.getElementById('homeCards');
    box.innerHTML = '';
    for (const it of items){
      box.appendChild(el(`
        <div class="card">
          <img src="${it.Img||''}" alt="" style="width:100%; height:120px; object-fit:cover; border-radius:12px" />
          <h4 style="margin:8px 0 4px">${it.Title||'Sarlavha'}</h4>
          <div style="color:#475569; font-size:14px">${it.Meta||''}</div>
        </div>
      `));
    }
  }catch(e){
    console.warn('home.csv yuklanmadi', e);
  }

  // Promo
  const inp = document.getElementById('promoInput');
  const btn = document.getElementById('btnRedeem');
  const msg = document.getElementById('promoMsg');
  btn.onclick = async () => {
    msg.textContent = '';
    try{
      await redeemPromo(inp.value);
      msg.textContent = 'Muvaffaqiyatli!';
    }catch(err){
      msg.textContent = err.message;
    }
  };
}
