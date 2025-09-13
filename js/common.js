import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

/* =====================
 *  Firebase bootstrap
 * ===================== */
export const firebaseConfig = {
  apiKey: "AIzaSyDYwHJou_9GqHZcf8XxtTByC51Z8un8rrM",
  authDomain: "xplusy-760fa.firebaseapp.com",
  projectId: "xplusy-760fa",
  storageBucket: "xplusy-760fa.appspot.com",
  messagingSenderId: "992512966017",
  appId: "1:992512966017:web:5e919dbc9b8d8abcb43c80",
  measurementId: "G-459PLJ7P7L"
};

export const ADMIN_NUMERIC_IDS = [1000001, 1000002];

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

/* =====================
 *  Theme: FORCE LIGHT ONLY
 * ===================== */
function applyLight(){
  // Force UA widgets + colors to light
  document.documentElement.style.colorScheme = 'light';
  // Keep compatibility with any old styles relying on .theme-light
  document.body.classList.add('theme-light');
  // Remove any stored theme state from older builds
  try { localStorage.removeItem('mc_theme'); } catch {}
  // If there was a theme toggle button in markup, hide it gracefully
  const btn = document.querySelector('#btnTheme');
  if (btn){ btn.style.display = 'none'; }
}
export function initTheme(){ applyLight(); }

/* =====================
 *  Bottom bar cleanup
 * ===================== */
export function ensureBottomBar(){
  document.querySelectorAll('.bottom-bar').forEach(el => { el.style.display = 'none'; });
}

/* =====================
 *  Auth + Header pills
 * ===================== */
async function ensureUserDoc(uid, profile){
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if(!snap.exists()){
    await setDoc(ref, {
      uid,
      email: profile.email || null,
      displayName: profile.displayName || null,
      createdAt: serverTimestamp(),
      numericId: null,
      firstName:'', lastName:'', middleName:'', dob:'', region:'', district:'', phone:'',
      balance:0, gems:0, badges:[]
    });
  }
  return (await getDoc(ref)).data();
}

/** Attach auth UI parts to header + overlay (Google sign-in) */
export function attachAuthUI({ requireSignIn = true } = {}){
  const idEl  = ()=> document.querySelector('#hdrId');
  const balEl = ()=> document.querySelector('#hdrBal');
  const gemEl = ()=> document.querySelector('#hdrGem');
  const btnIn = ()=> document.querySelector('#btnSignIn');
  const btnOut= ()=> document.querySelector('#btnSignOut');

  onAuthStateChanged(auth, async (user)=>{
    if(!user){
      btnIn()?.classList.remove('hidden');
      btnOut()?.classList.add('hidden');
      idEl()  && (idEl().textContent='ID: —');
      balEl() && (balEl().textContent='💵 0');
      gemEl() && (gemEl().textContent='💎 0');
      if(requireSignIn){
        let o=document.querySelector('#authOverlay');
        if(!o){
          o=document.createElement('div');
          o.id='authOverlay'; o.className='modal';
          o.innerHTML=`<div class="dialog" role="dialog" aria-modal="true">
              <div class="head"><h3 style="margin:0">Kirish</h3></div>
              <div class="body">
                <p class="sub">Google orqali tez va xavfsiz kiring</p>
              </div>
              <div class="foot">
                <button id="overlaySignIn" class="btn primary">Google bilan kirish</button>
              </div>
            </div>`;
          document.body.appendChild(o);
          o.addEventListener('click', (e)=>{ if(e.target===o) o.remove(); });
          document.addEventListener('keydown', (e)=>{ if(e.key==='Escape'){ o?.remove(); }});
          o.querySelector('#overlaySignIn').addEventListener('click', async ()=>{
            const provider = new GoogleAuthProvider();
            await signInWithPopup(auth, provider).catch(e=> alert('Kirish xatosi: '+e.message));
          });
        }
      }
      return;
    }
    document.querySelector('#authOverlay')?.remove();
    const profile = await ensureUserDoc(user.uid, user);
    btnIn()?.classList.add('hidden');
    btnOut()?.classList.remove('hidden');
    idEl()  && (idEl().textContent='ID: '+(profile.numericId ?? '—'));
    balEl() && (balEl().textContent='💵 '+(profile.balance ?? 0));
    gemEl() && (gemEl().textContent='💎 '+(profile.gems ?? 0));
    window.__mcUser = { user, profile };
    document.dispatchEvent(new CustomEvent('mc:user-ready', { detail: window.__mcUser }));
  });

  document.addEventListener('click', async (e)=>{
    if(e.target && (e.target.id==='btnSignIn' || e.target.matches('[data-action="signin"]'))){
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider).catch(err=> alert('Kirish xatosi: '+err.message));
    }
    if(e.target && (e.target.id==='btnSignOut' || e.target.matches('[data-action="signout"]'))){
      await signOut(auth).catch(err=> alert('Chiqishda xato: '+err.message));
      location.reload();
    }
  });
}

/* =====================
 *  Page-level UX init
 * ===================== */

/* Active nav state */
function __mcUpdateActiveNav(){
  const hash = location.hash || '#home';
  document.querySelectorAll('.nav.desktop-nav a').forEach(a=>{
    const href = a.getAttribute('href')||'';
    if(!href.startsWith('#')) return a.classList.remove('active');
    a.classList.toggle('active', href === hash);
  });
}
window.addEventListener('hashchange', __mcUpdateActiveNav, { passive:true });

export function initUX(){
  initTheme();
  ensureBottomBar();
  document.documentElement.classList.add('js-ready');
  __mcUpdateActiveNav();
}
/* === Lightweight 3D tilt for modern feel === */
function enableTilt(sel){
  const nodes = document.querySelectorAll(sel);
  nodes.forEach(el=>{
    el.style.transformStyle = 'preserve-3d';
    el.addEventListener('mousemove', (e)=>{
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width/2, cy = r.top + r.height/2;
      const dx = (e.clientX - cx) / (r.width/2);
      const dy = (e.clientY - cy) / (r.height/2);
      el.style.transform = `perspective(600px) rotateX(${(-dy*6).toFixed(2)}deg) rotateY(${(dx*6).toFixed(2)}deg) translateZ(6px)`;
    }, {passive:true});
    el.addEventListener('mouseleave', ()=>{ el.style.transform = 'perspective(600px) translateZ(0)'; });
  });
}
document.addEventListener('DOMContentLoaded', ()=>{
  enableTilt('.nav.desktop-nav a, .btn'); // menyu pilllari va tugmalar
});
/* === Lightweight 3D tilt for modern feel === */
function enableTilt(sel){
  const nodes = document.querySelectorAll(sel);
  nodes.forEach(el=>{
    el.style.transformStyle = 'preserve-3d';
    el.addEventListener('mousemove', (e)=>{
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width/2, cy = r.top + r.height/2;
      const dx = (e.clientX - cx) / (r.width/2);
      const dy = (e.clientY - cy) / (r.height/2);
      el.style.transform = `perspective(600px) rotateX(${(-dy*5).toFixed(2)}deg) rotateY(${(dx*5).toFixed(2)}deg) translateZ(6px)`;
    }, {passive:true});
    el.addEventListener('mouseleave', ()=>{ el.style.transform = 'perspective(600px) translateZ(0)'; });
  });
}
document.addEventListener('DOMContentLoaded', ()=>{
  enableTilt('.nav.desktop-nav a, .btn, .lb-row, .scard, .eh-card');
});
