(function initTheme(){
  const saved = localStorage.getItem('theme') || 'dark';
  if (saved === 'light') document.documentElement.classList.add('light');
  document.getElementById('themeToggle')?.addEventListener('click', () => {
    document.documentElement.classList.toggle('light');
    localStorage.setItem('theme', document.documentElement.classList.contains('light') ? 'light' : 'dark');
  });
})();
const pages = Array.from(document.querySelectorAll('.page'));
const tabbar = document.getElementById('tabbar');
function goto(pageId){
  pages.forEach(p => p.classList.toggle('show', p.id === `page-${pageId}`));
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.goto === pageId));
  if (pageId === 'settings') fillEditable();
}
document.querySelectorAll('[data-goto]').forEach(el => el.addEventListener('click', e => { e.preventDefault(); goto(el.dataset.goto); }));
const topbar = document.getElementById('topbar');
const appMain = document.getElementById('app');
const authScreen = document.getElementById('auth-screen');
const userLine = document.getElementById('userLine');
const profileModal = document.getElementById('profileModal');
const btnGoogle = document.getElementById('btnGoogle');
const btnEmailSignIn = document.getElementById('btnEmailSignIn');
const btnEmailSignUp = document.getElementById('btnEmailSignUp');
btnGoogle?.addEventListener('click', async () => { try { const provider = new firebase.auth.GoogleAuthProvider(); await auth.signInWithPopup(provider);} catch(e){ alert('Google orqali kirishda xatolik: '+e.message);} });
btnEmailSignIn?.addEventListener('click', async () => {
  const email = (document.getElementById('email').value||'').trim();
  const pw = (document.getElementById('password').value||'').trim();
  if (!email || !pw) return alert('Email va parol kiriting');
  try { await auth.signInWithEmailAndPassword(email, pw);} catch(e){ alert('Kirishda xatolik: '+e.message);}
});
btnEmailSignUp?.addEventListener('click', async () => {
  const email = (document.getElementById('email').value||'').trim();
  const pw = (document.getElementById('password').value||'').trim();
  if (!email || pw.length < 6) return alert('Email va kamida 6 belgili parol kiriting');
  try { await auth.createUserWithEmailAndPassword(email, pw);} catch(e){ alert('Ro‘yxatdan o‘tishda xatolik: '+e.message);}
});
let currentUser = null; let currentProfile = null;
auth.onAuthStateChanged(async (user) => {
  currentUser = user;
  if (!user) { topbar.classList.add('hidden'); appMain.classList.add('hidden'); tabbar.classList.add('hidden'); authScreen.classList.remove('hidden'); return; }
  authScreen.classList.add('hidden'); topbar.classList.remove('hidden'); appMain.classList.remove('hidden'); tabbar.classList.remove('hidden'); goto('home');
  await ensureUserProfile(user);
});
function hasAllRequired(d){ if(!d) return false; const must=['firstName','lastName','middleName','dob','address','phone','numericId','balance','gems']; return must.every(k => k in d && d[k] !== null && d[k] !== ''); }
async function ensureUserProfile(user){
  const ref = db.collection('users').doc(user.uid);
  const snap = await ref.get(); currentProfile = snap.exists ? snap.data() : null;
  if (!hasAllRequired(currentProfile)){
    const dn = (user.displayName||'').trim(); if(dn){ const parts=dn.split(' '); document.getElementById('firstName').value = parts[0]||''; document.getElementById('lastName').value = parts.slice(1).join(' ')||''; }
    document.getElementById('pf_address').value = currentProfile?.address || ''; document.getElementById('pf_phone').value = currentProfile?.phone || '';
    if (typeof profileModal.showModal === 'function') profileModal.showModal(); document.getElementById('saveProfile').onclick = () => saveProfile(ref);
  } else { updateHeader(currentProfile); fillEditable(); }
}
function updateHeader(p){
  const name = [p.firstName, p.lastName].filter(Boolean).join(' ');
  const id = p.numericId ? String(p.numericId) : '—'; const balance = (p.balance ?? 0).toLocaleString('uz-UZ'); const gems = (p.gems ?? 0).toLocaleString('uz-UZ');
  userLine.innerHTML = `Salom, <b>${name || 'Foydalanuvchi'}</b> · ID <b>${id}</b> · Balans <b>${balance} so‘m</b> · Olmos <b>${gems}</b>`;
}
async function saveProfile(userRef){
  const payload = {
    lastName: document.getElementById('lastName').value.trim(),
    firstName: document.getElementById('firstName').value.trim(),
    middleName: document.getElementById('middleName').value.trim(),
    dob: document.getElementById('dob').value,
    address: document.getElementById('pf_address').value.trim(),
    phone: document.getElementById('pf_phone').value.trim(),
  };
  if (!payload.firstName || !payload.lastName || !payload.middleName || !payload.dob || !payload.address || !payload.phone) return alert('Barcha maydonlarni to‘ldiring.');
  const snap = await userRef.get(); const exists = snap.exists; let data = exists ? snap.data() : {};
  try {
    if (!data.numericId) { const alloc = firebase.functions().httpsCallable('allocateNumericId'); const res = await alloc(); data.numericId = res.data.numericId; }
  } catch(e){ alert('numeric ID ajratishda xatolik: '+e.message); return; }
  if (data.balance == null) data.balance = 0; if (data.gems == null) data.gems = 0;
  const now = firebase.firestore.FieldValue.serverTimestamp(); if (!data.createdAt) data.createdAt = now; data.updatedAt = now;
  if (exists && currentProfile && currentProfile.firstName){ payload.firstName = currentProfile.firstName; payload.lastName = currentProfile.lastName; payload.middleName = currentProfile.middleName; payload.dob = currentProfile.dob; }
  const toWrite = { ...data, ...payload, uid: auth.currentUser.uid }; await userRef.set(toWrite, { merge: true });
  currentProfile = toWrite; updateHeader(currentProfile); if (profileModal.open) profileModal.close(); alert('Profil saqlandi!'); goto('home');
}
function fillEditable(){ if (!currentProfile) return; document.getElementById('address').value = currentProfile.address || ''; document.getElementById('phone').value = currentProfile.phone || ''; }
document.getElementById('saveEditable')?.addEventListener('click', async () => { if (!auth.currentUser) return; const address = document.getElementById('address').value.trim(); const phone = document.getElementById('phone').value.trim(); const ref = db.collection('users').doc(auth.currentUser.uid);
  try { await ref.update({ address, phone, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }); currentProfile.address = address; currentProfile.phone = phone; updateHeader(currentProfile); alert('Yangilandi'); } catch(e){ alert('Saqlashda xatolik: '+e.message); } });
document.getElementById('signOut')?.addEventListener('click', () => auth.signOut());
document.querySelectorAll('.card.action').forEach(c => c.addEventListener('click', () => goto(c.dataset.goto)));
