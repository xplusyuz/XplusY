import { auth, listLatest, saveProfileToFirestore, getProfile, loadProfileFromFirestore, isProfileComplete, generateUniqueNumericId, signOutGoogle } from '../assets/app.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

/* Build profile modal */
function ensureProfileModal(){
  if(document.getElementById('profileModal')) return;
  const w=document.createElement('div'); w.className='modal'; w.id='profileModal';
  w.innerHTML=`
  <div class="panel">
    <h3>Profil ma'lumotlari (majburiy)</h3>
    <div class="grid" style="gap:10px">
      <div class="field"><label>ID (tasodifiy)</label><input id="pfId" readonly></div>
      <div class="grid" style="grid-template-columns:1fr 1fr 1fr;gap:10px">
        <div class="field"><label>Ism</label><input id="pfFirst"></div>
        <div class="field"><label>Familiya</label><input id="pfLast"></div>
        <div class="field"><label>Sharif</label><input id="pfPatron"></div>
      </div>
      <div class="grid" style="grid-template-columns:1fr 1fr;gap:10px">
        <div class="field"><label>Tug‘ilgan sana</label><input id="pfBirth" type="date"></div>
        <div class="field"><label>Telefon</label><input id="pfPhone" placeholder="+998..."></div>
      </div>
      <div class="grid" style="grid-template-columns:1fr 1fr;gap:10px">
        <div class="field"><label>Telegram</label><input id="pfTelegram" placeholder="@username yoki link"></div>
        <div class="field"><label>Email</label><input id="pfEmail" disabled></div>
      </div>
      <div class="field"><label>Yashash manzili</label><input id="pfAddress"></div>
      <div class="field"><label>Maktab nomi</label><input id="pfSchool"></div>
      <div class="field"><label>Rol</label>
        <select id="pfRole">
          <option value="">Tanlang</option>
          <option value="oqituvchi">O'qituvchi</option>
          <option value="oquvchi">O'quvchi</option>
          <option value="abiturient">Abiturient</option>
          <option value="foydalanuvchi">Foydalanuvchi</option>
        </select>
      </div>
      <p class="small">Ism, Familiya, Tug‘ilgan sana, Telefon va Rol majburiy.</p>
    </div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px">
      <button class="btn" id="pfCancel">Bekor</button>
      <button class="btn pri" id="pfSave">Saqlash</button>
    </div>
  </div>`;
  document.body.appendChild(w);

  async function prefill(){
    const u=auth.currentUser; if(!u) return;
    const p=getProfile() || await loadProfileFromFirestore();
    if(p){
      w.querySelector('#pfId').value = p.numericId;
      w.querySelector('#pfFirst').value = p.first||'';
      w.querySelector('#pfLast').value = p.last||'';
      w.querySelector('#pfPatron').value = p.patron||'';
      w.querySelector('#pfBirth').value = p.birth||'';
      w.querySelector('#pfPhone').value = p.phone||'';
      w.querySelector('#pfTelegram').value = p.telegram||'';
      w.querySelector('#pfEmail').value = p.email|| (u.email||'');
      w.querySelector('#pfAddress').value = p.address||'';
      w.querySelector('#pfSchool').value = p.school||'';
      w.querySelector('#pfRole').value = p.role||'';
    } else {
      // unique id
      try{ w.querySelector('#pfId').value = await generateUniqueNumericId(); }catch{ w.querySelector('#pfId').value = String(Math.floor(10000000 + Math.random()*90000000)); }
      w.querySelector('#pfEmail').value = u.email||'';
    }
  }

  w.querySelector('#pfSave').addEventListener('click', async ()=>{
    const u=auth.currentUser; if(!u) return alert('Avvalo tizimga kiring');
    const first = w.querySelector('#pfFirst').value.trim();
    const last  = w.querySelector('#pfLast').value.trim();
    const birth = w.querySelector('#pfBirth').value.trim();
    const phone = w.querySelector('#pfPhone').value.trim();
    const role  = w.querySelector('#pfRole').value;
    if(!first || !last || !birth || !phone || !role){ alert('Ism, Familiya, Tug‘ilgan sana, Telefon va Rol majburiy.'); return; }
    const profile = {
      numericId: w.querySelector('#pfId').value.trim(),
      first, last, patron: w.querySelector('#pfPatron').value.trim(),
      birth, phone, telegram: w.querySelector('#pfTelegram').value.trim(),
      email: w.querySelector('#pfEmail').value.trim(), address: w.querySelector('#pfAddress').value.trim(),
      school: w.querySelector('#pfSchool').value.trim(), role, balance:0, points:0,
      updatedAt: new Date().toISOString()
    };
    try{
      await saveProfileToFirestore(profile);
      w.classList.remove('open');
      // Unlock handled by auth listener upon profile-updated event
    }catch(e){ alert(e.message); }
  });
  w.querySelector('#pfCancel').addEventListener('click', ()=>{ alert('Profil majburiy. Iltimos to‘ldiring.'); });

  w.prefill = prefill;
}
function showProfileModal(){ ensureProfileModal(); const w=document.getElementById('profileModal'); w.prefill(); w.classList.add('open'); }

/* Banner */
async function loadBanner(){
  try{
    const snap = await listLatest('home_banners', 1);
    if(!snap.empty){
      const d = snap.docs[0].data();
      const img = document.getElementById('bannerImg');
      const a = document.getElementById('bannerLink');
      if(img) img.src = d.image || '';
      if(a){ a.href = d.link || '#'; a.style.display = d.link ? 'inline-block' : 'none'; }
    }
  }catch(e){ console.error(e); }
}

/* Sidebar */
function renderProfile(){
  const p = getProfile();
  const set = (id,v)=>{ const el=document.getElementById(id); if(el) el.textContent = v||'-'; };
  if(!p){ set('pFull','-'); set('pId','-'); set('pBirth','-'); set('pPhone','-'); set('pTelegram','-'); set('pEmail','-'); set('pAddress','-'); set('pSchool','-'); set('pRole','-'); return; }
  const full = [p.first, p.patron, p.last].filter(Boolean).join(' ');
  set('pFull', full); set('pId', p.numericId); set('pBirth', p.birth); set('pPhone', p.phone);
  set('pTelegram', p.telegram||'-'); set('pEmail', p.email||'-'); set('pAddress', p.address||'-'); set('pSchool', p.school||'-'); set('pRole', p.role||'-');
}

document.getElementById('editProfile')?.addEventListener('click', showProfileModal);
document.getElementById('logout')?.addEventListener('click', async ()=>{ await signOutGoogle(); });

document.addEventListener('profile-updated', ()=>{ renderProfile(); });

onAuthStateChanged(auth, async (user)=>{
  if(user){
    const p = getProfile() || await loadProfileFromFirestore();
    if(!isProfileComplete(p)) showProfileModal();
    renderProfile();
  }
});

loadBanner(); renderProfile();
