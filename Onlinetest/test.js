import { initializeApp, getApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
const payCardHTML = (price, loggedIn)=>`<div class="card">
<h2>Testga kirish</h2>
<div class="row">Narx: <strong>${fmtUZS(price||20000)}</strong></div>
<div class="row muted">To'lov balansdan yechiladi. Xariddan so'ng 3–2–1 va test boshlanadi.</div>
<div class="row">
${loggedIn?`<button id='buyBtn' class='btn primary'>Sotib olish</button>`:`<a class='btn' href='/kirish.html'>Kirish</a>`}
<a class='btn' href='/balance.html'>Balans</a>
</div>
</div>`;
const countdownHTML = n=>`<div class='card'><div class='big'>${n}</div><div class='muted'>Boshlanishiga...</div></div>`;


async function fetchPrice(){
try{ const snap=await getDoc(doc(db,'products',PRODUCT_ID)); return Number(snap.data()?.price||20000); }
catch{ return 20000; }
}
async function hasAccess(uid){
try{ const snap=await getDoc(doc(db,'purchases',`${uid}_${PRODUCT_ID}`)); return snap.exists(); }
catch{ return false; }
}


async function buyAccess(){
try{
const user=auth.currentUser; if(!user){ location.href='/kirish.html'; return; }
const userRef=doc(db,'users',user.uid);
const uSnap=await getDoc(userRef); if(!uSnap.exists()){ alert('Profil topilmadi'); return; }
const currentBalance=Number(uSnap.data().balance||0);
const price=await fetchPrice();
if(currentBalance<price){ alert('Balans yetarli emas'); return; }


const batch=writeBatch(db);
batch.update(userRef,{ balance: currentBalance-price, lastPurchase:{productId:PRODUCT_ID} });
const purRef=doc(db,'purchases',`${user.uid}_${PRODUCT_ID}`);
batch.set(purRef,{ uid:user.uid, productId:PRODUCT_ID, price, ts:serverTimestamp() },{merge:true});
await batch.commit();


await startSequence();
}catch(e){ alert(e.message||'Xatolik'); }
}


async function startSequence(){
startedTest = true;
showOverlay(countdownHTML(3)); await new Promise(r=>setTimeout(r,1000));
showOverlay(countdownHTML(2)); await new Promise(r=>setTimeout(r,1000));
showOverlay(countdownHTML(1)); await new Promise(r=>setTimeout(r,1000));
hideOverlay();
unlockApp();
go(0); startTimer();
}


async function tryEnter(user){
if(startedTest) return;
const price = await fetchPrice();
if(!user){ lockApp(); showOverlay(payCardHTML(price,false)); return; }
if(await hasAccess(user.uid)){ await startSequence(); }
else{ lockApp(); showOverlay(payCardHTML(price,true)); document.getElementById('buyBtn')?.addEventListener('click', buyAccess); }
}


// === Tugmalar ===
prevBtn.addEventListener('click',prev);
nextBtn.addEventListener('click',next);
submitBtn.addEventListener('click',()=>{ if(confirm('Yakunlaymizmi?')) submit(); });


// === Boot ===
(function boot(){
lockApp();
showOverlay(`<div class='card'><h2>Tekshirilmoqda…</h2><div class='muted'>Hisob holati yuklanmoqda</div></div>`);
onAuthStateChanged(auth, (user)=>{ tryEnter(user); });
setTimeout(()=>{ if(!startedTest){ tryEnter(auth.currentUser||null); } }, 2500);
})();