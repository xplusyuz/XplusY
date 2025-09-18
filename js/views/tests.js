import { loadCSV } from '../utils-csv.js';
import { el, fmtMoney, img } from '../common.js';

export async function mount(){
  const grid = document.getElementById('testsGrid');
  const filtersEl = document.getElementById('testFilters');
  grid.innerHTML = '<div class="skeleton card-cover"></div><div class="skeleton card-cover"></div><div class="skeleton card-cover"></div><div class="skeleton card-cover"></div>';
  const items = await loadCSV('csv/tests.csv');
  const sections = [...new Set(items.map(i=>i.Section).filter(Boolean))];
  const types = [...new Set(items.map(i=>i.Type).filter(Boolean))];

  function render(list){
    grid.innerHTML = '';
    for (const t of list){
      const card = el('<div class="card"></div>');
      card.appendChild(img(t.Img||'', t.Title||''));
      card.appendChild(el(`<h4 style="margin:8px 0 2px">${t.Title||'Test'}</h4>`));
      card.appendChild(el(`<div style="font-size:12px; color:#64748b">${t.Section||''} · ${t.Type||''}</div>`));
      card.appendChild(el(`<div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px">
          <div>${fmtMoney(Number(t.Price||0))}</div><button class="btn primary">Boshlash</button>
        </div>`));
      grid.appendChild(card);
    }
  }

  function makeFilter(name, values){
    const sel = el(`<select class="input" style="max-width:220px"><option value="">${name}</option></select>`);
    values.forEach(v => sel.appendChild(el(`<option>${v}</option>`)));
    sel.addEventListener('change', () => {
      const sv = sel.value;
      const filtered = items.filter(i => !sv || i[name]==sv);
      render(filtered);
    });
    filtersEl.appendChild(sel);
  }

  filtersEl.innerHTML = '';
  makeFilter('Section', sections);
  makeFilter('Type', types);
  render(items);
}
