import { getCtx } from './common.js';
import { collection, query, orderBy, getDocs, updateDoc, doc, where, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

export async function onMount(){
  const { db, user } = getCtx();
  const out = document.getElementById('adminOut');
  const scanTopups = document.getElementById('btnScanTopups');
  const scanUsers = document.getElementById('btnScanUsers');
  const toggleLive = document.getElementById('btnToggleLive');

  function isAdminData(d){
    return ['1000001','1000002',1000001,1000002].includes(d.numericId);
  }

  async function guard(){
    if(!user){ out.textContent='Kirish talab qilinadi'; return false; }
    const us = await getDoc(doc(db,'users',user.uid));
    const d = us.data()||{};
    if(!isAdminData(d)){ out.textContent='Admin emassiz'; return false; }
    return true;
  }

  scanTopups?.addEventListener('click', async ()=>{
    if(!await guard()) return;
    const qs = await getDocs(query(collection(db,'topups'), orderBy('createdAt','desc')));
    let html = '<table style="width:100%"><tr><th>Foydalanuvchi</th><th>Summa</th><th>Holat</th><th>URL</th><th>Amal</th></tr>';
    const rows = [];
    qs.forEach(docu=>{
      const d = docu.data();
      rows.push(`<tr>
        <td>${d.uid}</td><td>${d.amount}</td><td>${d.status}</td>
        <td><a href="${d.url}" target="_blank">chek</a></td>
        <td>
          <button data-id="${docu.id}" data-s="accepted" class="btn primary">Qabul</button>
          <button data-id="${docu.id}" data-s="rejected" class="btn ghost">Rad</button>
        </td>
      </tr>`);
    });
    html += rows.join('') + '</table>';
    out.innerHTML = html;
    out.querySelectorAll('button[data-id]').forEach(btn=>{
      btn.addEventListener('click', async (e)=>{
        const id = e.currentTarget.getAttribute('data-id');
        const s = e.currentTarget.getAttribute('data-s');
        await updateDoc(doc(db,'topups',id),{status:s});
      });
    });
  });

  scanUsers?.addEventListener('click', async ()=>{
    if(!await guard()) return;
    const qs = await getDocs(query(collection(db,'users'), orderBy('gems','desc')));
    let html = '<div class="grid cards">';
    qs.forEach(u=>{
      const d = u.data();
      html += `<div class="item"><div class="meta">
        <div class="title">${d.name||'Foydalanuvchi'}</div>
        <div class="sub">ID: ${d.numericId||'—'} · Balans: ${d.balance||0} · Olmos: ${d.gems||0}</div>
        <div style="display:flex;gap:6px;margin-top:6px">
          <button class="btn primary" data-uid="${u.id}" data-op="addg">+50 olmos</button>
          <button class="btn ghost" data-uid="${u.id}" data-op="addb">+5000 balans</button>
        </div>
      </div></div>`;
    });
    html += '</div>';
    out.innerHTML = html;
    out.querySelectorAll('button[data-uid]').forEach(btn=>{
      btn.addEventListener('click', async (e)=>{
        const uid = e.currentTarget.getAttribute('data-uid');
        const op = e.currentTarget.getAttribute('data-op');
        const ref = doc(db,'users',uid);
        const snap = await getDoc(ref);
        const d = snap.data()||{};
        if(op==='addg') await updateDoc(ref,{gems:(d.gems||0)+50});
        if(op==='addb') await updateDoc(ref,{balance:(d.balance||0)+5000});
      });
    });
  });

  toggleLive?.addEventListener('click', async ()=>{
    if(!await guard()) return;
    const liveRef = doc(db,'live','current');
    const s = await getDoc(liveRef);
    const cur = s.data()||{status:'lobby'};
    const next = cur.status==='running' ? 'lobby' : 'running';
    await setDoc(liveRef, {...cur, status: next}, {merge:true});
  });
}
