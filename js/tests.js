import { fetchCSV } from './csv.js';

let all = [];

export async function onMount(){
  all = await fetchCSV('csv/tests.csv').catch(()=>[]);
  const sections = [...new Set(all.map(x=>x.section))].filter(Boolean);
  const selSection = document.getElementById('filterSection');
  selSection.innerHTML = '<option value="">Bo‘lim</option>' + sections.map(s=>`<option>${s}</option>`).join('');
  document.getElementById('filterLevel').addEventListener('change', render);
  document.getElementById('filterSection').addEventListener('change', render);
  document.getElementById('searchInput').addEventListener('input', render);
  render();
}

function render(){
  const sec = document.getElementById('filterSection').value;
  const lvl = document.getElementById('filterLevel').value;
  const q = (document.getElementById('searchInput').value||'').toLowerCase();
  const grid = document.getElementById('testsGrid');
  const list = all.filter(x=>(!sec||x.section===sec) && (!lvl||x.level===lvl) && (!q||x.title.toLowerCase().includes(q)));
  grid.innerHTML = list.map(x=>`
    <div class="item">
      <img src="${x.img}" alt="">
      <div class="meta">
        <div class="title">${x.title}</div>
        <div class="sub">${x.meta}</div>
        <div class="sub">Narx: ${x.price} so‘m · ${x.time} daqiqa</div>
        <div style="margin-top:8px;display:flex;gap:6px">
          <button class="btn primary">Boshlash</button>
          <button class="btn ghost">Ko‘rish</button>
        </div>
      </div>
    </div>
  `).join('');
}
