import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

/* =====================
 * Firebase
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
 * Theme: LIGHT ONLY
 * ===================== */
function applyLight(){
  document.documentElement.style.colorScheme = 'light';
  document.body.classList.add('theme-light');
  try { localStorage.removeItem('mc_theme'); } catch {}
  const btn = document.querySelector('#btnTheme');
  if (btn){ btn.style.display = 'none'; }
}
export function initTheme(){ applyLight(); }

/* =====================
 * Legacy bottom bar off
 * ===================== */
export function ensureBottomBar(){
  document.querySelectorAll('.bottom-bar').forEach(el => { el.style.display = 'none'; });
}

/* =====================
 * Auth + Header pills + Side footer mirror
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

export function attachAuthUI({ requireSignIn = true } = {}){
  const idEl  = ()=> document.querySelector('#hdrId');
  const balEl = ()=> document.querySelector('#hdrBal');
  const gemEl = ()=> document.querySelector('#hdrGem');
  const sideId  = ()=> document.querySelector('#pillId');
  const sideBal = ()=> document.querySelector('#pillBal');
  const sideGem = ()=> document.querySelector('#pillGem');

  onAuthStateChanged(auth, async (user)=>{
    if(!user){
      document.querySelector('#btnSignIn')?.classList.remove('hidden');
      idEl()  && (idEl().textContent='ID: —');
      balEl() && (balEl().textContent='💵 0');
      gemEl() && (gemEl().textContent='💎 0');
      sideId()  && (sideId().textContent='ID: —');
      sideBal() && (sideBal().textContent='💵 0');
      sideGem() && (sideGem().textContent='💎 0');

      if(requireSignIn){
        let o=document.querySelector('#authOverlay');
        if(!o){
          o=document.createElement('div');
          o.id='authOverlay'; o.className='modal';
          o.innerHTML=`<div class="dialog" role="dialog" aria-modal="true">
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
      }
      return;
    }

    document.querySelector('#authOverlay')?.remove();
    const profile = await ensureUserDoc(user.uid, user);
    document.querySelector('#btnSignIn')?.classList.add('hidden');

    const nid = (profile.numericId ?? '—');
    const bal = (profile.balance ?? 0);
    const gem = (profile.gems ?? 0);

    idEl()    && (idEl().textContent   = 'ID: '+nid);
    balEl()   && (balEl().textContent  = '💵 '+bal);
    gemEl()   && (gemEl().textContent  = '💎 '+gem);
    sideId()  && (sideId().textContent = 'ID: '+nid);
    sideBal() && (sideBal().textContent= '💵 '+bal);
    sideGem() && (sideGem().textContent= '💎 '+gem);

    window.__mcUser = { user, profile };
    document.dispatchEvent(new CustomEvent('mc:user-ready', { detail: window.__mcUser }));
  });

  // Global sign-in/out tugmalari
  document.addEventListener('click', async (e)=>{
    if(e.target && (e.target.id==='btnSignIn' || e.target.matches('[data-action="signin"]'))){
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider).catch(err=> alert('Kirish xatosi: '+err.message));
    }
    if(e.target && (
      e.target.id==='btnSignOut' ||
      e.target.id==='sideSignOut' ||                 // yon panel pastidagi tugma
      e.target.matches('[data-action="signout"]')
    )){
      await signOut(auth).catch(err=> alert('Chiqishda xato: '+err.message));
      location.reload();
    }
  });
}

/* =====================
 * Nav active
 * ===================== */
function updateActiveNav(){
  const hash = location.hash || '#home';
  document.querySelectorAll('.side-nav .nav-link').forEach(a=>{
    const href = a.getAttribute('href')||'';
    a.classList.toggle('active', href === hash);
  });
}
window.addEventListener('hashchange', updateActiveNav, { passive:true });

/* =====================
 * Off-canvas toggle + 3D parallax
 * ===================== */
function setupSideNav(){
  const sideNav   = document.getElementById('sideNav');
  const sideOv    = document.getElementById('sideOverlay');
  const menuBtn   = document.getElementById('menuToggle');
  const inner     = document.getElementById('sideNavInner');

  const open = () => {
    if(!sideNav) return;
    sideNav.setAttribute('data-state','open');
    if(sideOv) sideOv.hidden = false;
    document.body.style.overflow = 'hidden';
  };
  const close = () => {
    if(!sideNav) return;
    sideNav.setAttribute('data-state','closed');
    if(sideOv) sideOv.hidden = true;
    document.body.style.overflow = '';
  };

  // Toggle
  menuBtn?.addEventListener('click', ()=> {
    const isOpen = sideNav?.getAttribute('data-state') === 'open';
    isOpen ? close() : open();
  });
  // Overlay bosilganda yopish
  sideOv?.addEventListener('click', close);
  // Link bosilganda (faqat <1024px) yopish
  sideNav?.querySelectorAll('a').forEach(a=>{
    a.addEventListener('click', ()=>{ if(window.innerWidth < 1024) close(); });
  });

  // Dastlabki holat:
  if(window.innerWidth >= 1024){
    sideNav?.setAttribute('data-state','open');
    sideOv && (sideOv.hidden = true);
  }else{
    sideNav?.setAttribute('data-state','closed');
  }

  // Parallax/tilt: sichqon joyiga qarab fon qatlamlarini yurgizish (PC)
  const bg1 = sideNav?.querySelector('.sn-bg-1');
  const bg2 = sideNav?.querySelector('.sn-bg-2');
  const bg3 = sideNav?.querySelector('.sn-bg-3');
  const parallax = (e)=>{
    const r = sideNav.getBoundingClientRect();
    const cx = r.left + r.width/2, cy = r.top + r.height/2;
    const dx = (e.clientX - cx) / (r.width/2);
    const dy = (e.clientY - cy) / (r.height/2);
    bg1 && (bg1.style.transform = `translateZ(-60px) translate(${dx*8}px, ${dy*8}px) scale(1.2)`);
    bg2 && (bg2.style.transform = `translateZ(-30px) translate(${dx*14}px, ${dy*12}px) scale(1.1)`);
    bg3 && (bg3.style.transform = `translateZ(-10px) translate(${dx*20}px, ${dy*18}px)`);
  };
  const resetParallax = ()=>{
    bg1 && (bg1.style.transform = `translateZ(-60px) scale(1.2)`);
    bg2 && (bg2.style.transform = `translateZ(-30px) scale(1.1)`);
    bg3 && (bg3.style.transform = `translateZ(-10px)`);
  };
  sideNav?.addEventListener('mousemove', (e)=>{
    if(window.innerWidth >= 1024) parallax(e);
  }, {passive:true});
  sideNav?.addEventListener('mouseleave', resetParallax, {passive:true});
}

/* =====================
 * Lightweight 3D tilt for items
 * ===================== */
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

/* =====================
 * UX init
 * ===================== */
export function initUX(){
  initTheme();
  ensureBottomBar();
  document.documentElement.classList.add('js-ready');

  setupSideNav();
  updateActiveNav();

  // 3D tilt: linklar, tugmalar, kartalar
  enableTilt('.side-nav .nav-link, .btn, .pill, .card');
}

/* =====================
 * DOM Ready
 * ===================== */
document.addEventListener('DOMContentLoaded', ()=>{
  initUX();
  attachAuthUI({ requireSignIn: true });
});
// 3D tilt: nav-link, tugma, HEADER pill va kartalar
enableTilt('.side-nav .nav-link, .btn, .mc-right .pill, .card');
