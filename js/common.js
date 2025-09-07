// Common utilities: header/footer load, Firebase init, auth guard, user capsule
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

export const firebaseConfig = {
  apiKey: "AIzaSyDYwHJou_9GqHZcf8XxtTByC51Z8un8rrM",
  authDomain: "xplusy-760fa.firebaseapp.com",
  projectId: "xplusy-760fa",
  storageBucket: "xplusy-760fa.appspot.com",
  messagingSenderId: "992512966017",
  appId: "1:992512966017:web:5e919dbc9b8d8abcb43c80",
  measurementId: "G-459PLJ7P7L"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export const ADMIN_NUMERIC_IDS = [1000001, 1000002];

// Inject header/footer
export async function mountChrome(){
  async function tryFetch(cands){
    for(const p of cands){
      try{
        const r = await fetch(p, {cache:'no-cache'});
        if(r.ok) return await r.text();
      }catch(_){}
    }
    return null;
  }
  const headerHost = document.querySelector('header.mc-header');
  const footerHost = document.querySelector('footer.mc-footer');

  // build candidate paths relative to current location
  const path = location.pathname;
  const dir = path.endsWith('/') ? path : path.substring(0, path.lastIndexOf('/')) + '/';
  const upOne = dir.replace(/[^/]+\/$/, '');
  const upTwo = upOne.replace(/[^/]+\/$/, '');

  const headerCands = ['/header.html', dir+'header.html', './header.html', upOne+'header.html', upTwo+'header.html'];
  const footerCands = ['/footer.html', dir+'footer.html', './footer.html', upOne+'footer.html', upTwo+'footer.html'];

  if(headerHost){
    const h = await tryFetch(headerCands);
    headerHost.innerHTML = h ?? `<div class="mc-left">
      <button id="btnMenu" class="icon-btn" aria-label="Menyuni ochish">☰</button>
      <div class="brand">
        <img src="/assets/logo.svg" alt="MathCenter" />
        <span>MathCenter</span>
      </div>
    </div>
    <nav class="nav desktop-nav">
      <a href="/index.html">🏠 Bosh sahifa</a>
      <a href="/tests.html">📝 Testlar</a>
      <a href="/live.html">🎮 Live</a>
      <a href="/leaderboard.html">🏅 Reyting</a>
      <a href="/settings.html">⚙️ Sozlamalar</a>
    </nav>
    <div class="mc-right">
      <button id="btnTheme" class="icon-btn" title="Kun/Tun">🌙</button>
      <span id="hdrId" class="pill">ID: —</span>
      <span id="hdrBal" class="pill">💵 0</span>
      <span id="hdrGem" class="pill">💎 0</span>
      <button id="btnSignIn" class="btn primary">Kirish</button>
      <button id="btnSignOut" class="btn ghost hidden">Chiqish</button>
    </div>`;
  }
  if(footerHost){
    const f = await tryFetch(footerCands);
    footerHost.innerHTML = f ?? `<div class="container" style="padding:24px 16px">
      <div class="sub">© MathCenter v3 — tests + live + real-time</div>
      <div class="sub">Dizayn: mobil-first, yashil tema.</div>
    </div>`;
  }
}
  if(footer){
    const f = await fetch('/footer.html').then(r=>r.text()).catch(()=>null);
    if(f) footer.innerHTML = f;
  }
}

// Ensure user doc exists
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
      firstName: "", lastName: "", middleName: "",
      dob: "", region: "", district: "", phone: "",
      balance: 0, gems: 0, badges: []
    });
    return (await getDoc(ref)).data();
  }
  return snap.data();
}

// Attach auth listeners and update header
export function attachAuthUI({ requireSignIn = true } = {}){
  const btnIn = () => document.querySelector('#btnSignIn');
  const btnOut = () => document.querySelector('#btnSignOut');
  const idEl = () => document.querySelector('#hdrId');
  const balEl = () => document.querySelector('#hdrBal');
  const gemEl = () => document.querySelector('#hdrGem');

  onAuthStateChanged(auth, async (user)=>{
    if(!user){
      if(requireSignIn){
        document.body.classList.add('need-auth');
        // Show a simple overlay
        let o = document.querySelector('#authOverlay');
        if(!o){
          o = document.createElement('div');
          o.id = 'authOverlay';
          o.style.position = 'fixed';
          o.style.inset = '0';
          o.style.display = 'flex';
          o.style.alignItems = 'center';
          o.style.justifyContent = 'center';
          o.style.background = 'rgba(0,0,0,.55)';
          o.style.zIndex = '90';
          o.innerHTML = `<div class="card" style="max-width:520px">
            <h2>Davom etish uchun tizimga kiring</h2>
            <p class="sub">Google orqali tez va xavfsiz kirish</p>
            <div style="display:flex;gap:10px">
              <button id="overlaySignIn" class="btn primary">Google bilan kirish</button>
            </div>
          </div>`;
          document.body.appendChild(o);
          o.querySelector('#overlaySignIn')?.addEventListener('click', async ()=>{
            const provider = new GoogleAuthProvider();
            await signInWithPopup(auth, provider).catch(e=>alert('Kirish xatosi: '+e.message));
          });
        }
      }
      btnIn()?.classList.remove('hidden');
      btnOut()?.classList.add('hidden');
      idEl() && (idEl().textContent = 'ID: —');
      balEl() && (balEl().textContent = '💵 0');
      gemEl() && (gemEl().textContent = '💎 0');
      return;
    }

    document.querySelector('#authOverlay')?.remove();
    const profile = await ensureUserDoc(user.uid, user);
    // Update header
    idEl() && (idEl().textContent = 'ID: ' + (profile.numericId ?? '—'));
    balEl() && (balEl().textContent = '💵 ' + (profile.balance ?? 0));
    gemEl() && (gemEl().textContent = '💎 ' + (profile.gems ?? 0));
    btnIn()?.classList.add('hidden');
    btnOut()?.classList.remove('hidden');

    // expose current profile for pages
    window.__mcUser = { user, profile };
    document.dispatchEvent(new CustomEvent('mc:user-ready', { detail: window.__mcUser }));
  });

  document.addEventListener('click', async (e)=>{
    if(e.target.id === 'btnSignIn'){
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider).catch(e=>alert('Kirish xatosi: '+e.message));
    }
    if(e.target.id === 'btnSignOut'){
      await signOut(auth).catch(e=>alert('Chiqishda xato: '+e.message));
      location.reload();
    }
  });
}

// Theme handling
function getStoredTheme(){
  return localStorage.getItem('mc_theme');
}
function applyTheme(mode){
  const b = document.body;
  b.classList.remove('theme-light');
  if(mode==='light'){ b.classList.add('theme-light'); }
  localStorage.setItem('mc_theme', mode);
  const tBtn = document.querySelector('#btnTheme');
  const tBtn2 = document.querySelector('#btnThemeDrawer');
  const icon = (mode==='light') ? '☀️' : '🌙';
  if(tBtn) tBtn.textContent = icon;
  if(tBtn2) tBtn2.textContent = icon + ' Kun/Tun';
}
function initTheme(){
  let mode = getStoredTheme();
  if(!mode){
    // prefer OS
    mode = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  applyTheme(mode);
}

// Drawer handling
function openDrawer(){
  const d = document.querySelector('#drawer');
  const bg = document.querySelector('#drawerBackdrop');
  if(!d || !bg) return;
  d.classList.remove('hidden'); bg.classList.remove('hidden');
  setTimeout(()=> d.classList.add('open'),0);
}
function closeDrawer(){
  const d = document.querySelector('#drawer');
  const bg = document.querySelector('#drawerBackdrop');
  if(!d || !bg) return;
  d.classList.remove('open');
  setTimeout(()=>{ d.classList.add('hidden'); bg.classList.add('hidden'); }, 200);
}

export async function initUXChrome(){
  // Theme init
  initTheme();
  document.addEventListener('click', (e)=>{
    if(e.target.id==='btnTheme') applyTheme( document.body.classList.contains('theme-light') ? 'dark' : 'light' );
    if(e.target.id==='btnThemeDrawer') applyTheme( document.body.classList.contains('theme-light') ? 'dark' : 'light' );
    if(e.target.id==='btnMenu') openDrawer();
    if(e.target.id==='btnDrawerClose' || e.target.id==='drawerBackdrop') closeDrawer();
  });
  document.addEventListener('keydown', (e)=>{ if(e.key==='Escape') closeDrawer(); });
}

// Create drawer/backdrop at BODY level so it overlays header/body/footer
function ensureDrawer(){
  if(document.querySelector('#drawer') && document.querySelector('#drawerBackdrop')) return;
  const backdrop = document.createElement('div');
  backdrop.id='drawerBackdrop'; backdrop.className='drawer-backdrop hidden';
  const aside = document.createElement('aside');
  aside.id='drawer'; aside.className='drawer hidden'; aside.setAttribute('aria-hidden','true');
  aside.innerHTML = \`
    <div class="drawer-head">
      <div class="brand"><img src="/assets/logo.svg" alt=""/> <b>MathCenter</b></div>
      <button id="btnDrawerClose" class="icon-btn" aria-label="Yopish">&times;</button>
    </div>
    <nav class="drawer-nav">
      <a href="/index.html">🏠 Bosh sahifa</a>
      <a href="/tests.html">📝 Testlar</a>
      <a href="/live.html">🎮 Live</a>
      <a href="/leaderboard.html">🏅 Reyting</a>
      <a href="/settings.html">⚙️ Sozlamalar</a>
    </nav>
    <div class="drawer-foot">
      <button id="btnThemeDrawer" class="btn ghost">🌙 Kun/Tun</button>
    </div>\`;
  document.body.appendChild(backdrop);
  document.body.appendChild(aside);
}

export async function initUXChrome(){
  ensureDrawer();
  // Theme init
  initTheme();
  // Events
  document.addEventListener('click', (e)=>{
    if(e.target.id==='btnTheme' || e.target.id==='btnThemeDrawer'){
      applyTheme( document.body.classList.contains('theme-light') ? 'dark' : 'light' );
    }
    if(e.target.id==='btnMenu') openDrawer();
    if(e.target.id==='btnDrawerClose' || e.target.id==='drawerBackdrop') closeDrawer();
  });
  document.addEventListener('keydown', (e)=>{ if(e.key==='Escape') closeDrawer(); });
}
