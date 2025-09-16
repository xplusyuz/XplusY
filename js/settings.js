// settings.js — Top-up (chek rasm/PDF) yuklash + admin ko‘rish
// Ushbu fayl Firebase modular (v10+) bilan ishlaydi.
// Sizning loyihangizda allaqachon auth/db/storage bor bo‘lsa, mos ravishda import/obyektlarni ulang.

// === EXPECTED GLOBALS (agar settings.html ichida import qilingan bo'lsa, mavjud) ===
// const auth, db, storage;
// Firestore funcs: collection, doc, getDoc, getDocs, setDoc, updateDoc, serverTimestamp, query, orderBy, limit;
// Storage funcs: sRef (ref), uploadBytes, getDownloadURL;

const CFG = (window.__SETTINGS_CFG__ || {
  TG_BOT_TOKEN: "PASTE_TELEGRAM_BOT_TOKEN",
  TG_CHAT_ID_MAIN: "PASTE_CHAT_ID",
  PAY_XAZNA: "https://pay.xazna.uz/p2p/f5edea87-06a5-4d48-a01d-885cf843eb8f",
  PAY_CLICK: "https://indoor.click.uz/pay?id=0081656&t=0"
});

// UI: payment buttons
(function attachPaymentLinks(){
  const xazna = document.getElementById('btn-xazna');
  const click = document.getElementById('btn-click');
  if(xazna) xazna.href = CFG.PAY_XAZNA;
  if(click) click.href = CFG.PAY_CLICK;
})();

// Helpers
const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ['image/png','image/jpeg','image/jpg','image/webp','application/pdf'];
function isImageUrl(u){ try{ return /\.(png|jpe?g|webp|gif)$/i.test(new URL(u).pathname);}catch(_){return false;} }
function isPdfUrl(u){ try{ return /\.pdf$/i.test(new URL(u).pathname);}catch(_){return false;} }

// Bind form
export async function bindTopup(){
  const form = document.getElementById('topupForm');
  if(!form) return;

  const amountEl = form.querySelector('[name="amount"]');
  const noteEl   = form.querySelector('[name="note"]');
  const fileEl   = form.querySelector('input[type="file"]');

  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const user = auth.currentUser;
    if(!user){ alert('Kirish kerak.'); return; }

    const amount = Number((amountEl?.value||'').toString().replace(/\s/g,''));
    if(!Number.isInteger(amount) || amount<=0){ alert('Summani to‘g‘ri kiriting.'); return; }

    const file = fileEl?.files?.[0] || null;
    if(file){
      if(!ALLOWED_TYPES.includes(file.type)){
        alert('Faqat PNG/JPG/WEBP yoki PDF ruxsat etiladi.'); return;
      }
      if(file.size > MAX_FILE_BYTES){
        alert('Fayl hajmi 5MB dan oshmasin.'); return;
      }
    }

    form.querySelector('button[type="submit"]')?.setAttribute('disabled','true');

    let fileURL=null, fileName=null, contentType=null, fileSize=null;
    try{
      // Upload (agar fayl tanlangan bo‘lsa)
      if(file){
        const uid=user.uid, now=Date.now();
        fileName = file.name;
        contentType = file.type || 'application/octet-stream';
        fileSize = file.size;
        const safeName = file.name.replace(/[^\w.\-]/g,'_');
        const path = `users/${uid}/topups/${now}-${safeName}`;
        const ref = sRef(storage, path);
        await uploadBytes(ref, file, { contentType });
        fileURL = await getDownloadURL(ref);
      }

      // Profile (Telegram uchun foydali ma'lumot)
      let prof=null;
      try{
        const snap = await getDoc(doc(db,'users', user.uid));
        prof = snap.exists()? snap.data(): null;
      }catch(_){}

      // Firestore hujjati
      const topCol = collection(db,'users', user.uid, 'topups');
      const dref = doc(topCol);
      const payload = {
        amount,
        note: noteEl?.value || '',
        status: 'pending',
        fileURL: fileURL || '',
        filename: fileName || '',
        contentType: contentType || '',
        size: fileSize || 0,
        createdAt: serverTimestamp(),
        reviewedAt: null,
        reviewedBy: null,
        adminNote: ''
      };
      await setDoc(dref, payload);

      // Telegramga xabar
      try{
        const TG_API = `https://api.telegram.org/bot${CFG.TG_BOT_TOKEN}`;
        const fio = `${prof?.firstName||''} ${prof?.lastName||''}`.trim();
        const phone = prof?.phone || '-';
        const numericId = prof?.numericId || '-';

        if(fileURL && contentType && contentType.startsWith('image/')){
          await fetch(`${TG_API}/sendPhoto`, {
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({
              chat_id: CFG.TG_CHAT_ID_MAIN,
              photo: fileURL,
              caption: `🧾 Yangi to‘lov arizasi (rasm)\n💰 ${amount.toLocaleString('uz-UZ')} so‘m\n👤 ID: ${numericId} | ${fio}\n📞 ${phone}\n${payload.note?('📝 '+payload.note+'\n'):''}🕒 ${new Date().toLocaleString('uz-UZ')}`
            })
          });
        } else {
          const text = [
            '🧾 Yangi to‘lov arizasi',
            '',
            `💰 Summasi: ${amount.toLocaleString('uz-UZ')} so‘m`,
            `👤 ID: ${numericId} | ${fio}`,
            `📞 ${phone}`,
            payload.note? `📝 ${payload.note}` : '',
            fileURL? `🔗 Chek: ${fileURL}` : '',
            `🕒 ${new Date().toLocaleString('uz-UZ')}`
          ].filter(Boolean).join('\n');
          await fetch(`${TG_API}/sendMessage`, {
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ chat_id: CFG.TG_CHAT_ID_MAIN, text })
          });
        }
      }catch(err){ console.warn('Telegram yuborilmadi:', err); }

      alert('Arizangiz yuborildi. Admin tekshiradi.');
      form.reset();
    }catch(err){
      console.error(err);
      alert(err?.message || 'Xatolik yuz berdi.');
    }finally{
      form.querySelector('button[type="submit"]')?.removeAttribute('disabled');
    }
  });
}

// Admin ro'yxati (ajak: faqat adminlar ko'ra oladi — UI tomonda yashiramiz, rules bilan himoya alohida)
export async function mountAdmin(){
  const adminWrap = document.getElementById('adminPanel');
  const listEl = document.getElementById('admList');
  if(!adminWrap || !listEl) return;

  // Adminlik tekshiruvi: users/{uid}.numericId in [1000001,1000002]
  const u = auth.currentUser;
  if(!u){ adminWrap.style.display='none'; return; }
  let isAdmin=false;
  try{
    const s = await getDoc(doc(db,'users', u.uid));
    const d = s.exists()? s.data(): null;
    const nid = d?.numericId;
    isAdmin = (nid===1000001 || nid===1000002 || nid==="1000001" || nid==="1000002");
  }catch(_){}
  if(!isAdmin){ adminWrap.style.display='none'; return; }

  adminWrap.style.display='block';
  listEl.innerHTML = '<div class="muted">Yuklanmoqda...</div>';

  // Hozircha so'ngi 50 ta ariza (global oqim uchun kolleksiya kerak bo'ladi; demo sifatida foydalanuvchi bazasidan yig'ish qiyin.
  // Amaliyotda admin sahifasi uchun cloud function yoki aggregatsiya kolleksiyasi tavsiya etiladi.)
  // Bu demo: faqat joriy admin foydalanuvchisining o'z arizalarini ko'rsatadi.
  // TODO (agar umumiy ko‘rish kerak bo‘lsa): "topups_global" kolleksiyasiga yozib borish.
  try{
    // Minimal demo — foydalanuvchining o'zi ko'radi
    const q = query(collection(db,'users', u.uid, 'topups'), orderBy('createdAt','desc'), limit(50));
    const snap = await getDocs(q);
    if(snap.empty){ listEl.innerHTML = '<div class="muted">Arizalar topilmadi.</div>'; return; }

    listEl.innerHTML = '';
    snap.forEach(docSnap=>{
      const r = docSnap.data();
      const el = document.createElement('div');
      el.className = 'adm-card';

      const badgeClass = r.status==='approved' ? 'badge-approved' : (r.status==='rejected' ? 'badge-rejected' : 'badge-pending');
      el.innerHTML = `
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:center">
          <div><b>${(r.amount||0).toLocaleString('uz-UZ')} so‘m</b></div>
          <span class="badge ${badgeClass}">${r.status||'pending'}</span>
        </div>
        ${r.note? `<div class="sub">📝 ${r.note}</div>`:''}
        ${r.fileURL? (()=>{
          if(isPdfUrl(r.fileURL) || (r.filename||'').toLowerCase().endsWith('.pdf')){
            return `<div class="sub">📎 <a href="${r.fileURL}" target="_blank" rel="noopener">Chek (PDF) — ochish</a></div>`;
          }else if(isImageUrl(r.fileURL)){
            return `<div class="sub"><img class="thumb" src="${r.fileURL}" alt="chek"></div>`;
          }else{
            return `<div class="sub">📎 <a href="${r.fileURL}" target="_blank" rel="noopener">Chek — link</a></div>`;
          }
        })() : ''}
        ${r.adminNote? `<div class="sub">👮 ${r.adminNote}</div>`:''}
      `;
      listEl.appendChild(el);
    });
  }catch(err){
    console.error(err);
    listEl.innerHTML = '<div class="muted">Yuklashda xatolik.</div>';
  }
}

// Auth holati bilan bog'lash
(function main(){
  if(typeof onAuthStateChanged!=='function'){ console.warn('Firebase auth yo‘q?'); return; }
  onAuthStateChanged(auth, async (u)=>{
    // Foydalanuvchi formi har doim bog'lanadi
    bindTopup();
    // Admin panel (agar admin bo'lsa ko'rsatamiz)
    mountAdmin();
  });
})();
