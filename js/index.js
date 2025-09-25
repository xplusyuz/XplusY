
import { auth, showProfileModal, hideProfileModal, getProfile, setProfile, profileKey, signOutGoogle } from '../assets/app.js';
import { auth as _auth } from '../assets/app.js'; // ensure module import for auth side-effects

// Build and manage the detailed profile modal in this script
function ensureProfileDialog(){
  if(document.getElementById('detailedProfile')) return;
  const dlg = document.createElement('div');
  dlg.id = 'detailedProfile';
  dlg.className = 'modal';
  dlg.innerHTML = `
  <div class="panel">
    <h3>Profil ma'lumotlari (majburiy)</h3>
    <div class="body">
      <div class="field"><label>ID (tasodifiy)</label><input id="pfId" readonly></div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
        <div class="field"><label>Ism</label><input id="pfFirst"></div>
        <div class="field"><label>Familiya</label><input id="pfLast"></div>
        <div class="field"><label>Sharif</label><input id="pfPatron"></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div class="field"><label>Tug'ilgan sana</label><input id="pfBirth" type="date"></div>
        <div class="field"><label>Telefon</label><input id="pfPhone" placeholder='+998...'></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div class="field"><label>Telegram</label><input id="pfTelegram"></div>
        <div class="field"><label>Email</label><input id="pfEmail" disabled></div>
      </div>
      <div class="field"><label>Yashash manzili</label><input id="pfAddress"></div>
      <div class="field"><label>Maktab nomi</label><input id="pfSchool"></div>
      <div class="field"><label>Rol</label><select id="pfRole"><option value=''>Tanlang</option><option value='oqituvchi'>O'qituvchi</option><option value='oquvchi'>O'quvchi</option><option value='abiturient'>Abiturient</option><option value='foydalanuvchi'>Foydalanuvchi</option></select></div>
    </div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px"><button class="btn" id="pfCancel">Bekor</button><button class="btn pri" id="pfSave">Saqlash</button></div>
  </div>`;
  document.body.appendChild(dlg);

  function genId(){ return String(Math.floor(10000000 + Math.random()*90000000)); }

  dlg.querySelector('#pfId').value = genId();
  dlg.querySelector('#pfSave').addEventListener('click', ()=>{
    const u = window.firebaseUser;
    if(!u) return alert('Avvalo Google orqali kiring');
    const first = dlg.querySelector('#pfFirst').value.trim();
    const last = dlg.querySelector('#pfLast').value.trim();
    const birth = dlg.querySelector('#pfBirth').value.trim();
    const phone = dlg.querySelector('#pfPhone').value.trim();
    const role = dlg.querySelector('#pfRole').value;
    if(!first||!last||!birth||!phone||!role){ alert('Ism, Familiya, Tug'ilgan sana, Telefon va Rol majburiy'); return; }
    const profile = {
      numericId: dlg.querySelector('#pfId').value,
      first, last, patron: dlg.querySelector('#pfPatron').value.trim(),
      birth, phone, telegram: dlg.querySelector('#pfTelegram').value.trim(),
      email: dlg.querySelector('#pfEmail').value.trim(), address: dlg.querySelector('#pfAddress').value.trim(),
      school: dlg.querySelector('#pfSchool').value.trim(), role, balance:0, points:0
    };
    localStorage.setItem(profileKey(u.uid), JSON.stringify(profile));
    dlg.classList.remove('open');
    document.dispatchEvent(new CustomEvent('profile-updated'));
    alert('Profil saqlandi');
  });
  dlg.querySelector('#pfCancel').addEventListener('click', ()=>{ alert('Profil majburiy, bekor bo'lmaydi'); });
}

function openProfileDialog(){
  ensureProfileDialog();
  const dlg = document.getElementById('detailedProfile');
  const u = window.firebaseUser;
  if(!u) return alert('Avvalo tizimga kiring');
  const existing = getProfile();
  if(existing){
    document.getElementById('pfId').value = existing.numericId || document.getElementById('pfId').value;
    document.getElementById('pfFirst').value = existing.first || '';
    document.getElementById('pfLast').value = existing.last || '';
    document.getElementById('pfPatron').value = existing.patron || '';
    document.getElementById('pfBirth').value = existing.birth || '';
    document.getElementById('pfPhone').value = existing.phone || '';
    document.getElementById('pfTelegram').value = existing.telegram || '';
    document.getElementById('pfEmail').value = existing.email || (u.email||'');
    document.getElementById('pfAddress').value = existing.address || '';
    document.getElementById('pfSchool').value = existing.school || '';
    document.getElementById('pfRole').value = existing.role || '';
  } else {
    document.getElementById('pfEmail').value = u.email||'';
  }
  dlg.classList.add('open');
}

// Hook: show modal when app requests profile open
document.addEventListener('profile-open-request', openProfileDialog);

// Observe auth state via firebase auth object (exposed by assets/app.js)
import { auth } from '../assets/app.js';
window.firebaseUser = null;
auth.onAuthStateChanged(function(u){ window.firebaseUser = u; if(!u) { /* show auth modal - app.js handles */ } else { // if profile missing open profile dialog
    const p = getProfile(); if(!p || !p.first || !p.last || !p.birth || !p.phone || !p.role){ openProfileDialog(); }
  } });

// Display profile in sidebar
function renderProfile(){
  const p = getProfile();
  function set(id, v){ const el = document.getElementById(id); if(el) el.textContent = v||'-'; }
  if(!p){ set('pFull','-'); set('pId','-'); set('pBirth','-'); set('pPhone','-'); set('pTelegram','-'); set('pEmail','-'); set('pAddress','-'); set('pSchool','-'); set('pRole','-'); return; }
  const full = [p.first, p.patron, p.last].filter(Boolean).join(' ');
  set('pFull', full); set('pId', p.numericId); set('pBirth', p.birth); set('pPhone', p.phone); set('pTelegram', p.telegram||'-'); set('pEmail', p.email||'-'); set('pAddress', p.address||'-'); set('pSchool', p.school||'-'); set('pRole', p.role||'-');
}

document.getElementById('editProfile')?.addEventListener('click', ()=>{ document.dispatchEvent(new Event('profile-open-request')); });
document.getElementById('logout')?.addEventListener('click', async ()=>{ await signOutGoogle(); renderProfile(); });
document.addEventListener('profile-updated', renderProfile);
document.addEventListener('DOMContentLoaded', ()=>{ renderProfile(); });
