
// assets/js/auth.js — UI wiring for auth modals
import { signInGoogle, signOutAll, signUpEmail, signInEmail } from './firebase.js';

function on(sel, ev, fn){ const el=document.querySelector(sel); if(el) el.addEventListener(ev, fn); }
function toggleModal(id, show){
  const el = document.querySelector(id);
  if(!el) return;
  if(show) el.classList.remove('hidden'); else el.classList.add('hidden');
}
document.addEventListener('click', (e)=>{
  const openSel = e.target.closest('[data-open]'); if(openSel){ e.preventDefault(); toggleModal(openSel.getAttribute('data-open'), true); }
  const closeSel = e.target.closest('[data-close]'); if(closeSel){ e.preventDefault(); toggleModal(closeSel.getAttribute('data-close'), false); }
});

// Google buttons
on('#googleSignInBtn', 'click', async (e)=>{ e.preventDefault(); await signInGoogle(); });
on('#googleSignInBtn2','click', async (e)=>{ e.preventDefault(); await signInGoogle(); toggleModal('#loginModal', false); });
on('#googleSignInBtn3','click', async (e)=>{ e.preventDefault(); await signInGoogle(); toggleModal('#registerModal', false); });

// Email forms
const loginForm = document.querySelector('#loginForm');
if(loginForm){
  loginForm.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const email = loginForm.querySelector('#email').value.trim();
    const pass = loginForm.querySelector('#password').value.trim();
    await signInEmail(email, pass);
    toggleModal('#loginModal', false);
  });
}
const regForm = document.querySelector('#registerForm');
if(regForm){
  regForm.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const name = regForm.querySelector('#name').value.trim();
    const email = regForm.querySelector('#emailReg').value.trim();
    const pass = regForm.querySelector('#passwordReg').value.trim();
    await signUpEmail(name, email, pass);
    toggleModal('#registerModal', false);
  });
}

// Sign out
const so = document.querySelector('#signOutBtn'); if(so){ so.addEventListener('click', async (e)=>{ e.preventDefault(); await signOutAll(); }); }
