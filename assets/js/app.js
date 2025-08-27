<script type="module">
const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js');
const u = auth.currentUser; if(!u) return;
const snap = await getDoc(doc(db, 'users', u.uid));
if(snap.exists()){
const d = snap.data();
balEl.textContent = d.balance ?? 0;
scEl.textContent = d.score ?? 0;
}
});
}


// Auth buttons
document.getElementById('btnLoginGoogle')?.addEventListener('click', async ()=>{ try{ await signInGoogle(); }catch(e){ alert(e.message); } });


document.getElementById('btnLoginEmail')?.addEventListener('click', ()=> openEmailModal('login'));
document.getElementById('btnRegisterEmail')?.addEventListener('click', ()=> openEmailModal('register'));
document.getElementById('btnLogout')?.addEventListener('click', async ()=>{ await signOutUser(); });


// Email modals
function openEmailModal(mode){
const host = document.getElementById('modalHost');
host.innerHTML = `
<div class="modal-backdrop"></div>
<div class="modal">
<h3>${mode==='login'?'Kirish':'Ro\'yxatdan o\'tish'}</h3>
${mode==='register'?'<input id="name" class="input" placeholder="Ism" />':''}
<input id="email" class="input" placeholder="Email" type="email" />
<input id="pass" class="input" placeholder="Parol" type="password" />
<div class="row">
<button class="btn" id="okBtn">${mode==='login'?'Kirish':'Ro\'yxatdan o\'tish'}</button>
<button class="btn" id="cancelBtn">Bekor qilish</button>
</div>
</div>`;
host.className = 'modal-host open';
host.querySelector('#cancelBtn').onclick = ()=> host.className='modal-host';
host.querySelector('#okBtn').onclick = async ()=>{
try{
const name = host.querySelector('#name')?.value || '';
const email = host.querySelector('#email').value;
const pass = host.querySelector('#pass').value;
if(mode==='login') await window.XPY.signInEmail(email, pass); else await window.XPY.registerEmail(name, email, pass);
host.className='modal-host';
}catch(e){ alert(e.message); }
};
}
}


// Wait for firebase.js module to attach XPY
const ensureXPY = ()=> new Promise(r=>{ const t = ()=> window.XPY? r(): setTimeout(t, 30); t(); });
await ensureXPY();
setupAuthUI();
</script>