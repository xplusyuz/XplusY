import { loadCSV } from '../utils-csv.js';
import { el, fmtMoney, openDialog, closeDialog, toast } from '../common.js';

async function runQuiz(csvPath){
  const questions = await loadCSV(csvPath);
  let i=0, correct=0, start=Date.now();
  function screen(){
    const q = questions[i];
    const dlg = el(`<form class="modal-card">
      <header><h3>${q.question||'Savol'}</h3><button class="btn icon only" value="cancel" formnovalidate>✕</button></header>
      <section class="content">
        <div class="grid" style="grid-template-columns:1fr">
          ${['a','b','c','d'].map(k=>`<label class="btn ghost" style="text-align:left"><input type="radio" name="ans" value="${k}" style="margin-right:8px">${q[k]}</label>`).join('')}
        </div>
      </section>
      <footer style="display:flex; justify-content:space-between; padding:12px 16px; border-top:1px solid #eef4f0">
        <small>${i+1}/${questions.length}</small>
        <button class="btn primary">Keyingi</button>
      </footer>
    </form>`);
    dlg.onsubmit = (e)=>{
      e.preventDefault();
      const v = new FormData(dlg).get('ans');
      if (!v) return toast('Variant tanlang');
      if (v === (q.correct||'a')) correct++;
      i++;
      if (i>=questions.length){
        const time = Math.round((Date.now()-start)/1000);
        closeDialog();
        openDialog(`<div class="modal-card">
          <header><h3>Natija</h3><button class="btn icon only" onclick="document.getElementById('globalDialog').close()">✕</button></header>
          <section class="content"><p>To‘g‘ri javoblar: <b>${correct}/${questions.length}</b><br>Vaqt: <b>${time}s</b></p></section>
        </div>`);
      }else{
        const d = document.getElementById('globalDialog'); d.innerHTML=''; d.appendChild(screen());
      }
    };
    return dlg;
  }
  const d = openDialog(screen());
}

export async function mount(){
  const grid = document.getElementById('testsGrid');
  const filtersEl = document.getElementById('testFilters');
  const items = await loadCSV('csv/tests.csv');
  const sections = [...new Set(items.map(i=>i.Section).filter(Boolean))];
  const types = [...new Set(items.map(i=>i.Type).filter(Boolean))];

  function render(list){
    grid.innerHTML = '';
    for (const t of list){
      const card = el('<div class="card"></div>');
      card.innerHTML = `
        <img class="card-cover" src="${t.Img||''}" onerror="this.outerHTML='<div class=img-fallback card-cover>Rasm yo\'q</div>'">
        <h4 style="margin:8px 0 2px">${t.Title||'Test'}</h4>
        <div style="font-size:12px; color:#64748b">${t.Section||''} · ${t.Type||''}</div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px">
          <div>${fmtMoney(Number(t.Price||0))}</div>
          <button class="btn primary">Boshlash</button>
        </div>`;
      card.querySelector('button').onclick = () => {
        runQuiz(t.QuestionsCSV || 'csv/questions_demo.csv');
      };
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
