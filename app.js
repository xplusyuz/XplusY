// Theme + simple 3D tilt
(function(){
  const saved = localStorage.getItem('theme') || 'dark';
  if (saved === 'light') document.documentElement.classList.add('light');
  document.addEventListener('click', (e)=>{
    const t = e.target.closest('#themeToggle'); if(!t) return;
    document.documentElement.classList.toggle('light');
    localStorage.setItem('theme', document.documentElement.classList.contains('light') ? 'light':'dark');
  });
  // lightweight tilt
  document.addEventListener('pointermove', (e)=>{
    document.querySelectorAll('.tilt3d').forEach(el=>{
      const r=el.getBoundingClientRect(), cx=r.left+r.width/2, cy=r.top+r.height/2;
      const dx=(e.clientX-cx)/r.width, dy=(e.clientY-cy)/r.height;
      el.style.transform=`rotateX(${dy*-10}deg) rotateY(${dx*10}deg)`;
    });
  });
  document.addEventListener('pointerleave', ()=>{
    document.querySelectorAll('.tilt3d').forEach(el=>el.style.transform='');
  });
})();

const content = document.getElementById('content');
const tabbar = document.getElementById('tabbar');
const walletbar = document.getElementById('walletbar');
const topbar = document.getElementById('topbar');
const authScreen = document.getElementById('auth');
const profileViewModal = document.getElementById('profileViewModal');
const topUpModal = document.getElementById('topUpModal');

const wbId = document.getElementById('wbId');
const wbBalance = document.getElementById('wbBalance');
const wbGems = document.getElementById('wbGems');
const userLine = document.getElementById('userLine');
let currentProfile = null;
let unsubUser = null;

async function loadPage(page){
  const res = await fetch(`./pages/${page}.html`, { cache: 'no-store' });
  const html = await res.text();
  content.innerHTML = html;
  if (page === 'settings') bindSettings();
}

function bindSettings(){
  const address = document.getElementById('address');
  const phone = document.getElementById('phone');
  const saveBtn = document.getElementById('saveEditable');
  const openProfile = document.getElementById('openProfile');
  const openTopUpBtn = document.getElementById('openTopUpBtn');

  if (saveBtn) saveBtn.addEventListener('click', async ()=>{
    try{
      await db.collection('users').doc(auth.currentUser.uid).update({
        address: address.value.trim(),
        phone: phone.value.trim(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      currentProfile.address = address.value.trim();
      currentProfile.phone = phone.value.trim();
      updateHeader(currentProfile);
      alert('Yangilandi');
    }catch(e){ alert('Saqlashda xatolik: '+e.message);}
  });

  if (openProfile) openProfile.addEventListener('click', openProfileView);
  if (openTopUpBtn) openTopUpBtn.addEventListener('click', ()=>openTopUp());
}

function fillProfileView(p){
  const body = document.getElementById('profileViewBody');
  const rows = [
    ['ID', p.numericId||'—'],
    ['Ism', p.firstName||''],
    ['Familiya', p.lastName||''],
    ['Otasining ismi', p.middleName||''],
    ['Tug‘ilgan sana', p.dob||''],
    ['Manzil', p.address||''],
    ['Telefon', p.phone||''],
    ['Balans (so‘m)', (p.balance||0).toLocaleString('uz-UZ')],
    ['Olmos', (p.gems||0).toLocaleString('uz-UZ')],
  ];
  body.innerHTML = rows.map(([k,v])=>`<div class="item"><b>${k}</b><div>${v}</div></div>`).join('');
}

function openProfileView(){
  if (!currentProfile) return;
  fillProfileView(currentProfile);
  profileViewModal.showModal();
  document.getElementById('closeProfileView').onclick = ()=> profileViewModal.close();
}

function openTopUp(){
  topUpModal.showModal();
  document.getElementById('closeTopUp').onclick = ()=> topUpModal.close();
  const tabs = topUpModal.querySelectorAll('.tabbtn');
  const panels = topUpModal.querySelectorAll('.pay-panel');
  tabs.forEach(t=>t.onclick = ()=>{
    tabs.forEach(x=>x.classList.toggle('active', x===t));
    panels.forEach(p=>p.classList.toggle('show', p.dataset.method === t.dataset.method));
  });
  document.getElementById('startTopUp').onclick = ()=>{
    const method = topUpModal.querySelector('.tabbtn.active')?.dataset.method || 'payme';
    const amt = parseInt(document.getElementById('topupAmount').value||'0',10);
    if (!amt || amt<1000) return alert('Miqdor kamida 1 000 so‘m bo‘lishi kerak');
    alert(`Demo: ${method.toUpperCase()} uchun ${amt.toLocaleString('uz-UZ')} so‘mga to‘lov sahifasiga yo‘naltiriladi.`);
  };
}

function updateWallet(p){
  wbId.textContent = p.numericId ?? '—';
  wbBalance.textContent = (p.balance ?? 0).toLocaleString('uz-UZ');
  wbGems.textContent = (p.gems ?? 0).toLocaleString('uz-UZ');
}
function updateHeader(p){
  const name = [p.firstName, p.lastName].filter(Boolean).join(' ');
  userLine.innerHTML = `Salom, <b>${name || 'Foydalanuvchi'}</b>`;
  updateWallet(p);
}

// Client-side numeric ID
async function allocateNumericIdClient(){
  const metaRef = db.collection('meta').doc('counters');
  let newId = null;
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(metaRef);
    const last = snap.exists && typeof snap.data().lastUserNumericId === 'number' ? snap.data().lastUserNumericId : 1000000;
    newId = last + 1;
    tx.set(metaRef, { lastUserNumericId: newId }, { merge: true });
  });
  return newId;
}
function hasAllRequired(d){
  if(!d) return false;
  return ['firstName','lastName','middleName','dob','address','phone','numericId','balance','gems'].every(k => d[k] !== undefined && d[k] !== null && d[k] !== '');
}

// Auth handlers
document.getElementById('btnGoogle')?.addEventListener('click', async ()=>{
  try{ const provider = new firebase.auth.GoogleAuthProvider(); await auth.signInWithPopup(provider);} catch(e){ alert(e.message); }
});
document.getElementById('btnEmailSignIn')?.addEventListener('click', async ()=>{
  const email = (document.getElementById('email').value||'').trim();
  const pw = (document.getElementById('password').value||'').trim();
  if(!email || !pw) return alert('Email va parol kiriting');
  try{ await auth.signInWithEmailAndPassword(email,pw);}catch(e){alert(e.message);}
});
document.getElementById('btnEmailSignUp')?.addEventListener('click', async ()=>{
  const email = (document.getElementById('email').value||'').trim();
  const pw = (document.getElementById('password').value||'').trim();
  if(!email || pw.length<6) return alert('Email va kamida 6 belgili parol kiriting');
  try{ await auth.createUserWithEmailAndPassword(email,pw);}catch(e){alert(e.message);}
});

document.getElementById('openTopUp')?.addEventListener('click', ()=>openTopUp());

auth.onAuthStateChanged(async (user)=>{
  if(!user){
    if (unsubUser) { unsubUser(); unsubUser = null; }
    authScreen.classList.remove('hidden');
    [content, tabbar, walletbar, topbar].forEach(el=>el.classList.add('hidden'));
    return;
  }
  authScreen.classList.add('hidden');
  [content, tabbar, walletbar, topbar].forEach(el=>el.classList.remove('hidden'));

  // Real-time user doc
  const userRef = db.collection('users').doc(user.uid);
  if (unsubUser) unsubUser();
  unsubUser = userRef.onSnapshot(async (snap)=>{
    if (!snap.exists){ currentProfile = null; return; }
    currentProfile = snap.data();
    updateHeader(currentProfile);
  });

  // If not complete, force fill modal
  const firstSnap = await userRef.get();
  let data = firstSnap.exists ? firstSnap.data() : null;
  if (!hasAllRequired(data)){
    const profileModal = document.getElementById('profileModal');
    const dn = (user.displayName||'').trim();
    if(dn){ const parts = dn.split(' '); document.getElementById('firstName').value = parts[0]||''; document.getElementById('lastName').value = parts.slice(1).join(' ')||''; }
    profileModal.showModal();
    document.getElementById('saveProfile').onclick = async ()=>{
      const payload = {
        lastName: document.getElementById('lastName').value.trim(),
        firstName: document.getElementById('firstName').value.trim(),
        middleName: document.getElementById('middleName').value.trim(),
        dob: document.getElementById('dob').value,
        address: document.getElementById('pf_address').value.trim(),
        phone: document.getElementById('pf_phone').value.trim(),
      };
      if(!payload.firstName || !payload.lastName || !payload.middleName || !payload.dob || !payload.address || !payload.phone) return alert('Barcha maydonlarni to‘ldiring.');
      if(!data) data = {};
      if(!data.numericId){ try{ data.numericId = await allocateNumericIdClient(); }catch(e){ alert('ID ajratishda xatolik: '+e.message); return; } }
      if(data.balance==null) data.balance = 0; if(data.gems==null) data.gems = 0;
      const now = firebase.firestore.FieldValue.serverTimestamp();
      if(!data.createdAt) data.createdAt = now; data.updatedAt = now;
      const toWrite = { ...data, ...payload, uid: user.uid };
      await userRef.set(toWrite, { merge:true });
      currentProfile = toWrite; profileModal.close(); loadPage('home');
    };
  } else {
    loadPage('home');
  }
});

tabbar.addEventListener('click', (e)=>{
  const btn = e.target.closest('.tab'); if(!btn) return;
  document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active', t===btn));
  loadPage(btn.dataset.page);
});

document.addEventListener('click', (e)=>{
  const out = e.target.closest('#signOut'); if(out) auth.signOut();
});
