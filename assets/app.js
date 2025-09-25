/* Firebase init (Compat) */
const firebaseConfig = {
  apiKey: "AIzaSyDYwHJou_9GqHZcf8XxtTByC51Z8un8rrM",
  authDomain: "xplusy-760fa.firebaseapp.com",
  projectId: "xplusy-760fa",
  storageBucket: "xplusy-760fa.firebasestorage.app",
  messagingSenderId: "992512966017",
  appId: "1:992512966017:web:5e919dbc9b8d8abcb43c80",
  measurementId: "G-459PLJ7P7L"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

/* Elements */
const greetName = document.getElementById('greet-name');
const greetId = document.getElementById('greet-id');
const greetBal = document.getElementById('greet-balance');
const greetPts = document.getElementById('greet-points');
const btnLogin = document.getElementById('btn-login');
const btnLogout = document.getElementById('btn-logout');

const modal = document.getElementById('auth-modal');
const modalClose = document.getElementById('auth-close');
const googleLoginBtn = document.getElementById('google-login');

const pfName = document.getElementById('pf-name');
const pfRegion = document.getElementById('pf-region');
const pfDistrict = document.getElementById('pf-district');
const pfId = document.getElementById('pf-id');
const pfBalance = document.getElementById('pf-balance');
const pfPoints = document.getElementById('pf-points');
const pfSave = document.getElementById('pf-save');

/* Regions */
const regions = {
  "Toshkent": ["Chilonzor","Yunusobod","Yakkasaroy","Mirzo Ulug‘bek","Sergeli","Yashnobod"],
  "Namangan": ["Namangan shahar","Chortoq","Chust","Kosonsoy","Pop","To‘raqo‘rg‘on","Uchqo‘rg‘on"],
  "Farg‘ona": ["Farg‘ona shahar","Quva","Quvasoy","Qo‘qon","Oltiariq","Rishton","Marg‘ilon"],
  "Andijon": ["Andijon shahar","Asaka","Marhamat","Paxtaobod","Xo‘jaobod"]
};
function fillRegions() {
  pfRegion.innerHTML = `<option value="">Tanlang</option>` + Object.keys(regions).map(r=>`<option>${r}</option>`).join('');
  pfDistrict.innerHTML = `<option value="">Avval viloyat</option>`;
}
function updateDistricts(region) {
  const list = regions[region] || [];
  pfDistrict.innerHTML = `<option value="">Tanlang</option>` + list.map(d=>`<option>${d}</option>`).join('');
}
function randomIdNum(){ return Math.floor(1000 + Math.random()*9000); }
function setGreeting(uDoc){
  greetName.textContent = `Salom, ${uDoc?.name || 'Foydalanuvchi'}!`;
  greetId.textContent = `ID: ${uDoc?.idNum ?? '—'}`;
  greetBal.textContent = `Balans: ${uDoc?.balance ?? 0}`;
  greetPts.textContent = `Ball: ${uDoc?.points ?? 0}`;
}

/* Auth */
const provider = new firebase.auth.GoogleAuthProvider();
async function ensureUserDoc(user) {
  const ref = db.collection('users').doc(user.uid);
  const snap = await ref.get();
  if (!snap.exists) {
    const data = {
      idNum: randomIdNum(),
      name: user.displayName || 'Foydalanuvchi',
      email: user.email || null,
      balance: 0,
      points: 0,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    await ref.set(data, { merge: true });
    return data;
  }
  return snap.data();
}
function onSignedOut(){
  setGreeting(null);
  btnLogin.style.display = '';
  btnLogout.style.display = 'none';
}
function onSignedIn(uDoc){
  setGreeting(uDoc);
  btnLogin.style.display = 'none';
  btnLogout.style.display = '';
  modal.style.display = 'none';
}

auth.onAuthStateChanged(async (user) => {
  if (!user) { onSignedOut(); return; }
  try {
    const uDoc = await ensureUserDoc(user);
    pfName.value = uDoc.name || '';
    pfId.value = uDoc.idNum ?? '';
    pfBalance.value = uDoc.balance ?? 0;
    pfPoints.value = uDoc.points ?? 0;
    onSignedIn(uDoc);
  } catch (e) { console.error(e); onSignedOut(); }
});

btnLogin?.addEventListener('click', ()=> modal.style.display='flex');
modalClose?.addEventListener('click', ()=> modal.style.display='none');
googleLoginBtn?.addEventListener('click', async ()=>{
  try { await auth.signInWithPopup(provider); } catch(e){ alert(e.message||'Kirishda xatolik'); }
});
btnLogout?.addEventListener('click', async ()=>{ await auth.signOut(); });

pfRegion?.addEventListener('change', e => updateDistricts(e.target.value));
pfSave?.addEventListener('click', async ()=>{
  const user = auth.currentUser;
  if (!user) return alert('Kirish talab qilinadi');
  const data = {
    name: pfName.value.trim() || 'Foydalanuvchi',
    idNum: Number(pfId.value) || randomIdNum(),
    balance: Number(pfBalance.value) || 0,
    points: Number(pfPoints.value) || 0,
    region: pfRegion.value || null,
    district: pfDistrict.value || null,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  await db.collection('users').doc(user.uid).set(data, { merge: true });
  setGreeting(data);
  alert('Profil saqlandi');
});

document.addEventListener('DOMContentLoaded', ()=> fillRegions());
