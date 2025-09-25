import { getProfile, setProfile, signOutGoogle, listLatest, toast } from '../assets/app.js';

async function loadBanner(){
  try{
    const snap = await listLatest('home_banners', 1);
    if(!snap.empty){
      const d = snap.docs[0].data();
      const img = document.getElementById('bannerImg');
      const a = document.getElementById('bannerLink');
      if(img) img.src = d.image || '';
      if(a){ a.href = d.link || '#'; a.style.display = d.link ? 'inline-block':'none'; }
    }
  }catch(e){ console.error(e); }
}

function loadProfileUI(){
  const p = getProfile();
  const set = (id,v)=>{ const el = document.getElementById(id); if(el) el.textContent = (v===undefined||v==='')?'-':v; };
  if(!p){ set('pName','-'); set('pId','-'); set('pAge','-'); set('pBalance','0'); set('pPoints','0'); return; }
  set('pName', p.name||'-');
  set('pId', p.numericId||'-');
  let age='-'; if(p.birth){ const b=new Date(p.birth); if(!isNaN(b)) { const diff=Date.now()-b.getTime(); age = Math.floor(diff/31557600000); } }
  set('pAge', age);
  set('pBalance', p.balance||0);
  set('pPoints', p.points||0);
}

function editProfile(){
  const cur = getProfile() || {};
  const name = prompt('Ism', cur.name||'');
  const numericId = prompt('ID (raqam)', cur.numericId||'');
  const birth = prompt('Tug‘ilgan sana (YYYY-MM-DD)', cur.birth||'');
  const balance = prompt('Balans', cur.balance||0);
  const points = prompt('Ball', cur.points||0);
  if(!name || !numericId || !birth){ alert('Ism, ID, tug‘ilgan sana majburiy'); return; }
  setProfile({ name, numericId, birth, balance, points });
  loadProfileUI(); toast('Profil saqlandi');
}

const editBtn = document.getElementById('editProfile');
if(editBtn) editBtn.addEventListener('click', editProfile);
const logoutBtn = document.getElementById('logout');
if(logoutBtn) logoutBtn.addEventListener('click', async ()=>{ await signOutGoogle(); loadProfileUI(); });

document.addEventListener('profile-updated', loadProfileUI);

loadBanner(); loadProfileUI();
