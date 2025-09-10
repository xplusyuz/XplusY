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
 *  Theme (Dark/Light/Auto)
 * =====================
 * Modes:
 *  - 'dark'  : force dark
 *  - 'light' : force light
 *  - 'auto'  : follow system (default)
 * Button with id #btnTheme cycles: dark → light → auto
 */
const THEME_KEY = 'mc_theme';
let mediaQuery = window.matchMedia('(prefers-color-scheme: light)');

function systemIsLight(){ return mediaQuery.matches; }
function getStoredTheme(){
  const saved = localStorage.getItem(THEME_KEY);
  return (saved === 'dark' || saved === 'light' || saved === 'auto') ? saved : null;
}
function iconFor(mode){
  if(mode === 'light') return '☀️';
  if(mode === 'dark') return '🌙';
  return '🖥️'; // auto
}
function labelFor(mode){
  if(mode === 'light') return 'Kun (Light)';
  if(mode === 'dark') return 'Tun (Dark)';
  return 'Tizim (Auto)';
}
function applyColorScheme(light){
  // Helps form controls and UA styling match the theme
  document.documentElement.style.colorScheme = light ? 'light' : 'dark';
}
function applyThemeClass(light){
  // Our CSS uses .theme-light to flip tokens
  document.body.classList.toggle('theme-light', !!light);
}
function setTheme(mode){
  // Resolve final appearance
  const effectiveLight = (mode === 'light') ? true : (mode === 'dark') ? false : systemIsLight();
  applyThemeClass(effectiveLight);
  applyColorScheme(effectiveLight);
  // Persist + button UI
  localStorage.setItem(THEME_KEY, mode);
  const t = document.querySelector('#btnTheme');
  if(t){
    t.textContent = iconFor(mode);
    t.setAttribute('title', labelFor(mode));
    t.setAttribute('aria-label', labelFor(mode));
  }
  document.body.dataset.theme = mode; // possible use in CSS
}

function currentTheme(){ return getStoredTheme() ?? 'auto'; }
function cycleTheme(){
  const order = ['dark', 'light', 'auto'];
  const next = order[(order.indexOf(currentTheme()) + 1) % order.length];
  setTheme(next);
}

function bindThemeListeners(){
  // Button click cycles between modes
  document.addEventListener('click', (e)=>{
    if(e.target && e.target.id === 'btnTheme'){ cycleTheme(); }
  });
  // Keyboard 't' toggles as a shortcut
  document.addEventListener('keydown', (e)=>{
    if(e.key.toLowerCase() === 't' && !e.altKey && !e.metaKey && !e.ctrlKey){
      cycleTheme();
    }
  });
  // Keep windows/tabs in sync
  window.addEventListener('storage', (e)=>{
    if(e.key === THEME_KEY && e.newValue){
      setTheme(e.newValue);
    }
  });
  // React to system preference when in auto
  mediaQuery.addEventListener('change', ()=>{
    if(currentTheme() === 'auto'){ setTheme('auto'); }
  });
}

function applyReducedMotion(){
  const rm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.body.classList.toggle('reduced-motion', rm);
}

/* Public: initialize theme on page load */
export function initTheme(){
  const initial = getStoredTheme() ?? 'auto';
  setTheme(initial);
  bindThemeListeners();
  applyReducedMotion();
}

/* =====================
 *  Bottom bar (kept hidden or removed for cleanliness)
 * ===================== */
export function ensureBottomBar(){
  // If any legacy .bottom-bar elements exist, hide them to avoid UI conflicts.
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
          // Close on backdrop click / Escape
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
export function initUX(){
  initTheme();
  ensureBottomBar();
  // Mark JS-ready to allow CSS progressive enhancement hooks if needed
  document.documentElement.classList.add('js-ready');
}
