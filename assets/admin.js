/* Admin FAB + Modal (tests stepper + promo CRUD/history) */
const A$ = (s,r=document)=>r.querySelector(s);
const A$$ = (s,r=document)=>Array.from(r.querySelectorAll(s));
const Aesc = s => (s||'').replace(/[&<>"']/g, m=>({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));

const ADM = { isAdmin:false, tests:[], promos:[] };

function ensureAdminUI(){
  if (A$('#admin-fab')) return;
  const btn = document.createElement('button');
  btn.id='admin-fab'; btn.textContent='Admin';
  btn.style.cssText=`position:fixed; right:18px; bottom:18px; z-index:1001; padding:12px 16px; border-radius:14px; border:1px solid #bfe6c8; background:#4CAF50; color:#fff; font-weight:700; box-shadow:0 12px 28px rgba(0,0,0,.22); display:none; cursor:pointer;`;
  btn.addEventListener('click', ()=> A$('#admin-modal').style.display='flex');
  document.body.appendChild(btn);

  const wrap = document.createElement('div');
  wrap.innerHTML = `<div class="modal-backdrop" id="admin-modal">
    <div class="modal" style="max-width:980px; width:96%">
      <header><b>Admin Panel</b><button class="close" id="admin-close">×</button></header>
      <div style="padding:12px; display:grid; grid-template-columns:240px 1fr; gap:12px">
        <aside class="granite-card" style="padding:8px">
          <div style="font-weight:700; margin-bottom:8px">Bo'limlar</div>
          <button class="tab-btn" data-admin-tab="tests">Testlar</button>
          <button class="tab-btn" data-admin-tab="promos">Promo kodlar</button>
        </aside>
        <section id="admin-content" style="min-height:380px"></section>
      </div></div></div>`;
  document.body.appendChild(wrap.firstElementChild);
  A$('#admin-close').addEventListener('click', ()=> A$('#admin-modal').style.display='none');
  A$('#admin-modal').addEventListener('click', e=>{ if(e.target.id==='admin-modal') e.currentTarget.style.display='none'; });
  A$$('[data-admin-tab]').forEach(b=> b.addEventListener('click', e=> openAdminTab(e.target.getAttribute('data-admin-tab')) ));
}
function setAdminVisible(v){ ADM.isAdmin=!!v; const fab=A$('#admin-fab'); if(fab) fab.style.display = v ? 'inline-block':'none'; }
async function checkAdminClaim(){
  const user = firebase.auth().currentUser; if(!user){ setAdminVisible(false); return; }
  const tok = await user.getIdTokenResult(true).catch(()=>null); setAdminVisible(!!tok?.claims?.admin);
}
firebase.auth().onAuthStateChanged(()=>{ ensureAdminUI(); checkAdminClaim(); });

function renderTestsTab(){
  const el = document.createElement('div');
  el.innerHTML = `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px">
    <h3 style="margin:0">Testlar</h3><button class="primary" id="btn-new-test">+ Yangi test</button></div>
    <div id="tests-list" class="grid"></div>`;
  return el;
}
async function loadTestsAdmin(){
  const list = A$('#tests-list'); if(!list) return;
  const snap = await db.collection('tests').orderBy('title').get();
  ADM.tests = snap.docs.map(d=>({ id:d.id, ...d.data() }));
  list.innerHTML = ADM.tests.map(t=>`<div class="card"><div class="content">
    <div style="display:flex; justify-content:space-between; align-items:center">
      <div><div class="title">${Aesc(t.title||'Test')}</div>
      <div class="meta">${(t.questions?.length||0)} ta savol • ${(t.timerSec||(t.durationMin?t.durationMin*60:1800))} s</div></div>
      <div style="display:flex; gap:8px">
        <button class="tab-btn" data-edit="${t.id}">Tahrirlash</button>
        <button class="tab-btn" data-del="${t.id}">O'chirish</button>
      </div></div></div></div>`).join('');
  A$$('[data-edit]').forEach(b=> b.addEventListener('click', ()=> openTestEditor(b.getAttribute('data-edit')) ));
  A$$('[data-del]').forEach(b=> b.addEventListener('click', async ()=>{ if(!confirm('O‘chirish?')) return; await db.collection('tests').doc(b.getAttribute('data-del')).delete(); await loadTestsAdmin(); }));
  A$('#btn-new-test')?.addEventListener('click', ()=> openTestEditor(null));
}
function ensureTestEditor(){
  if (A$('#test-editor')) return;
  const host = document.createElement('div');
  host.innerHTML = `<div class="modal-backdrop" id="test-editor"><div class="modal" style="max-width:820px; width:96%">
    <header><b id="te-title">Test tahrirlash</b><button class="close" id="te-close">×</button></header>
    <div style="padding:12px">
      <div id="te-stepper" style="display:flex; gap:8px; margin-bottom:10px">
        <span class="badge" data-step="1">1. Asosiy</span>
        <span class="badge" data-step="2">2. Savollar</span>
        <span class="badge" data-step="3">3. Ko‘rib chiqish</span>
      </div>
      <div id="te-content"></div>
      <div style="display:flex; justify-content:space-between; gap:8px; margin-top:12px">
        <button class="tab-btn" id="te-prev">← Oldingi</button>
        <div style="display:flex; gap:8px">
          <button class="tab-btn" id="te-next">Keyingi →</button>
          <button class="primary" id="te-save">Saqlash</button>
        </div></div></div></div></div>`;
  document.body.appendChild(host.firstElementChild);
  A$('#te-close').addEventListener('click', ()=> A$('#test-editor').style.display='none');
  A$('#test-editor').addEventListener('click', e=>{ if(e.target.id==='test-editor') e.currentTarget.style.display='none'; });
}
ensureTestEditor();
let TE=null;
function stepUI(idx){ A$$('#te-stepper .badge').forEach(b=>{ b.style.background=(parseInt(b.getAttribute('data-step'),10)===idx)?'#E8F5E9':''; b.style.borderColor=(parseInt(b.getAttribute('data-step'),10)===idx)?'#bfe6c8':''; }); }
function renderStep1(){
  const d=TE.data;
  A$('#te-content').innerHTML = `<div class="grid" style="grid-template-columns:repeat(12,1fr); gap:10px">
    <div style="grid-column:span 8"><label>Sarlavha</label><input id="te-title-in" type="text" value="${Aesc(d.title||'')}" placeholder="Masalan: Algebra testi"/></div>
    <div style="grid-column:span 2"><label>Holat</label><select id="te-status">
      <option value="free" ${d.status==='free'?'selected':''}>free</option>
      <option value="pro" ${d.status==='pro'?'selected':''}>pro</option>
      <option value="new" ${d.status==='new'?'selected':''}>new</option></select></div>
    <div style="grid-column:span 2"><label>Turi</label><select id="te-type">
      <option value="online" ${d.type==='online'?'selected':''}>online</option>
      <option value="oddiy" ${d.type==='oddiy'?'selected':''}>oddiy</option></select></div>
    <div style="grid-column:span 4"><label>Timer (sekund)</label><input id="te-timer" type="text" value="${Number(d.timerSec||(d.durationMin?d.durationMin*60:1800))}"/></div>
    <div style="grid-column:span 8"><label>Tavsif</label><input id="te-desc" type="text" value="${Aesc(d.description||'')}"/></div></div>`;
}
function renderQuestionRow(q,i){
  const opts = q.options || [q.A,q.B,q.C,q.D].filter(Boolean); const optInputs=(opts.length?opts:['','','','']).slice(0,4);
  return `<div class="granite-card" style="padding:10px">
    <div style="display:flex; justify-content:space-between; align-items:center"><b>${i+1}.</b>
      <div style="display:flex; gap:6px">
        <button class="tab-btn" data-up="${i}">↑</button>
        <button class="tab-btn" data-down="${i}">↓</button>
        <button class="tab-btn" data-delq="${i}">×</button></div></div>
    <label style="margin-top:6px">Savol matni</label>
    <input data-q="${i}" class="te-q" type="text" value="${Aesc(q.q||'')}" placeholder="Savol..."/>
    <div class="grid" style="grid-template-columns:repeat(12,1fr); gap:8px; margin-top:6px">
      ${optInputs.map((v,oi)=>`<div style="grid-column:span 6"><label>Variant ${String.fromCharCode(65+oi)}</label><input data-o="${i}:${oi}" class="te-o" type="text" value="${Aesc(v||'')}"/></div>`).join('')}
      <div style="grid-column:span 4"><label>To‘g‘ri javob</label>
        <select data-corr="${i}" class="te-corr">
          ${[0,1,2,3].map(oi=>`<option value="${oi}" ${q.correctIndex===oi?'selected':''}>${String.fromCharCode(65+oi)}</option>`).join('')}
        </select></div>
      <div style="grid-column:span 8"><label>Izoh (ixtiyoriy)</label><input data-ex="${i}" class="te-ex" type="text" value="${Aesc(q.explanation||'')}"/></div>
    </div></div>`;
}
function renderStep2(){
  const qs=TE.data.questions;
  A$('#te-content').innerHTML = `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px">
    <h4 style="margin:0">Savollar (${qs.length})</h4><button class="primary" id="te-add-q">+ Savol qo'shish</button></div>
    <div id="te-qlist" class="grid" style="gap:10px">${qs.map((q,i)=>renderQuestionRow(q,i)).join('')}</div>`;
  A$('#te-add-q').addEventListener('click', ()=>{ TE.data.questions.push({ q:'', options:['','','',''], correctIndex:0 }); renderStep2(); });
  A$$('[data-delq]').forEach(b=> b.addEventListener('click', ()=>{ const i=parseInt(b.getAttribute('data-delq'),10); TE.data.questions.splice(i,1); renderStep2(); }));
  A$$('[data-up]').forEach(b=> b.addEventListener('click', ()=>{ const i=parseInt(b.getAttribute('data-up'),10); if(i>0){ const tmp=TE.data.questions[i-1]; TE.data.questions[i-1]=TE.data.questions[i]; TE.data.questions[i]=tmp; renderStep2(); } }));
  A$$('[data-down]').forEach(b=> b.addEventListener('click', ()=>{ const i=parseInt(b.getAttribute('data-down'),10); if(i<TE.data.questions.length-1){ const tmp=TE.data.questions[i+1]; TE.data.questions[i+1]=TE.data.questions[i]; TE.data.questions[i]=tmp; renderStep2(); } }));
  A$$('.te-q').forEach(inp=> inp.addEventListener('input', e=>{ const i=parseInt(e.target.getAttribute('data-q'),10); TE.data.questions[i].q = e.target.value; }));
  A$$('.te-o').forEach(inp=> inp.addEventListener('input', e=>{ const [i,oi]=e.target.getAttribute('data-o').split(':').map(x=>parseInt(x,10)); const arr=TE.data.questions[i].options||(TE.data.questions[i].options=['','','','']); arr[oi]=e.target.value; }));
  A$$('.te-corr').forEach(sel=> sel.addEventListener('change', e=>{ const i=parseInt(e.target.getAttribute('data-corr'),10); TE.data.questions[i].correctIndex=parseInt(e.target.value,10); }));
  A$$('.te-ex').forEach(inp=> inp.addEventListener('input', e=>{ const i=parseInt(e.target.getAttribute('data-ex'),10); TE.data.questions[i].explanation=e.target.value; }));
}
function renderStep3(){
  const d=TE.data;
  A$('#te-content').innerHTML = `<div class="granite-card" style="padding:10px">
    <div><b>Sarlavha:</b> ${Aesc(d.title||'')}</div>
    <div><b>Tavsif:</b> ${Aesc(d.description||'')}</div>
    <div><b>Timer:</b> ${Number(d.timerSec)} s</div>
    <div><b>Holat:</b> ${Aesc(d.status||'')}</div>
    <div><b>Turi:</b> ${Aesc(d.type||'')}</div>
    <div style="margin-top:8px"><b>Savollar:</b> ${d.questions.length} ta</div></div>`;
}
async function openTestEditor(id){
  if(!ADM.isAdmin) return alert('Admin huquqi kerak');
  ensureTestEditor();
  A$('#te-title').textContent = id? 'Test tahrirlash' : 'Yangi test';
  A$('#test-editor').style.display='flex';
  let data={ title:'', description:'', status:'free', type:'online', timerSec:1800, questions:[] }, ref=null;
  if (id){ ref = db.collection('tests').doc(id); const snap=await ref.get(); if (snap.exists) data={...data, ...snap.data()}; }
  TE = { step:1, ref, id, data };
  stepUI(1); renderStep1();
  A$('#te-prev').onclick = ()=>{ if(TE.step>1){ TE.step--; stepUI(TE.step); (TE.step===1?renderStep1:TE.step===2?renderStep2:renderStep3)(); } };
  A$('#te-next').onclick = ()=>{ if(TE.step<3){ if(TE.step===1){ TE.data.title=A$('#te-title-in').value.trim(); TE.data.description=A$('#te-desc').value.trim(); TE.data.status=A$('#te-status').value; TE.data.type=A$('#te-type').value; TE.data.timerSec=Number(A$('#te-timer').value)||1800; } TE.step++; stepUI(TE.step); (TE.step===2?renderStep2:renderStep3)(); } };
  A$('#te-save').onclick = async ()=>{
    if(TE.step===1){ TE.data.title=A$('#te-title-in').value.trim(); TE.data.description=A$('#te-desc').value.trim(); TE.data.status=A$('#te-status').value; TE.data.type=A$('#te-type').value; TE.data.timerSec=Number(A$('#te-timer').value)||1800; }
    const payload = {
      title: TE.data.title||'Test', description: TE.data.description||'', status: TE.data.status||'free', type: TE.data.type||'online',
      timerSec: Number(TE.data.timerSec)||1800,
      questions: (TE.data.questions||[]).map(q=>({ q:q.q||'', options:(q.options||['','','','']).slice(0,4), correctIndex: Number(q.correctIndex)||0, explanation: q.explanation||'' })),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    try {
      if (TE.id){ await db.collection('tests').doc(TE.id).set(payload,{merge:true}); }
      else { payload.createdAt=firebase.firestore.FieldValue.serverTimestamp(); const docRef=await db.collection('tests').add(payload); TE.id=docRef.id; }
      alert('Saqlangan!'); A$('#test-editor').style.display='none'; await loadTestsAdmin();
    } catch(e){ console.error(e); alert(e.message||'Xatolik'); }
  };
}
function renderPromosTab(){
  const el=document.createElement('div');
  el.innerHTML = `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px">
    <h3 style="margin:0">Promo kodlar</h3><button class="primary" id="btn-new-promo">+ Yangi promo</button></div>
    <div id="promos-list" class="grid"></div>`;
  return el;
}
async function loadPromosAdmin(){
  const list=A$('#promos-list'); if(!list) return;
  const snap = await db.collection('promocodes').orderBy('code').get();
  ADM.promos = snap.docs.map(d=>({ id:d.id, ...d.data() }));
  list.innerHTML = ADM.promos.map(p=>`<div class="card"><div class="content">
    <div style="display:flex; justify-content:space-between; align-items:center">
    <div><div class="title">${Aesc(p.code)}</div>
    <div class="meta">${p.discountPct||0}% • max ${p.maxUses||0} • used ${p.usedCount||0} • ${p.perUserOnce?'1x/user':''} ${p.expiresAt? '• tugash: '+ new Date(p.expiresAt.seconds*1000).toLocaleDateString() : ''}</div></div>
    <div style="display:flex; gap:8px">
      <button class="tab-btn" data-promo-edit="${p.id}">Tahrirlash</button>
      <button class="tab-btn" data-promo-del="${p.id}">O'chirish</button>
      <button class="tab-btn" data-promo-hist="${p.id}">Tarix</button>
    </div></div></div></div>`).join('');
  A$$('[data-promo-edit]').forEach(b=> b.addEventListener('click', ()=> openPromoEditor(b.getAttribute('data-promo-edit')) ));
  A$$('[data-promo-del]').forEach(b=> b.addEventListener('click', async ()=>{ if(!confirm('O‘chirishni tasdiqlaysizmi?')) return; await db.collection('promocodes').doc(b.getAttribute('data-promo-del')).delete(); await loadPromosAdmin(); }));
  A$$('[data-promo-hist]').forEach(b=> b.addEventListener('click', ()=> openPromoHistory(b.getAttribute('data-promo-hist')) ));
  A$('#btn-new-promo')?.addEventListener('click', ()=> openPromoEditor(null));
}
function ensurePromoEditor(){
  if (A$('#promo-editor')) return;
  const host=document.createElement('div');
  host.innerHTML = `<div class="modal-backdrop" id="promo-editor"><div class="modal" style="max-width:720px; width:96%">
    <header><b id="pe-title">Promo kod</b><button class="close" id="pe-close">×</button></header>
    <div style="padding:12px"><div class="grid" style="grid-template-columns:repeat(12,1fr); gap:10px">
      <div style="grid-column:span 5"><label>Kod</label><input id="pe-code" type="text" placeholder="BACK2SCHOOL"/></div>
      <div style="grid-column:span 3"><label>Chegirma %</label><input id="pe-disc" type="text" value="20"/></div>
      <div style="grid-column:span 4"><label>Maks. ishlatish</label><input id="pe-max" type="text" value="100"/></div>
      <div style="grid-column:span 4"><label>Per user 1x</label><select id="pe-peruser"><option value="true">ha</option><option value="false">yo‘q</option></select></div>
      <div style="grid-column:span 4"><label>Tugash (YYYY-MM-DD)</label><input id="pe-exp" type="text" placeholder="2025-12-31"/></div>
      <div style="grid-column:span 4; display:grid; place-items:end"><button class="primary" id="pe-save">Saqlash</button></div>
    </div></div></div></div>`;
  document.body.appendChild(host.firstElementChild);
  A$('#pe-close').addEventListener('click', ()=> A$('#promo-editor').style.display='none');
  A$('#promo-editor').addEventListener('click', e=>{ if(e.target.id==='promo-editor') e.currentTarget.style.display='none'; });
}
ensurePromoEditor();
let PE=null;
async function openPromoEditor(id){
  if(!ADM.isAdmin) return alert('Admin huquqi kerak');
  A$('#promo-editor').style.display='flex'; A$('#pe-title').textContent = id? 'Promo tahrirlash':'Yangi promo';
  PE={ id, ref: id? db.collection('promocodes').doc(id): null, data:{} };
  if(id){ const snap=await PE.ref.get(); const d=snap.data(); A$('#pe-code').value=d.code||''; A$('#pe-disc').value=d.discountPct||0; A$('#pe-max').value=d.maxUses||0; A$('#pe-peruser').value=String(!!d.perUserOnce); A$('#pe-exp').value = d.expiresAt? new Date(d.expiresAt.seconds*1000).toISOString().slice(0,10):''; }
  else { A$('#pe-code').value=''; A$('#pe-disc').value=20; A$('#pe-max').value=100; A$('#pe-peruser').value='true'; A$('#pe-exp').value=''; }
  A$('#pe-save').onclick = async ()=>{
    const code=A$('#pe-code').value.trim().toUpperCase(); if(!code) return alert('Kod kiriting');
    const data={ code, discountPct:Number(A$('#pe-disc').value)||0, maxUses:Number(A$('#pe-max').value)||0, usedCount:0, perUserOnce: A$('#pe-peruser').value==='true', expiresAt: A$('#pe-exp').value? firebase.firestore.Timestamp.fromDate(new Date(A$('#pe-exp').value+'T00:00:00')): null, updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
    try{ if(PE.id){ await PE.ref.set(data,{merge:true}); } else { data.createdAt=firebase.firestore.FieldValue.serverTimestamp(); await db.collection('promocodes').doc(code).set(data,{merge:true}); } alert('Saqlangan'); A$('#promo-editor').style.display='none'; await loadPromosAdmin(); }catch(e){ console.error(e); alert(e.message||'Xatolik'); }
  };
}
async function openPromoHistory(id){
  const ref = db.collection('promocodes').doc(id);
  const snap = await ref.get(); const d=snap.data();
  const rh = await ref.collection('redemptions').orderBy('redeemedAt','desc').limit(50).get();
  const items = rh.docs.map(x=>x.data());
  const area = A$('#admin-content'); area.innerHTML = `<div class="granite-card" style="padding:10px">
    <div class="title">${Aesc(d.code)} — Tarix (oxirgi ${items.length})</div>
    <div class="grid" style="grid-template-columns: repeat(12,1fr); gap:8px; margin-top:8px">
      <div style="grid-column: span 4"><b>Foydalanuvchi</b></div>
      <div style="grid-column: span 3"><b>Amount</b></div>
      <div style="grid-column: span 3"><b>Chegirma%</b></div>
      <div style="grid-column: span 2"><b>Sana</b></div>
      ${items.map(it=>`
        <div style="grid-column: span 4">${Aesc(it.uid||'')}</div>
        <div style="grid-column: span 3">${it.amount||0}</div>
        <div style="grid-column: span 3">${it.discountPct||0}</div>
        <div style="grid-column: span 2">${it.redeemedAt?.toDate? it.redeemedAt.toDate().toLocaleDateString() : ''}</div>
      `).join('')}
    </div></div>`;
}
async function openAdminTab(key){
  const area=A$('#admin-content'); if(!area) return;
  if(key==='tests'){ area.innerHTML=''; area.appendChild(renderTestsTab()); await loadTestsAdmin(); }
  else if(key==='promos'){ area.innerHTML=''; area.appendChild(renderPromosTab()); await loadPromosAdmin(); }
}
document.addEventListener('DOMContentLoaded', ()=>{ ensureAdminUI(); });
