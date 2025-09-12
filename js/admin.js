// admin.js — Mukammal Admin Pro (default export)
import { auth, db } from './app.js';
import {
  collection, doc, getDoc, getDocs, query, where, orderBy, limit, runTransaction,
  updateDoc, setDoc, addDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  getStorage, ref, uploadBytes, getDownloadURL, getMetadata, deleteObject
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

let mounted=false;
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const som=(v)=> new Intl.NumberFormat('uz-UZ').format(+v||0)+" so'm";

function guardAdmin(u){
  const id = Number(u?.numericId || u?.numeric_id || 0);
  if(!(id===1000001 || id===1000002)) throw new Error("Ruxsat yo'q");
  const key='admin_unlock';
  if(localStorage.getItem(key)!=='true'){
    const p = prompt("Admin paroli:");
    if(p !== 'Math@1999') throw new Error("Parol noto'g'ri");
    localStorage.setItem(key,'true');
  }
}

async function meDoc(){
  const uid = auth.currentUser?.uid;
  if(!uid) throw new Error("Kirish talab qilinadi");
  const s = await getDoc(doc(db,'users',uid));
  if(!s.exists()) throw new Error("User doc yo'q");
  return s.data();
}

function tabs(){
  $$('#tabs .tab').forEach(b=> b.onclick = ()=>{
    $$('#tabs .tab').forEach(x=>x.classList.toggle('active', x===b));
    $('#panel-users').style.display = b.dataset.tab==='users'?'block':'none';
    $('#panel-results').style.display = b.dataset.tab==='results'?'block':'none';
    $('#panel-csv').style.display = b.dataset.tab==='csv'?'block':'none';
    $('#panel-promo').style.display = b.dataset.tab==='promo'?'block':'none';
  });
}

function openModal(title, bodyHTML, footHTML){
  $('#modal-title').textContent = title;
  $('#modal-body').innerHTML = bodyHTML;
  $('#modal-foot').innerHTML = footHTML || '';
  $('#modal').setAttribute('aria-hidden','false');
  $('#modal-close').onclick = ()=> $('#modal').setAttribute('aria-hidden','true');
}

async function loadUsers(qstr){
  const list = [];
  const col = collection(db,'users');
  if(qstr && /^\d{4,}$/.test(qstr)){
    const qs = query(col, where('numericId','==', Number(qstr)), limit(60));
    (await getDocs(qs)).forEach(d=> list.push({id:d.id, ...d.data()}));
  }else if(qstr){
    const qs = query(col, orderBy('firstName'), limit(300));
    (await getDocs(qs)).forEach(d=>{
      const u=d.data(); const full=((u.firstName||'')+' '+(u.lastName||'')).toLowerCase();
      if(full.includes(qstr.toLowerCase())) list.push({id:d.id, ...u});
    });
  }else{
    const qs = query(col, orderBy('gems','desc'), limit(120));
    (await getDocs(qs)).forEach(d=> list.push({id:d.id, ...d.data()}));
  }
  $('#usr-count').textContent = list.length+' ta';
  renderUserGrid(list);
}

function userCard(u){
  return `<article class="card">
    <div class="body">
      <div class="top">
        <div class="avatar">👤</div>
        <div>
          <h4 class="name">${u.firstName||''} ${u.lastName||''} <span class="meta">#${u.numericId||''}</span></h4>
          <div class="meta">${u.region||''}/${u.district||''} · ${u.phone||''}</div>
        </div>
      </div>
      <div class="pills">
        <span class="pill">💰 ${som(u.balance||0)}</span>
        <span class="pill">💎 ${Number(u.gems||0)}</span>
        ${Array.isArray(u.badges)? u.badges.slice(0,4).map(b=>`<span class="pill">🏅 ${b}</span>`).join(''): ''}
      </div>
      <div class="actions">
        <button class="btn" data-act="edit" data-uid="${u.id}">Tahrirlash</button>
        <button class="btn" data-act="results" data-uid="${u.id}">Natijalar</button>
        <button class="btn" data-act="promo" data-uid="${u.id}">Promo berish</button>
      </div>
    </div>
  </article>`;
}

function renderUserGrid(list){
  const html = list.map(userCard).join('');
  $('#userGrid').innerHTML = html || '<div class="note">Foydalanuvchi topilmadi</div>';
  $$('#userGrid .btn').forEach(b=>{
    const uid = b.dataset.uid;
    if(b.dataset.act==='edit') b.onclick = ()=> openEditUser(uid);
    if(b.dataset.act==='results') b.onclick = ()=> openUserResults(uid);
    if(b.dataset.act==='promo') b.onclick = ()=> openGrantPromo(uid);
  });
}

async function openEditUser(uid){
  const s = await getDoc(doc(db,'users',uid)); const u = s.data();
  openModal('Foydalanuvchini tahrirlash', `
    <div class="row wrap">
      <div style="flex:1 1 260px">
        <label>Ism</label><input class="input" id="e-first" value="${u.firstName||''}">
        <label>Familiya</label><input class="input" id="e-last" value="${u.lastName||''}">
        <label>Viloyat</label><input class="input" id="e-reg" value="${u.region||''}">
        <label>Tuman</label><input class="input" id="e-dist" value="${u.district||''}">
        <label>Telefon</label><input class="input" id="e-phone" value="${u.phone||''}">
      </div>
      <div style="flex:1 1 260px">
        <label>Balans (so'm)</label><input class="input" id="e-balance" type="number" value="${u.balance||0}">
        <label>Olmos</label><input class="input" id="e-gems" type="number" value="${u.gems||0}">
        <label>Badges (JSON)</label><input class="input" id="e-badges" value='${JSON.stringify(u.badges||[])}'>
      </div>
    </div>
  `, `<button class="btn" id="save">Saqlash</button>`);
  $('#save').onclick = async ()=>{
    await updateDoc(doc(db,'users',uid), {
      firstName: $('#e-first').value.trim(),
      lastName: $('#e-last').value.trim(),
      region: $('#e-reg').value.trim(),
      district: $('#e-dist').value.trim(),
      phone: $('#e-phone').value.trim(),
      balance: Number($('#e-balance').value||0),
      gems: Number($('#e-gems').value||0),
      badges: JSON.parse($('#e-badges').value||"[]"),
      updatedAt: new Date()
    });
    $('#modal').setAttribute('aria-hidden','true');
    await loadUsers($('#usr-q').value.trim());
  };
}

function groupBy(arr, keyFn){
  const m = new Map();
  for(const it of arr){
    const k = keyFn(it);
    if(!m.has(k)) m.set(k, []);
    m.get(k).push(it);
  }
  return m;
}

async function openUserResults(uid){
  // fetch last 300 results of this user
  const col = collection(db,'results');
  const qs = query(col, where('userId','==', uid), orderBy('createdAt','desc'), limit(300));
  const list = []; (await getDocs(qs)).forEach(d=> list.push({id:d.id, ...d.data()}));
  // group by testId
  const g = groupBy(list, r => r.testId || r.title || '—');
  let body = '';
  for(const [test, rows] of g){
    // best by correctCount/good desc, then fastest time if exists
    const sorted = rows.slice().sort((a,b)=> (b.correctCount||b.good||0)-(a.correctCount||a.good||0));
    const best = sorted[0];
    body += `<div class="panel slim">
      <div class="row space"><b>${test}</b><span class="note">eng yaxshi: ${best?.correctCount||best?.good||0}</span></div>
      <table class="table">
        <tr><th>Sana</th><th>To'g'ri</th><th>Noto'g'ri</th><th>ΔOlmos</th></tr>
        ${sorted.map(r=>`<tr>
          <td>${r.createdAt?.toDate?.().toLocaleString?.()||''}</td>
          <td>${r.correctCount||r.good||0}</td>
          <td>${r.wrongCount||r.bad||0}</td>
          <td>${r.delta||0}</td>
        </tr>`).join('')}
      </table>
    </div>`;
  }
  openModal('Foydalanuvchi natijalari', body || '<div class="note">Natija topilmadi</div>', '');
}

async function loadGlobalResults(testFilter){
  // Build best-by-user per test ranking
  const col = collection(db,'results');
  let qs = query(col, orderBy('createdAt','desc'), limit(1000));
  const rows = []; (await getDocs(qs)).forEach(d=> rows.push(d.data()));
  // optionally filter by testId/title
  const filtered = testFilter ? rows.filter(r=> (r.testId||r.title||'').includes(testFilter)) : rows;
  // group by test -> user -> best
  const byTest = groupBy(filtered, r=> r.testId || r.title || '—');
  let out = '';
  for(const [test, arr] of byTest){
    const byUser = new Map();
    for(const r of arr){
      const uid = r.userId; const score = Number(r.correctCount||r.good||0);
      if(!byUser.has(uid) || score > byUser.get(uid).score){
        byUser.set(uid, { uid, score, when: r.createdAt });
      }
    }
    const ranking = Array.from(byUser.values()).sort((a,b)=> b.score - a.score).slice(0,100);
    out += `<div class="panel slim">
      <h4 style="margin:0 0 6px 0">${test}</h4>
      <table class="table"><tr><th>#</th><th>User</th><th>Ball</th></tr>${
        ranking.map((r,i)=>`<tr><td>${i+1}</td><td>${r.uid}</td><td>${r.score}</td></tr>`).join('')
      }</table>
    </div>`;
  }
  $('#res-global').innerHTML = out || '<div class="note">Hech narsa topilmadi</div>';
}

function bindResultsTab(){
  $('#res-load').onclick = ()=> loadGlobalResults($('#res-test').value.trim());
  loadGlobalResults('');
}

/* CSV */
function parseCSV(t){
  const rows=[]; let row=[],cell='',q=false;
  for(let i=0;i<t.length;i++){
    const ch=t[i];
    if(q){
      if(ch=='"'){ if(t[i+1]=='"'){cell+='"'; i++;} else q=false; } else cell+=ch;
    }else{
      if(ch=='"') q=true;
      else if(ch==','){ row.push(cell); cell=''; }
      else if(ch=='\n'||ch=='\r'){ if(cell!==''||row.length){row.push(cell); rows.push(row); row=[]; cell='';} }
      else cell+=ch;
    }
  }
  if(cell!==''||row.length){ row.push(cell); rows.push(row); }
  return rows;
}

function renderCSVPreview(text){
  const rows = parseCSV(text).slice(0,25);
  const html = `<table class="table">${rows.map((r,i)=>`<tr>${r.map(c=> i? `<td>${c}</td>`:`<th>${c}</th>`).join('')}</tr>`).join('')}</table>`;
  $('#csv-preview').innerHTML = html;
}

function bindCSV(){
  const ta = $('#csv-editor');
  ta.addEventListener('input', ()=> renderCSVPreview(ta.value));
  // open
  $('#csv-open').onclick = async ()=>{
    const path = $('#csv-path').value.trim();
    const url = `/${path}?v=${Date.now()}`;
    const res = await fetch(url); const text = await res.text();
    ta.value = text; renderCSVPreview(text);
  };
  // drag drop
  const file = $('#csv-file');
  file.addEventListener('change', async ()=>{
    const f = file.files[0]; const txt = await f.text();
    ta.value = txt; renderCSVPreview(txt);
  });
  // save
  $('#csv-save').onclick = async ()=>{
    const path = $('#csv-path').value.trim() || ('csv/uploads/'+Date.now()+'.csv');
    const storage = getStorage();
    const r = ref(storage, path);
    const blob = new Blob([ta.value], {type:'text/csv'});
    await uploadBytes(r, blob);
    const url = await getDownloadURL(r);
    alert('CSV saqlandi: '+url);
  };
}

/* Promo */
function bindPromo(){
  $('#pr-open').onclick = ()=>{
    openModal('Yangi promo', `
      <div class="row wrap">
        <input class="input" id="pr-code" placeholder="KOD (PROMO2025)">
        <input class="input" id="pr-discount" type="number" placeholder="Chegirma % (0-100)">
        <input class="input" id="pr-credit" type="number" placeholder="Hisobga pul (so'm)">
        <input class="input" id="pr-expires" type="datetime-local">
        <input class="input" id="pr-uses" type="number" placeholder="Necha marta ishlatiladi (maxUses)">
      </div>
    `, `<button class="btn primary" id="pr-save">Yaratish</button>`);
    $('#pr-save').onclick = async ()=>{
      const code = String($('#pr-code').value||'').trim();
      const discountPct = Number($('#pr-discount').value||0);
      const creditSom = Number($('#pr-credit').value||0);
      const expires = $('#pr-expires').value ? new Date($('#pr-expires').value) : null;
      const maxUses = Number($('#pr-uses').value||0);
      if(!code) return alert('Kod kiriting');
      await setDoc(doc(db,'promos', code), {
        code, discountPct, creditSom,
        expiresAt: expires, maxUses,
        usedCount: 0, active: true,
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser?.uid||''
      });
      $('#modal').setAttribute('aria-hidden','true');
      await listPromos();
    };
  };
  listPromos();
}

async function listPromos(){
  const snap = await getDocs(query(collection(db,'promos'), orderBy('createdAt','desc'), limit(200)));
  let html = `<table class="table"><tr><th>Kod</th><th>%</th><th>+so'm</th><th>muddat</th><th>max</th><th>used</th><th>active</th></tr>`;
  snap.forEach(d=>{
    const p=d.data();
    const exp = p.expiresAt?.toDate?.().toLocaleString?.()||'-';
    html += `<tr><td>${p.code}</td><td>${p.discountPct||0}</td><td>${p.creditSom||0}</td><td>${exp}</td><td>${p.maxUses||0}</td><td>${p.usedCount||0}</td><td>${p.active?'✅':'❌'}</td></tr>`;
  });
  html += `</table>`;
  $('#promo-table').innerHTML = html;
}

/* Grant promo to user (mark as used + credit) */
async function openGrantPromo(uid){
  openModal('Promoni berish', `
    <div class="row wrap">
      <input class="input" id="gp-code" placeholder="KOD (mavjud promosdan)">
    </div>
  `, `<button class="btn primary" id="gp-apply">Qo'llash</button>`);
  $('#gp-apply').onclick = async ()=>{
    const code = String($('#gp-code').value||'').trim();
    if(!code) return;
    await runTransaction(db, async (tx)=>{
      const pRef = doc(db,'promos', code);
      const uRef = doc(db,'users', uid);
      const [ps, us] = await Promise.all([tx.get(pRef), tx.get(uRef)]);
      if(!ps.exists()) throw new Error("Promo topilmadi");
      const p = ps.data();
      if(p.active===false) throw new Error("Promo faol emas");
      if(p.maxUses && Number(p.usedCount||0) >= Number(p.maxUses)) throw new Error("Promo limiti tugagan");
      if(p.expiresAt && p.expiresAt.toDate && p.expiresAt.toDate() < new Date()) throw new Error("Muddati o'tgan");
      const u = us.data(); const used = new Set(u.usedPromos||[]);
      if(used.has(code)) throw new Error("Bu promo foydalanuvchi tomonidan ishlatilgan");
      const credit = Number(p.creditSom||0);
      const newBal = Number(u.balance||0) + credit;
      used.add(code);
      tx.update(uRef, { balance:newBal, usedPromos:Array.from(used), updatedAt: serverTimestamp() });
      tx.update(pRef, { usedCount: Number(p.usedCount||0)+1 });
    });
    alert('Promo qo‘llandi');
    $('#modal').setAttribute('aria-hidden','true');
    await loadUsers($('#usr-q').value.trim());
  };
}

/* INIT */
async function init(root){
  if(mounted) return; mounted=true;
  const u = await meDoc(); guardAdmin(u);
  $('#adminUserBadge').textContent = `Admin: ${u.firstName||''} ${u.lastName||''} (#${u.numericId||''})`;
  tabs();

  $('#usr-search').onclick = ()=> loadUsers($('#usr-q').value.trim());
  await loadUsers("");

  bindResultsTab();
  bindCSV();
  bindPromo();
}

function destroy(){ mounted=false; }

export default { init, destroy };
