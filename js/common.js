import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

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
  document.documentElement.style.colorScheme = 'light';
  document.body.classList.add('theme-light');
  try { localStorage.removeItem('mc_theme'); } catch {}
  const btn = document.querySelector('#btnTheme');
  if (btn){ btn.style.display = 'none'; }
}
export function initTheme(){ applyLight(); }

/* =====================
 *  Kill legacy bottom bar
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

export function attachAuthUI({ requireSignIn = true } = {}){
  const idEl  = ()=> document.querySelector('#hdrId');
  const balEl = ()=> document.querySelector('#hdrBal');
  const gemEl = ()=> document.querySelector('#hdrGem');

  onAuthStateChanged(auth, async (user)=>{
    if(!user){
      document.querySelector('#btnSignIn')?.classList.remove('hidden');
      document.querySelector('#btnSignOut')?.classList.add('hidden');
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
    document.querySelector('#btnSignOut')?.classList.remove('hidden');
    idEl()  && (idEl().textContent='ID: '+(profile.numericId ?? '—'));
    balEl() && (balEl().textContent='💵 '+(profile.balance ?? 0));
    gemEl() && (gemEl().textContent='💎 '+(profile.gems ?? 0));

    window.__mcUser = { user, profile };
    document.dispatchEvent(new CustomEvent('mc:user-ready', { detail: window.__mcUser }));
  });

  // Header kirish/chiqish tugmalari
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
 *  Nav: active holatni yangilash
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
 *  Off-canvas toggle (mobil/planshet)
 * ===================== */
function setupSideNav(){
  const sideNav   = document.getElementById('sideNav');
  const sideOv    = document.getElementById('sideOverlay');
  const menuBtn   = document.getElementById('menuToggle');

  const open = () => {
    if(!sideNav) return;
    sideNav.setAttribute('data-state','open');
    if(sideOv){ sideOv.hidden = false; }
    document.body.style.overflow = 'hidden';
  };
  const close = () => {
    if(!sideNav) return;
    sideNav.setAttribute('data-state','closed');
    if(sideOv){ sideOv.hidden = true; }
    document.body.style.overflow = '';
  };

  // Toggle
  if(menuBtn){
    menuBtn.addEventListener('click', ()=>{
      const isOpen = sideNav?.getAttribute('data-state') === 'open';
      isOpen ? close() : open();
    });
  }
  // Overlay bosilganda yopish
  sideOv?.addEventListener('click', close);

  // Link bosilganda (faqat <1024px) yopish
  sideNav?.querySelectorAll('a').forEach(a=>{
    a.addEventListener('click', ()=>{
      if(window.innerWidth < 1024) close();
    });
  });

  // Rejim o‘zgarganda (responsive): PC holatida body overflow tiklash
  window.addEventListener('resize', ()=>{
    if(window.innerWidth >= 1024){
      document.body.style.overflow = '';
      sideOv && (sideOv.hidden = true);
      sideNav && sideNav.setAttribute('data-state','open'); // PC’da doim ochiq
    }else{
      // Mobilga qaytganda default yopiq
      sideNav && sideNav.setAttribute('data-state','closed');
    }
  }, { passive:true });

  // Dastlabki holat:
  if(window.innerWidth >= 1024){
    sideNav?.setAttribute('data-state','open'); // PC’da ochiq
    sideOv && (sideOv.hidden = true);
  }else{
    sideNav?.setAttribute('data-state','closed'); // Mobil/planshet yopiq
  }
}

/* =====================
 *  UX init
 * ===================== */
export function initUX(){
  initTheme();
  ensureBottomBar();
  document.documentElement.classList.add('js-ready');
  setupSideNav();
  updateActiveNav();

  // Yengil 3D tilt
  const enableTilt = (sel)=>{
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
  };
  enableTilt('.btn, .nav-link, .pill, .card');
}

/* =====================
 *  DOM Ready
 * ===================== */
document.addEventListener('DOMContentLoaded', ()=>{
  initUX();
  attachAuthUI({ requireSignIn: true });
});
