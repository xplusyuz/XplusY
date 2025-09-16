import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

/* ================= Firebase ================= */
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

/* ================= Theme (light only) ================= */
function applyLight(){
  document.documentElement.style.colorScheme = 'light';
  document.body.classList.add('theme-light');
  try{ localStorage.removeItem('mc_theme'); }catch{}
  const btn = document.querySelector('#btnTheme');
  if(btn){ btn.style.display = 'none'; }
}
export function initTheme(){ applyLight(); }

/* ================= Helpers ================= */
export function ensureBottomBar(){
  document.querySelectorAll('.bottom-bar').forEach(el => el.style.display='none');
}

async function ensureUserDoc(uid, profile){
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if(!snap.exists()){
    await setDoc(ref, {
      uid, email: profile.email || null, displayName: profile.displayName || null,
      createdAt: serverTimestamp(),
      numericId:null, firstName:'', lastName:'', middleName:'', dob:'', region:'', district:'', phone:'',
      balance:0, gems:0, badges:[]
    });
  }
  return (await getDoc(ref)).data();
}

/* ================= Auth + header pills ================= */
export function attachAuthUI({ requireSignIn = true } = {}){
  const idEl  = ()=> document.querySelector('#hdrId');
  const balEl = ()=> document.querySelector('#hdrBal');
  const gemEl = ()=> document.querySelector('#hdrGem');

  onAuthStateChanged(auth, async (user)=>{
    if(!user){
      document.querySelector('#btnSignIn')?.classList.remove('hidden');
      idEl()  && (idEl().textContent='ID: —');
      balEl() && (balEl().textContent='💵 0');
      gemEl() && (gemEl().textContent='💎 0');

      if(requireSignIn && !document.querySelector('#authOverlay')){
        const o = document.createElement('div');
        o.id='authOverlay'; o.className='modal';
        o.innerHTML = `<div class="dialog" role="dialog" aria-modal="true">
            <div class="head"><h3 style="margin:0">Kirish</h3></div>
            <div class="body"><p class="sub">Google orqali tez va xavfsiz kiring</p></div>
            <div class="foot"><button id="overlaySignIn" class="btn primary">Google bilan kirish</button></div>
          </div>`;
        document.body.appendChild(o);
        o.addEventListener('click', (e)=>{ if(e.target===o) o.remove(); });
        document.addEventListener('keydown', (e)=>{ if(e.key==='Escape'){ o?.remove(); }});
        o.querySelector('#overlaySignIn').addEventListener('click', async ()=>{
          const provider = new GoogleAuthProvider();
          await signInWithPopup(auth, provider).catch(e=> alert('Kirish xatosi: '+e.message));
        });
      }
      return;
    }

    document.querySelector('#authOverlay')?.remove();
    const profile = await ensureUserDoc(user.uid, user);
    document.querySelector('#btnSignIn')?.classList.add('hidden');

    const nid = profile.numericId ?? '—';
    const bal = profile.balance ?? 0;
    const gem = profile.gems ?? 0;

    idEl()  && (idEl().textContent  = 'ID: '+nid);
    balEl() && (balEl().textContent = '💵 '+bal);
    gemEl() && (gemEl().textContent = '💎 '+gem);

    window.__mcUser = { user, profile };
    document.dispatchEvent(new CustomEvent('mc:user-ready', { detail: window.__mcUser }));
  });

  document.addEventListener('click', async (e)=>{
    if(e.target && (e.target.id==='btnSignIn' || e.target.matches('[data-action="signin"]'))){
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider).catch(err=> alert('Kirish xatosi: '+err.message));
    }
    if(e.target && (
      e.target.id==='btnSignOut' || e.target.id==='sideSignOut' || e.target.matches('[data-action="signout"]')
    )){
      await signOut(auth).catch(err=> alert('Chiqishda xato: '+err.message));
      location.reload();
    }
  });
}

/* ================= Nav active ================= */
function updateActiveNav(){
  const hash = location.hash || '#home';
  document.querySelectorAll('.side-nav .nav-link').forEach(a=>{
    const href = a.getAttribute('href')||'';
    a.classList.toggle('active', href === hash);
  });
}
window.addEventListener('hashchange', ()=>{
  updateActiveNav();
  // mobil/planshetda route bosilganda panel yopilsin
  if(!document.body.classList.contains('sidebar-desktop')) closeSidebar();
}, { passive:true });

/* ================= Sidebar controller ================= */
let mql;
function applyMode(e){
  const desktop = e.matches;
  if(desktop){
    document.body.classList.add('sidebar-desktop');
    openSidebar(false);   // open without locking scroll / overlay
  }else{
    document.body.classList.remove('sidebar-desktop');
    closeSidebar(false);  // close without animation side-effects
  }
}

function initMatchMedia(){
  mql = window.matchMedia('(min-width: 1024px)');
  applyMode(mql);               // initial
  mql.addEventListener('change', applyMode);
}

function openSidebar(lockScroll = true){
  const sideNav = document.getElementById('sideNav');
  const overlay = document.getElementById('sideOverlay');
  if(!sideNav) return;
  sideNav.classList.add('is-open');
  if(overlay && !document.body.classList.contains('sidebar-desktop')){
    overlay.hidden = false;
    if(lockScroll) document.body.style.overflow = 'hidden';
  }
}

function closeSidebar(restoreScroll = true){
  const sideNav = document.getElementById('sideNav');
  const overlay = document.getElementById('sideOverlay');
  if(!sideNav) return;
  sideNav.classList.remove('is-open');
  if(overlay){ overlay.hidden = true; }
  if(restoreScroll){ document.body.style.overflow = ''; }
}

function setupSidebarUI(){
  const sideNav = document.getElementById('sideNav');
  const overlay = document.getElementById('sideOverlay');
  const btn     = document.getElementById('menuToggle');

  // Toggle
  btn?.addEventListener('click', ()=>{
    const opened = sideNav?.classList.contains('is-open');
    opened ? closeSidebar() : openSidebar();
  });

  // Overlay / ESC
  overlay?.addEventListener('click', ()=> closeSidebar());
  document.addEventListener('keydown', (e)=>{
    if(e.key === 'Escape' && !document.body.classList.contains('sidebar-desktop')){
      closeSidebar();
    }
  });

  // Link bosilganda mobil/planshetda yopish
  sideNav?.querySelectorAll('a').forEach(a=>{
    a.addEventListener('click', ()=>{
      if(!document.body.classList.contains('sidebar-desktop')) closeSidebar();
    });
  });

  // Touch swipe-left (mobil)
  let startX=null, startY=null, moved=false;
  sideNav?.addEventListener('touchstart', (e)=>{
    if(document.body.classList.contains('sidebar-desktop')) return;
    const t = e.touches[0]; startX = t.clientX; startY = t.clientY; moved=false;
  }, {passive:true});
  sideNav?.addEventListener('touchmove', (e)=>{
    if(startX===null) return;
    const t = e.touches[0]; const dx = t.clientX - startX; const dy = t.clientY - startY;
    if(Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) moved=true;
    // optional: could add drag transform preview
  }, {passive:true});
  sideNav?.addEventListener('touchend', ()=>{
    if(moved && startX!==null){
      // chapga surib yuborilgan deb qabul qilamiz
      closeSidebar();
    }
    startX=null; startY=null; moved=false;
  }, {passive:true});
}

/* ================= Tilt (buttons/pills/cards) ================= */
function enableTilt(sel){
  const nodes = document.querySelectorAll(sel);
  nodes.forEach(el=>{
    el.style.transformStyle = 'preserve-3d';
    el.addEventListener('mousemove', (e)=>{
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width/2, cy = r.top + r.height/2;
      const dx = (e.clientX - cx) / (r.width/2);
      const dy = (e.clientY - cy) / (r.height/2);
      el.style.transform = `perspective(700px) rotateX(${(-dy*5).toFixed(2)}deg) rotateY(${(dx*5).toFixed(2)}deg) translateZ(6px)`;
    }, {passive:true});
    el.addEventListener('mouseleave', ()=>{ el.style.transform = 'perspective(700px) translateZ(0)'; });
  });
}

/* ================= UX init ================= */
export function initUX(){
  initTheme();
  ensureBottomBar();
  document.documentElement.classList.add('js-ready');

  initMatchMedia();     // decide desktop vs mobile by class
  setupSidebarUI();
  updateActiveNav();

  // 3D tilt on header pills, buttons, nav links, cards
  enableTilt('.side-nav .nav-link, .btn, .mc-right .pill, .card');
}

/* ================= DOM Ready ================= */
document.addEventListener('DOMContentLoaded', ()=>{
  initUX();
  attachAuthUI({ requireSignIn: true });
});
