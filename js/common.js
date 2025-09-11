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


/* =====================
 *  Theme (light/dark/system) — persistent + PWA-friendly
 * ===================== */
const THEME_KEY = 'mc_theme'; // 'light' | 'dark' | 'system'
function readThemePref(){
  try { return localStorage.getItem(THEME_KEY) || 'system'; } catch { return 'system'; }
}
function systemPrefersDark(){
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}
function applyTheme(mode){
  const root = document.documentElement;
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  let resolved = mode;
  if (mode === 'system') resolved = systemPrefersDark() ? 'dark' : 'light';
  root.setAttribute('data-theme', resolved === 'dark' ? 'dark' : 'light');

  // Update UA widgets color-scheme for correct native controls
  try { root.style.colorScheme = (resolved === 'dark' ? 'dark' : 'light'); } catch {}

  // Update theme-color for PWA/status bar
  if (metaTheme){
    metaTheme.setAttribute('content', resolved === 'dark' ? '#041f12' : '#f6fbf8');
  }

  // Update toggle icon if present
  const btn = document.getElementById('btnTheme');
  if (btn){
    const isDark = resolved === 'dark';
    btn.textContent = isDark ? '☀️' : '🌙';
    btn.setAttribute('aria-pressed', String(isDark));
    btn.title = isDark ? 'Kun rejimi' : 'Tun rejimi';
  }
}
export function initTheme(){
  const stored = readThemePref();
  applyTheme(stored);

  // Live update on system change if in 'system' mode
  try {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener?.('change', () => {
      if (readThemePref() === 'system') applyTheme('system');
    });
  } catch {}

  // Toggle button listener
  document.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'btnTheme'){
      const current = readThemePref();
      // cycle: light -> dark -> system -> light
      const next = current === 'light' ? 'dark' : current === 'dark' ? 'system' : 'light';
      try { localStorage.setItem(THEME_KEY, next); } catch {}
      applyTheme(next);
    }
  });
}
export const ADMIN_NUMERIC_IDS = [1000001, 1000002];

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

/* =====================
 *  Theme: FORCE LIGHT ONLY
 * ===================== */
// (old light-only theme removed)

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
export function initUX(){
  initTheme();
  ensureBottomBar();
  document.documentElement.classList.add('js-ready');
}
