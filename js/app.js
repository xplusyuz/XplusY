
import { loadPartial } from './router.js';
import { $, $$, showModal } from './common.js';
import { renderLB } from './leaderboard-only-olmos.js';
import { renderTestCards } from './tests-csv.js';
import { runTest } from './test-runner.js';
import { bindLiveCountdowns } from './live-countdowns.js';

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// PUBLIC config (from your messages)
const firebaseConfig = {
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
const provider = new GoogleAuthProvider();

function renderHeader(user){
  const h = $('#site-header');
  const idBadge = user ? `<span class="badge">ID: ${user.uid.slice(0,6)}...</span>` : '<span class="badge">Kirmagansiz</span>';
  h.innerHTML = `<div class="container nav">
    <div class="brand"><img src="/assets/logo.svg"/><span>MathCenter</span></div>
    <a href="#home" class="badge">🏠</a>
    <a href="#tests" class="badge">📝</a>
    <a href="#live" class="badge">🎮</a>
    <a href="#leaderboard" class="badge">🏆</a>
    <a href="#settings" class="badge">⚙️</a>
    <div class="spacer"></div>
    <div class="user-pill">
      ${idBadge} ${user ? `<b>${user.displayName||'Foydalanuvchi'}</b>` : ""}
      ${user ? `<button id="logout" class="btn ghost">Chiqish</button>` : `<button id="login" class="btn primary">Kirish</button>`}
    </div>
  </div>`;
  $('#login')?.addEventListener('click', ()=>{
    document.getElementById('auth-overlay').classList.remove('hidden');
  });
  $('#logout')?.addEventListener('click', async ()=>{ await signOut(auth); });
}

function renderFooter(){
  $('#site-footer').innerHTML = `<div class="container"><div class="muted">© ${new Date().getFullYear()} MathCenter</div></div>`;
}

async function ensureUserDoc(user){
  const ref = doc(db,'users',user.uid);
  const snap = await getDoc(ref);
  if(!snap.exists()){
    await setDoc(ref, {
      numericId: Date.now(),
      firstName: user.displayName?.split(' ')[0]||'',
      lastName: user.displayName?.split(' ').slice(1).join(' ')||'',
      region:"", district:"", phone:"",
      balance:0, gems:0, badges:[], attempts:0,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    });
  }
}

async function requireProfile(user){
  const ref = doc(db,'users',user.uid);
  const snap = await getDoc(ref);
  const u = snap.data()||{};
  if(!u.firstName || !u.lastName || !u.region || !u.district || !u.phone){
    await showModal({title:"Profil majburiy", body:"Ism, familiya, viloyat, tuman, telefon ma'lumotlarini to'ldiring."});
    location.hash="#profile";
  }
}

async function mountRoute(){
  const main = document.getElementById('view-root');
  try{
    const {name, html} = await loadPartial(location.hash);
    main.innerHTML = html;
    if(name==="leaderboard"){ await renderLB(main); }
    if(name==="tests"){
      const grid = main.querySelector('#tests-grid');
      if(grid){ await renderTestCards(grid); }
      // Bind start buttons
      main.querySelectorAll('a.start').forEach(a=>{
        a.addEventListener('click', async (ev)=>{
          ev.preventDefault();
          await runTest(main, {
            src: a.dataset.src,
            price: Number(a.dataset.price||0),
            title: a.dataset.title||a.textContent||"Test",
            perQuestionSec: Number(a.dataset.perq||120),
          });
        });
      });
    }
    if(name==="live"){ bindLiveCountdowns(main); }
    if(name==="profile"){ bindProfile(main); }
  }catch(e){
    main.innerHTML = `<div class="container"><div class="card">Xato: ${e.message}</div></div>`;
  }
}

function bindProfile(root){
  const form = root.querySelector('#profile-form');
  if(!form) return;
  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    if(!auth.currentUser){ await showModal({title:"Kirish", body:"Avval kiring"}); return; }
    const data = Object.fromEntries(new FormData(form).entries());
    const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    const ref = doc(db,'users',auth.currentUser.uid);
    try{
      await updateDoc(ref, {...data, updatedAt: new Date()});
      await showModal({title:"Saqlangan", body:"Profil yangilandi"});
      location.hash="#home";
    }catch(err){ await showModal({title:"Xato", body:err.message}); }
  });
}

// Auth overlay handlers
(function setupAuthOverlay(){
  const ov = document.getElementById('auth-overlay');
  document.getElementById('btn-auth-close').onclick = ()=> ov.classList.add('hidden');
  document.getElementById('btn-google').onclick = async ()=>{
    try{ await signInWithPopup(auth, new GoogleAuthProvider()); ov.classList.add('hidden'); }
    catch(e){ await showModal({title:"Kirish xatosi", body:e.message}); }
  };
})();

renderHeader(null); renderFooter();
window.addEventListener('hashchange', mountRoute);

onAuthStateChanged(auth, async (user)=>{
  renderHeader(user);
  if(user){ await ensureUserDoc(user); await requireProfile(user); }
  mountRoute();
});
