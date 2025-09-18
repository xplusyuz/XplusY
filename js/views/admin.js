import { listPendingTopups, approveTopup, el, fmtMoney } from '../common.js';

export async function mount(){
  const tbody = document.querySelector('#pendingTbl tbody');
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
        try{
          await approveTopup(r.id);
          tr.remove();
        }catch(e){
          alert(e.message);
          tr.querySelector('button').disabled = false;
        }
      };
      tbody.appendChild(tr);
    }
    if (!list.length){
      tbody.innerHTML = '<tr><td colspan="5">Hozircha so‘rov yo‘q</td></tr>';
    }
  }catch(e){
    tbody.innerHTML = `<tr><td colspan="5">${e.message}</td></tr>`;
  }
}
