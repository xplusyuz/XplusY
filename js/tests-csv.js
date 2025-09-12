
import { loadCSV } from './csv-loader.js';

// Reads /csv/tests.csv -> produces cards html
// Format: img|title|price|src|perq(seconds)|tags
export async function renderTestCards(container){
  try{
    const rows = await loadCSV('/csv/tests.csv');
    const hdr = rows[0].map(x=>x.toLowerCase());
    const idx = (k)=> hdr.findIndex(h=>h.includes(k));
    const iImg=idx('img'), iTitle=idx('title'), iPrice=idx('price'), iSrc=idx('src'), iPerq=idx('perq'), iTags=idx('tags');
    const items = rows.slice(1).map(r=>({
      img: iImg>-1?r[iImg]:"",
      title: iTitle>-1?r[iTitle]:"Test",
      price: Number(iPrice>-1? r[iPrice]: 0),
      src: iSrc>-1?r[iSrc]:"",
      perq: Number(iPerq>-1? r[iPerq]: 120),
      tags: (iTags>-1?r[iTags]:"").split('|').filter(Boolean)
    }));

    container.innerHTML = items.map(item=>`
      <div class="card">
        ${item.img? `<img src="${item.img}" alt="" style="max-width:100%;border-radius:12px;margin-bottom:8px">` : ''}
        <h3>${item.title}</h3>
        <div class="kv">
          <span>💵 ${item.price.toLocaleString()} so'm</span>
          <span>⏱️ ${item.perq} s/savol</span>
        </div>
        <p><a class="btn start" data-src="${item.src}" data-price="${item.price}" data-title="${item.title}" data-perq="${item.perq}">Boshlash</a></p>
      </div>
    `).join("");
  }catch(e){
    container.innerHTML = `<div class="card">tests.csv o'qishda xatolik: ${e.message}</div>`;
  }
}
