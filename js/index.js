import { db, createDoc, toast } from '../assets/app.js';
import { collection, getDocs, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

async function loadBanner(){
  try{
    const snap = await getDocs(query(collection(db,'home_banners'), orderBy('createdAt','desc'), limit(1)));
    if(!snap.empty){
      const d = snap.docs[0].data();
      document.getElementById('bannerImg').src = d.image || '';
      const a = document.getElementById('bannerLink');
      a.href = d.link || '#';
      a.style.display = d.link ? 'inline-block':'none';
    }
  }catch(e){ console.error(e); }
}
function loadProfile(){
  const p = JSON.parse(localStorage.getItem('profile')||'{}');
  const set = (id,v)=>{ document.getElementById(id).textContent = (v===undefined||v==='')?'-':v; };
  set('pName', p.name||'-');
  set('pId', p.numericId||'-');
  let age='-'; if(p.birth){ const b=new Date(p.birth); if(!isNaN(b)) { const diff=Date.now()-b.getTime(); age = Math.floor(diff/31557600000); } }
  set('pAge', age);
  set('pBalance', p.balance||0);
  set('pPoints', p.points||0);
}
function editProfile(){
  const p = JSON.parse(localStorage.getItem('profile')||'{}');
  const name = prompt('Ism', p.name||'');
  const numericId = prompt('ID (raqam)', p.numericId||'');
  const birth = prompt('Tug‘ilgan sana (YYYY-MM-DD)', p.birth||'');
  const balance = prompt('Balans', p.balance||0);
  const points = prompt('Ball', p.points||0);
  localStorage.setItem('profile', JSON.stringify({name, numericId, birth, balance, points}));
  loadProfile(); toast('Profil saqlandi');
}
document.getElementById('editProfile').addEventListener('click', editProfile);
document.getElementById('logout').addEventListener('click', ()=>{ localStorage.removeItem('profile'); loadProfile(); toast('Profil tozalandi'); });
async function mountAdmin(){
  const box = document.getElementById('adminContent');
  box.innerHTML = `
    <div class="field"><label>Banner rasmi URL yoki img/rasm.jpg</label><input id="aImg" placeholder="https://... yoki img/rasm.jpg"></div>
    <div class="field"><label>Banner link</label><input id="aLink" placeholder="https://..."></div>
    <button class="btn pri full" id="aSave">Banner qo‘shish</button>
    <p class="small">Eslatma: faqat eng oxirgi qo‘shilgan banner ko‘rsatiladi.</p>
  `;
  box.querySelector('#aSave').addEventListener('click', async ()=>{
    try{
      const image = box.querySelector('#aImg').value.trim();
      const link = box.querySelector('#aLink').value.trim();
      if(!image) return alert('Rasm manzilini kiriting');
      await createDoc('home_banners', { image, link });
      toast('Banner qo‘shildi'); loadBanner();
    }catch(e){ alert(e.message); }
  });
}
loadBanner(); loadProfile(); mountAdmin();
