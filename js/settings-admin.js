// js/settings-admin.js — open Admin inside Settings modal
import { auth, db } from './app.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const modal = () => document.getElementById('settings-admin-modal');
const body  = () => document.getElementById('settings-admin-body');

function show(){ modal()?.setAttribute('aria-hidden','false'); }
function hide(){ modal()?.setAttribute('aria-hidden','true'); }

async function ensureAllowed(){
  const uid = auth.currentUser?.uid;
  if(!uid) throw new Error("Kirish talab qilinadi");
  const s = await getDoc(doc(db,'users', uid));
  const u = s.exists()? s.data(): {};
  const num = Number(u.numericId ?? u.numeric_id ?? 0);
  if(!(num===1000001 || num===1000002)) throw new Error("Ruxsat yo'q");
  // password gate
  const key='admin_unlock';
  if(localStorage.getItem(key)!=='true'){
    const p = prompt("Admin paroli:");
    if(p !== 'Math@1999') throw new Error("Parol noto'g'ri");
    localStorage.setItem(key, 'true');
  }
}

async function openAdminModal(){
  await ensureAllowed();
  // Load admin partial into modal body
  const res = await fetch('/partials/admin.html?v='+Date.now(), {cache:'no-store'});
  const html = await res.text();
  body().innerHTML = html;
  // Dynamically import admin module and init
  try{
    const mod = await import('./admin.js');
    const ent = mod?.default || mod;
    if(ent?.init) await ent.init(body()); // pass modal body as root (works with global selectors too)
  }catch(e){
    console.warn('[settings-admin] admin init', e.message);
  }
  show();
}

export function wireSettingsAdmin(){
  const btn = document.getElementById('openAdminFromSettings');
  const close = document.getElementById('settings-admin-close');
  btn && (btn.onclick = openAdminModal);
  close && (close.onclick = hide);
  // Also close when backdrop clicked
  modal()?.querySelector('.backdrop')?.addEventListener('click', hide);
}

// Auto-wire when auth becomes ready and page == settings
try{ onAuthStateChanged(auth, ()=> wireSettingsAdmin()); }catch(e){ wireSettingsAdmin(); }
