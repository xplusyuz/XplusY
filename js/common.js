
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

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

/* Theme */
function getStoredTheme(){ return localStorage.getItem('mc_theme'); }
function setTheme(mode){
  const b = document.body;
  b.classList.remove('theme-light');
  if(mode==='light') b.classList.add('theme-light');
  localStorage.setItem('mc_theme', mode);
  const t = document.querySelector('#btnTheme');
  if(t) t.textContent = (mode==='light') ? '☀️' : '🌙';
}
export function initTheme(){
  let mode = getStoredTheme();
  if(!mode){
    mode = (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) ? 'light' : 'dark';
  }
  setTheme(mode);
  document.addEventListener('click', (e)=>{
    if(e.target && e.target.id==='btnTheme'){
      setTheme(document.body.classList.contains('theme-light') ? 'dark' : 'light');
    }
  });
}

/* Bottom bar */
export function ensureBottomBar(){
  if(document.querySelector('#bottomBar')) return;
  const bar=document.createElement('nav');
  bar.id='bottomBar'; bar.className='bottom-bar';
  bar.innerHTML = `
    <a href="./index.html" data-path="/index.html"><span>🏠</span><i>Bosh</i></a>
    <a href="./tests.html" data-path="/tests.html"><span>📝</span><i>Testlar</i></a>
    <a href="./live.html" class="big" data-path="/live.html"><span>🎮</span><i>Live</i></a>
    <a href="./leaderboard.html" data-path="/leaderboard.html"><span>🏅</span><i>Reyting</i></a>
    <a href="./settings.html" data-path="/settings.html"><span>⚙️</span><i>Sozlamalar</i></a>`;
  document.body.appendChild(bar);
  const p = location.pathname.replace(/\\/g,'/');
  document.querySelectorAll('#bottomBar a').forEach(a=>{
    if(p.endsWith(a.getAttribute('data-path'))) a.classList.add('active');
  });
}

/* Auth + header pills */
async function ensureUserDoc(uid, profile){
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if(!snap.exists()){
    await setDoc(ref, {
      uid, email: profile.email || null, displayName: profile.displayName || null, createdAt: serverTimestamp(),
      numericId: null, firstName:'', lastName:'', middleName:'', dob:'', region:'', district:'', phone:'',
      balance:0, gems:0, badges:[]
    });
    return (await getDoc(ref)).data();
  }
  return snap.data();
}

export function attachAuthUI({ requireSignIn = true } = {}){
  const idEl = ()=> document.querySelector('#hdrId');
  const balEl = ()=> document.querySelector('#hdrBal');
  const gemEl = ()=> document.querySelector('#hdrGem');
  const btnIn = ()=> document.querySelector('#btnSignIn');
  const btnOut = ()=> document.querySelector('#btnSignOut');

  onAuthStateChanged(auth, async (user)=>{
    if(!user){
      btnIn()?.classList.remove('hidden');
      btnOut()?.classList.add('hidden');
      idEl() && (idEl().textContent='ID: —');
      balEl() && (balEl().textContent='💵 0');
      gemEl() && (gemEl().textContent='💎 0');
      if(requireSignIn){
        let o=document.querySelector('#authOverlay');
        if(!o){
          o=document.createElement('div');
          o.id='authOverlay'; o.className='modal';
          o.innerHTML=`<div class="dialog"><div class="head"><h3>Kirish</h3></div>
            <div class="body"><p class="sub">Google orqali tez va xavfsiz kiring</p></div>
            <div class="foot"><button id="overlaySignIn" class="btn primary">Google bilan kirish</button></div></div>`;
          document.body.appendChild(o);
          o.addEventListener('click', (e)=>{ if(e.target===o) o.remove(); });
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
    idEl() && (idEl().textContent='ID: '+(profile.numericId ?? '—'));
    balEl() && (balEl().textContent='💵 '+(profile.balance ?? 0));
    gemEl() && (gemEl().textContent='💎 '+(profile.gems ?? 0));
    window.__mcUser = { user, profile };
    document.dispatchEvent(new CustomEvent('mc:user-ready', { detail: window.__mcUser }));
  });

  document.addEventListener('click', async (e)=>{
    if(e.target && e.target.id==='btnSignIn'){
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider).catch(e=> alert('Kirish xatosi: '+e.message));
    }
    if(e.target && e.target.id==='btnSignOut'){
      await signOut(auth).catch(e=> alert('Chiqishda xato: '+e.message));
      location.reload();
    }
  });
}

/* Init per page */
export function initUX(){
  initTheme();
  ensureBottomBar();
}
