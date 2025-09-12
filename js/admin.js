// js/admin.js — default export { init, destroy }
import { auth, db } from './app.js';
import {
  collection, doc, getDoc, getDocs, query, where, orderBy, limit,
  updateDoc, setDoc, addDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  getStorage, ref, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

let mounted=false, aborter=null;
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));

function guardAdmin(userDoc){
  const id = Number(userDoc?.numericId||0);
  const ok = id===1000001 || id===1000002;
  if(!ok) throw new Error("Ruxsat yo'q (numericId)");
  // password gate
  const key="admin_unlock";
  const unlocked = localStorage.getItem(key)==="true";
  if(!unlocked){
    const pass = prompt("Admin paroli:"); // minimal gate
    if(pass !== "Math@1999") throw new Error("Parol noto'g'ri");
    localStorage.setItem(key,"true");
  }
}

async function readMe(){
  const uid = auth.currentUser?.uid;
  if(!uid) throw new Error("Kirish talab qilinadi");
  const meRef = doc(db,'users',uid);
  const meSnap = await getDoc(meRef);
  if(!meSnap.exists()) throw new Error("User doc yo'q");
  return meSnap.data();
}

function setActiveTab(name){
  $$('.tabs .tab').forEach(b=> b.classList.toggle('active', b.dataset.tab===name));
  $('#panel-users').style.display = name==='users'?'block':'none';
  $('#panel-results').style.display = name==='results'?'block':'none';
  $('#panel-csv').style.display = name==='csv'?'block':'none';
  $('#panel-promo').style.display = name==='promo'?'block':'none';
}

async function loadUsers(qstr){
  const list = [];
  // try by numericId or name prefix
  const col = collection(db,'users');
  if(qstr && /^\d{4,}$/.test(qstr)){
    const qs = query(col, where('numericId','==', Number(qstr)), limit(50));
    (await getDocs(qs)).forEach(d=> list.push({id:d.id, ...d.data()}));
  }else if(qstr){
    const qs = query(col, orderBy('firstName'), limit(200));
    (await getDocs(qs)).forEach(d=>{
      const u=d.data(); const full=((u.firstName||'')+' '+(u.lastName||'')).toLowerCase();
      if(full.includes(qstr.toLowerCase())) list.push({id:d.id, ...u});
    });
  }else{
    const qs = query(col, orderBy('gems','desc'), limit(100));
    (await getDocs(qs)).forEach(d=> list.push({id:d.id, ...d.data()}));
  }
  const html = `<table class="table"><tr><th>UID</th><th>Ism</th><th>Viloyat</th><th>Balans</th><th>Olmos</th><th></th></tr>${
    list.map(u=>`<tr>
      <td class="note">${u.id}</td>
      <td>${u.firstName||''} ${u.lastName||''}</td>
      <td>${u.region||''}/${u.district||''}</td>
      <td>${Number(u.balance||0).toLocaleString()}</td>
      <td>${Number(u.gems||0).toLocaleString()}</td>
      <td><button class="btn" data-uid="${u.id}">Tahrirlash</button></td></tr>`).join('')
  }</table>`;
  $('#usr-table-wrap').innerHTML = html;
  $$('#usr-table-wrap button').forEach(b=> b.onclick = ()=> editUser(b.dataset.uid));
}

async function editUser(uid){
  const uref = doc(db,'users',uid);
  const s = await getDoc(uref);
  if(!s.exists()) return;
  const u = s.data();
  $('#usr-edit').innerHTML = `
    <h3 style="margin-top:0">Tahrirlash</h3>
    <div class="grid2">
      <div>
        <label>Ism</label>
        <input class="input" id="e-first" value="${u.firstName||''}">
        <label>Familiya</label>
        <input class="input" id="e-last" value="${u.lastName||''}">
        <label>Viloyat</label>
        <input class="input" id="e-reg" value="${u.region||''}">
        <label>Tuman</label>
        <input class="input" id="e-dist" value="${u.district||''}">
        <label>Telefon</label>
        <input class="input" id="e-phone" value="${u.phone||''}">
      </div>
      <div>
        <label>Balans (so'm)</label>
        <input class="input" id="e-balance" type="number" value="${u.balance||0}">
        <label>Olmos</label>
        <input class="input" id="e-gems" type="number" value="${u.gems||0}">
        <label>Badges (JSON)</label>
        <input class="input" id="e-badges" value='${JSON.stringify(u.badges||[])}'>
        <div class="row"><button class="btn primary" id="e-save">Saqlash</button></div>
      </div>
    </div>
  `;
  $('#e-save').onclick = async ()=>{
    const data = {
      firstName: $('#e-first').value.trim(),
      lastName: $('#e-last').value.trim(),
      region: $('#e-reg').value.trim(),
      district: $('#e-dist').value.trim(),
      phone: $('#e-phone').value.trim(),
      balance: Number($('#e-balance').value||0),
      gems: Number($('#e-gems').value||0),
      badges: JSON.parse($('#e-badges').value||"[]"),
      updatedAt: new Date()
    };
    await updateDoc(uref, data);
    alert("Saqlandi"); await loadUsers($('#usr-q').value.trim());
  };
}

async function loadResults(uidFilter, testFilter){
  const rows = [];
  try{
    const col = collection(db,'results');
    let qs;
    if(uidFilter && testFilter){
      qs = query(col, where('userId','==',uidFilter), where('testId','==',testFilter), orderBy('createdAt','desc'), limit(200));
    }else if(uidFilter){
      qs = query(col, where('userId','==',uidFilter), orderBy('createdAt','desc'), limit(200));
    }else{
      qs = query(col, orderBy('createdAt','desc'), limit(200));
    }
    const snap = await getDocs(qs);
    snap.forEach(d=> rows.push(d.data()));
  }catch(e){
    console.warn("results kolleksiyasi bo'lmasligi mumkin, users.lastResult ga o'tamiz", e.message);
  }
  const html = `<table class="table"><tr>
    <th>User</th><th>Test</th><th>To'g'ri</th><th>Noto'g'ri</th><th>Olmos Δ</th><th>Sana</th></tr>${
    rows.map(r=>`<tr>
      <td>${r.userId||''}</td>
      <td>${r.title||r.testId||''}</td>
      <td>${r.good||r.correctCount||0}</td>
      <td>${r.bad||r.wrongCount||0}</td>
      <td>${r.delta||0}</td>
      <td>${r.createdAt?.toDate?.().toLocaleString?.()||''}</td>
    </tr>`).join('')
  }</table>`;
  $('#res-table-wrap').innerHTML = html || "<div class='note'>Ma'lumot topilmadi</div>";
}

async function csvUpload(){
  const f = $('#csv-file').files[0];
  const path = $('#csv-path').value.trim() || ('csv/uploads/'+Date.now()+'.csv');
  if(!f) return alert("Fayl tanlang");
  const storage = getStorage();
  const r = ref(storage, path);
  await uploadBytes(r, f);
  const url = await getDownloadURL(r);
  $('#csv-preview').innerHTML = `<div class="note">Yuklandi: <a href="${url}" target="_blank">${url}</a></div>`;
}

async function promoCreate(){
  const code = $('#pr-code').value.trim();
  const discountPct = Number($('#pr-discount').value||0);
  const creditSom = Number($('#pr-credit').value||0);
  const expires = $('#pr-expires').value ? new Date($('#pr-expires').value) : null;
  const maxUses = Number($('#pr-uses').value||0);
  if(!code) return alert("Kod kiriting");
  const data = {
    code, discountPct, creditSom,
    expiresAt: expires, maxUses,
    usedCount: 0, active: true,
    createdAt: serverTimestamp(),
    createdBy: auth.currentUser?.uid||""
  };
  await setDoc(doc(db,'promos', code), data);
  alert("Promo yaratildi"); await listPromos();
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
  $('#promo-table-wrap').innerHTML = html;
}

async function init(root){
  if(mounted) destroy();
  mounted=true; aborter = new AbortController();
  const me = await readMe();
  guardAdmin(me);
  $('#adminUserBadge').textContent = `Admin: ${me.firstName||''} ${me.lastName||''} (#${me.numericId||''})`;

  // tabs
  $$('.tabs .tab').forEach(b=> b.onclick = ()=> setActiveTab(b.dataset.tab));

  // users
  $('#usr-search').onclick = ()=> loadUsers($('#usr-q').value.trim());
  await loadUsers("");

  // results
  $('#res-load').onclick = ()=> loadResults($('#res-user-id').value.trim(), $('#res-test-id').value.trim());

  // csv
  $('#csv-upload').onclick = csvUpload;

  // promos
  $('#pr-create').onclick = promoCreate;
  await listPromos();
}

function destroy(){
  mounted=false;
  try{ aborter?.abort(); }catch{}
  aborter=null;
}

export default { init, destroy };
