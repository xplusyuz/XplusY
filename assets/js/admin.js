
import { bootFirebase } from './firebase-init.js';

const $=(s,c=document)=>c.querySelector(s);
const $$=(s,c=document)=>Array.from((c||document).querySelectorAll(s));

function esc(s){return String(s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}

async function main(){
  const { db, fs, stMod } = await bootFirebase();
  const col = fs.collection(db, 'catalog');

  // Tabs
  $$('.tab').forEach(t=>t.addEventListener('click',()=>{
    $$('.tab').forEach(x=>x.classList.remove('active'));
    $$('.pane').forEach(x=>x.classList.remove('active'));
    t.classList.add('active'); $('#pane-'+t.dataset.id).classList.add('active');
  }));

  const form = $('#form');

  function v(id){ return $('#'+id).value }
  function fromForm(){
    return {
      type: v('f-type'),
      title: v('f-title').trim(),
      desc: v('f-desc').trim(),
      image: v('f-img').trim(),
      link: v('f-link').trim(),
      button: (v('f-btn')||'Boshlash').trim(),
      price: Number(v('f-price')||0),
      tag: v('f-tag'),
      cat: v('f-cat').trim(),
      cat2: v('f-cat2').trim(),
      cat3: v('f-cat3').trim(),
      mode: v('f-mode'),
      start: v('f-start')? new Date(v('f-start')): null,
      end: v('f-end')? new Date(v('f-end')): null,
      promotag: v('f-promotag').trim(),
      updatedAt: fs.serverTimestamp()
    };
  }
  function setForm(c){
    $('#f-type').value=c.type||'home';
    $('#f-title').value=c.title||'';
    $('#f-desc').value=c.desc||'';
    $('#f-img').value=c.image||'';
    $('#f-link').value=c.link||'';
    $('#f-btn').value=c.button||'Boshlash';
    $('#f-price').value=c.price||'';
    $('#f-tag').value=c.tag||'';
    $('#f-cat').value=c.cat||'';
    $('#f-cat2').value=c.cat2||'';
    $('#f-cat3').value=c.cat3||'';
    $('#f-mode').value=c.mode||'oddiy';
    $('#f-start').value=c.start||'';
    $('#f-end').value=c.end||'';
    $('#f-promotag').value=c.promotag||'';
  }

  function showOnly(){
    const t=$('#f-type').value;
    $$('.only-sim').forEach(x=>x.style.display=(t==='sim')?'block':'none');
    $$('.only-test').forEach(x=>x.style.display=(t==='test')?'block':'none');
    $$('.only-nothome').forEach(x=>x.style.display=(t==='home')?'none':'block');
  }
  $('#f-type').addEventListener('change', showOnly); showOnly();

  async function refreshList(){
    const qy = fs.query(col, fs.orderBy('updatedAt','desc'));
    const snap = await fs.getDocs(qy);
    const root = $('#list'); root.innerHTML='';
    snap.forEach(d=>{
      const c = d.data();
      const chips = [c.type, c.tag, c.cat, c.cat2, c.cat3].filter(Boolean).map(x=>`<span class="tag">${esc(String(x).toUpperCase())}</span>`).join(' ');
      const extra = [c.image?`Rasm: ${esc(c.image)}`:'', c.link?`Link: ${esc(c.link)}`:'', (c.price!=null && c.type!=='home')?`Narx: ${c.price}`:'', c.mode?`Rejim: ${esc(c.mode)}`:'', c.start?`Start: ${esc(c.start)}`:'', c.end?`End: ${esc(c.end)}`:''].filter(Boolean).join(' • ');
      const div = document.createElement('div');
      div.className='item';
      div.innerHTML = `
        <div>
          <div class="row" style="gap:8px;flex-wrap:wrap"><strong>${esc(c.title||'—')}</strong> ${chips}</div>
          <div style="color:#60827b;font-size:12px;margin-top:4px">${esc(c.desc||'')}</div>
          <div style="color:#8aa59d;font-size:12px;margin-top:4px">${extra}</div>
        </div>
        <div class="row">
          <button class="icbtn" title="Tahrirlash" data-act="edit" data-id="${d.id}">✎</button>
          <button class="icbtn" title="O‘chirish" data-act="del" data-id="${d.id}">🗑</button>
        </div>`;
      root.appendChild(div);
    });
  }

  // CREATE
  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    let data = fromForm();
    const file = $('#f-img-file').files[0];
    if(file){
      const r = stMod.ref(window.storage, `images/${Date.now()}_${file.name}`);
      await stMod.uploadBytes(r, file);
      data.image = await stMod.getDownloadURL(r);
    }
    if(!data.title){ alert('Sarlavha shart'); return; }
    await fs.addDoc(col, data);
    alert('Saqlangan!'); form.reset(); showOnly(); await refreshList();
  });

  // LIST actions
  $('#list').addEventListener('click', async (e)=>{
    const btn = e.target.closest('button[data-act]'); if(!btn) return;
    const id = btn.dataset.id; const act = btn.dataset.act;
    const dref = fs.doc(col, id);
    if(act==='del'){
      if(confirm('O‘chirish?')){ await fs.deleteDoc(dref); await refreshList(); }
    }
    if(act==='edit'){
      const snap = await fs.getDoc(dref);
      if(!snap.exists()) return alert('Topilmadi');
      const c = snap.data();
      setForm(c); showOnly();
      form.onsubmit = async (ev)=>{
        ev.preventDefault();
        let data = fromForm();
        const file2 = $('#f-img-file').files[0];
        if(file2){
          const r2 = stMod.ref(window.storage, `images/${id}_${file2.name}`);
          await stMod.uploadBytes(r2, file2);
          data.image = await stMod.getDownloadURL(r2);
        }
        data.updatedAt = fs.serverTimestamp();
        await fs.updateDoc(dref, data);
        alert('Yangilandi!');
        form.onsubmit = null;
        form.reset(); showOnly();
        await refreshList();
      }
    }
  });

  // Export / Import
  $('#ex-json')?.addEventListener('click', async()=>{
    const qy = fs.query(col, fs.orderBy('updatedAt','desc'));
    const snap = await fs.getDocs(qy);
    const arr=[]; snap.forEach(d=>arr.push({id:d.id, ...d.data()}));
    const blob = new Blob([JSON.stringify(arr, null, 2)], {type:'application/json'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'catalog-export.json'; a.click();
  });
  $('#im-json')?.addEventListener('change', async(e)=>{
    const file = e.target.files[0]; if(!file) return;
    const text = await file.text();
    const arr = JSON.parse(text);
    for(const x of arr){ const {id, ...data} = x; data.updatedAt = fs.serverTimestamp(); await fs.addDoc(col, data); }
    alert('Import qildi'); await refreshList();
  });

  await refreshList();
}

main().catch(console.error);
