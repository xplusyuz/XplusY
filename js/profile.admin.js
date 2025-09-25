import { adminAllowed, createDoc, updateDocById, deleteDocById } from '../assets/app.js';
import { collection, getDocs, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

(async function(){
  const adminBox = document.getElementById('adminContent'); if(!adminBox) return;
  if(!adminAllowed()){ adminBox.innerHTML = '<p>Admin huquqi kerak.</p>'; return; }
  adminBox.innerHTML = `
    <h3>Promokod yaratish</h3>
    <div class="grid" style="grid-template-columns:1fr 1fr;gap:8px">
      <div class="field"><label>Kod</label><input id="pcCode" placeholder="ABC123"></div>
      <div class="field"><label>Holat</label>
        <select id="pcDisabled"><option value="false">Faol</option><option value="true">O‘chirilgan</option></select>
      </div>
    </div>
    <div class="grid" style="grid-template-columns:1fr 1fr;gap:8px">
      <div class="field"><label>Balans +</label><input id="pcBalance" type="number" value="0"></div>
      <div class="field"><label>Ball +</label><input id="pcPoints" type="number" value="0"></div>
    </div>
    <div class="grid" style="grid-template-columns:1fr 1fr;gap:8px">
      <div class="field"><label>Maks. ishlatish</label><input id="pcMax" type="number" value="0"></div>
      <div class="field"><label>Muddati (YYYY-MM-DD HH:MM)</label><input id="pcExp" placeholder="2025-12-31 23:59"></div>
    </div>
    <button class="btn pri" id="pcSave">Yaratish</button>
    <hr/>
    <h3>Promokodlar</h3>
    <div class="list" id="pcList"></div>

    <hr/>
    <h3>Promo ishlatish tarixi</h3>
    <div class="grid" style="grid-template-columns:1fr 1fr;gap:8px">
      <div class="field"><label>Kod bo‘yicha filter</label><input id="phCode" placeholder="ABC123"></div>
      <div class="field"><label>Foydalanuvchi UID</label><input id="phUid" placeholder="UID"></div>
    </div>
    <div style="display:flex;gap:8px;margin:8px 0">
      <button class="btn" id="phSearch">Qidirish</button>
      <button class="btn" id="phClear">Tozalash</button>
    </div>
    <div class="list" id="phList"></div>
  `;

  async function loadList(){
    const list = adminBox.querySelector('#pcList'); list.innerHTML='';
    const snap = await getDocs(query(collection(window.firebaseDb,'promo_codes'), orderBy('createdAt','desc'), limit(100)));
    snap.forEach(docu=>{
      const d={id:docu.id, ...docu.data()};
      const row=document.createElement('div'); row.className='item';
      row.innerHTML=`<div><b>${d.code}</b><div class="meta">+${d.balance||0} balans • +${d.points||0} ball • ishlatilgan: ${d.usedCount||0}/${d.maxUses||'∞'} • ${d.disabled?'o‘chirilgan':'faol'} • muddati: ${d.expiresAt||'—'}</div></div>
        <div style="display:flex;gap:6px">
          <button class="btn" data-toggle="${d.id}">Toggle</button>
          <button class="btn danger" data-del="${d.id}">Delete</button>
        </div>`;
      list.appendChild(row);
    });
  }

  adminBox.querySelector('#pcSave').addEventListener('click', async ()=>{
    const code=(adminBox.querySelector('#pcCode').value||'').trim().toUpperCase();
    if(!code) return alert('Kod shart');
    const data={
      code,
      disabled: adminBox.querySelector('#pcDisabled').value==='true',
      balance:Number(adminBox.querySelector('#pcBalance').value||0),
      points:Number(adminBox.querySelector('#pcPoints').value||0),
      maxUses:Number(adminBox.querySelector('#pcMax').value||0),
      expiresAt: (adminBox.querySelector('#pcExp').value||'').trim()
    };
    await createDoc('promo_codes', data);
    await loadList();
  });

  adminBox.addEventListener('click', async (e)=>{
    const id=e.target.dataset?.del, tid=e.target.dataset?.toggle;
    if(id){ if(confirm('Promokodni o‘chirish?')){ await deleteDocById('promo_codes', id); await loadList(); } }
    if(tid){ // toggle disabled
      const row = e.target.closest('.item');
      const meta = row.querySelector('.meta').textContent;
      const disabledNext = !/faol/.test(meta);
      await updateDocById('promo_codes', tid, { disabled: disabledNext });
      await loadList();
    }
  });

  // Redemption history
  async function loadHistory(){
    const list = document.getElementById('phList'); if(!list) return;
    list.innerHTML = '';
    const { getDocs, query, orderBy, limit, collection } = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js");
    const snap = await getDocs(query(collection(window.firebaseDb,'promo_redemptions'), orderBy('redeemedAt','desc'), limit(200)));
    const code = (document.getElementById('phCode')?.value||'').trim().toUpperCase();
    const uid  = (document.getElementById('phUid')?.value||'').trim();
    const rows=[]; snap.forEach(d=>rows.push({ id:d.id, ...d.data() }));
    const filtered = rows.filter(it => (!code || it.code===code) && (!uid || it.uid===uid));
    if(!filtered.length){ list.innerHTML='<p>Hech narsa topilmadi</p>'; return; }
    filtered.forEach(it=>{
      const row=document.createElement('div'); row.className='item';
      row.innerHTML = `<div><b>${it.code}</b><div class="meta">uid: ${it.uid} • ${it.redeemedAt}</div></div><div></div>`;
      list.appendChild(row);
    });
  }
  adminBox.addEventListener('click', (e)=>{
    if(e.target.id==='phSearch') loadHistory();
    if(e.target.id==='phClear'){ document.getElementById('phCode').value=''; document.getElementById('phUid').value=''; loadHistory(); }
  });

  window.firebaseDb = (await import('../assets/app.js')).db;
  await loadList(); setTimeout(loadHistory,300);
})(); 
