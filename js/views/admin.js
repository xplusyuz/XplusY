import { listPendingTopups, approveTopup, el, fmtMoney, toast } from '../common.js';
import { state } from '../common.js';
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

function tabTopups(){
  const wrap = el(`<div>
    <table class="table" id="pendingTbl">
      <thead><tr><th>Foydalanuvchi</th><th>Summasi</th><th>Usul</th><th>Chek</th><th>Harakat</th></tr></thead>
      <tbody></tbody>
    </table>
  </div>`);
  (async()=>{
    const tbody = wrap.querySelector('tbody');
    tbody.innerHTML = '<tr><td colspan="5">Yuklanmoqda...</td></tr>';
    try{
      const list = await listPendingTopups();
      tbody.innerHTML = '';
      for (const r of list){
        const tr = el(`<tr>
          <td>${r.uid.slice(0,6)}…</td>
          <td>${fmtMoney(r.amount)}</td>
          <td>${r.method}</td>
          <td>${r.receiptUrl ? '<a target=_blank href='+r.receiptUrl+'>Ko‘rish</a>' : '—'}</td>
          <td><button class="btn primary">Tasdiqlash</button></td>
        </tr>`);
        tr.querySelector('button').onclick = async ()=>{
          tr.querySelector('button').disabled = true;
          try{ await approveTopup(r.id); tr.remove(); toast('Tasdiqlandi'); }catch(e){ alert(e.message); tr.querySelector('button').disabled = false; }
        };
        tbody.appendChild(tr);
      }
      if (!list.length) tbody.innerHTML = '<tr><td colspan="5">Hozircha so‘rov yo‘q</td></tr>';
    }catch(e){ wrap.innerHTML = `<div class="card">${e.message}</div>`; }
  })();
  return wrap;
}

function tabPromos(){
  const wrap = el(`<div class="grid" style="grid-template-columns:1fr 1fr; gap:16px">
    <div class="card">
      <h3 style="margin:0 0 8px">Yangi promo-kod</h3>
      <label class="label">Kod (mas: FREE10)</label>
      <input class="input" id="code" />
      <label class="label" style="margin-top:8px">Gems qo‘shish</label>
      <input class="input" id="gems" type="number" value="10"/>
      <label class="label" style="margin-top:8px">Balans qo‘shish (so‘m)</label>
      <input class="input" id="bal" type="number" value="0"/>
      <label class="label" style="margin-top:8px">Qolgan ishlatish soni</label>
      <input class="input" id="uses" type="number" value="100"/>
      <button class="btn primary" id="save">Saqlash</button>
      <p id="msg" style="margin-top:8px"></p>
    </div>
    <div class="card">
      <p>Promo-kodni `promo_codes/{KOD}` hujjatiga yozib beradi. `usesRemaining` maydonini kamaytirish foydalanuvchi tomonidan avtomatik bo‘ladi.</p>
    </div>
  </div>`);
  wrap.querySelector('#save').onclick = async ()=>{
    try{
      const code = wrap.querySelector('#code').value.trim().toUpperCase();
      const gems = Number(wrap.querySelector('#gems').value||0);
      const bal = Number(wrap.querySelector('#bal').value||0);
      const uses = Number(wrap.querySelector('#uses').value||0);
      const ref = doc(state.db, 'promo_codes', code);
      await setDoc(ref, { gems, balance: bal, usesRemaining: uses, updatedAt: new Date() }, { merge:true });
      wrap.querySelector('#msg').textContent = 'Saqlandi';
    }catch(e){ wrap.querySelector('#msg').textContent = e.message; }
  };
  return wrap;
}

function tabTests(){
  const wrap = el(`<div class="grid" style="grid-template-columns:1fr 1fr; gap:16px">
    <div class="card">
      <h3 style="margin:0 0 8px">CSV test qo‘shish (metadata Firestore’da)</h3>
      <label class="label">Sarlavha</label><input class="input" id="title">
      <label class="label" style="margin-top:8px">Bo‘lim</label><input class="input" id="section">
      <label class="label" style="margin-top:8px">Tur</label><input class="input" id="type">
      <label class="label" style="margin-top:8px">Narx</label><input class="input" id="price" type="number" value="0">
      <label class="label" style="margin-top:8px">Rasm URL</label><input class="input" id="img">
      <label class="label" style="margin-top:8px">Savollar CSV (yo‘l)</label><input class="input" id="csv" value="csv/questions_demo.csv">
      <button class="btn primary" id="save">Saqlash</button>
      <p id="msg" style="margin-top:8px"></p>
    </div>
    <div class="card"><p>Metama’lumotlar `tests_meta/{randomId}` ga yoziladi. Front `csv/tests.csv` dan ham o‘qiydi — lekin bu forma orqali Firestore’da saqlab, keyinchalik admin paneldan boshqarish oson.</p></div>
  </div>`);
  wrap.querySelector('#save').onclick = async ()=>{
    try{
      const data = {
        title: wrap.querySelector('#title').value,
        section: wrap.querySelector('#section').value,
        type: wrap.querySelector('#type').value,
        price: Number(wrap.querySelector('#price').value||0),
        img: wrap.querySelector('#img').value,
        csv: wrap.querySelector('#csv').value,
        updatedAt: new Date()
      };
      const id = Math.random().toString(36).slice(2);
      const ref = doc(state.db, 'tests_meta', id);
      await setDoc(ref, data);
      wrap.querySelector('#msg').textContent = 'Saqlandi (tests_meta/'+id+')';
    }catch(e){ wrap.querySelector('#msg').textContent = e.message; }
  };
  return wrap;
}

export async function mount(){
  const body = document.getElementById('adminBody');
  function show(tab){ body.innerHTML=''; body.appendChild(tab==='topups'? tabTopups(): tab==='promos'? tabPromos(): tabTests()); }
  show('topups');
  document.querySelectorAll('[data-tab]').forEach(b=> b.onclick=()=>{ document.querySelectorAll('[data-tab]').forEach(x=>x.classList.remove('primary')); b.classList.add('primary'); show(b.dataset.tab); });
}
