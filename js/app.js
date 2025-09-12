import { loadRoute } from './router.js';
import { $, modal } from './common.js';
import { renderLeaderboard } from './leaderboard.js';
import { startTest } from './tests.js';

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// --- Firebase PUBLIC config (user provided) ---
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

// Shell render
function renderHeader(user){
  const h = document.getElementById('app-header');
  const uid = user?.uid || "";
  const badge = uid ? `<span class="badge">ID: ${uid.slice(0,6)}...</span>` : '<span class="badge">Kirmagansiz</span>';
  h.innerHTML = `<div class="container nav">
    <div class="brand">
      <img src="/assets/favicon.svg" alt="logo"/><span>MathCenter</span>
    </div>
    <a href="#home" class="badge">🏠 Bosh sahifa</a>
    <a href="#tests" class="badge">📝 Testlar</a>
    <a href="#live" class="badge">🎮 Live</a>
    <a href="#leaderboard" class="badge">🏆 Reyting</a>
    <a href="#settings" class="badge">⚙️ Sozlamalar</a>
    <div class="spacer"></div>
    <div class="user-pill">
      ${badge}
      ${user ? `<b>${user.displayName||'Foydalanuvchi'}</b>` : ''}
      ${user ? `<button id="logout" class="btn ghost">Chiqish</button>` : `<button id="login" class="btn primary">Google bilan kirish</button>`}
    </div>
  </div>`;
  const login = document.getElementById('login');
  if(login){ login.onclick = async ()=>{
      try{ await signInWithPopup(auth, provider); }
      catch(e){ await modal({title:"Kirish xatosi", body:e.message}); }
  };}
  const logout = document.getElementById('logout');
  if(logout){ logout.onclick = async ()=>{ await signOut(auth); }; }
}

function renderFooter(){
  const f = document.getElementById('app-footer');
  f.innerHTML = `<div class="container">
    <div class="meta">© ${new Date().getFullYear()} MathCenter / XplusY</div>
  </div>`;
}

async function ensureUserDoc(user){
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  if(!snap.exists()){
    await setDoc(ref, {
      numericId: Date.now(),
      firstName: user.displayName?.split(' ')[0]||'',
      lastName: user.displayName?.split(' ').slice(1).join(' ')||'',
      region: "", district: "", phone: "",
      balance: 0, gems: 0, badges: [], attempts: 0,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    });
  }
}

async function guardProfile(user){
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  const u = snap.data()||{};
  if(!u.firstName || !u.lastName || !u.region || !u.district || !u.phone){
    await modal({title:"Profilni to'ldiring", body:"Ism, familiya, viloyat, tuman, telefon majburiy."});
    location.hash = "#profile";
  }
}

async function renderRoute(){
  const main = document.getElementById('app-main');
  try{
    const {name, html} = await loadRoute(location.hash);
    main.innerHTML = html;
    // Hook route
    if(name === "leaderboard"){
      const mod = await import('./leaderboard.js'); await mod.renderLeaderboard(main);
    }
    if(name === "tests"){
      // Tests page lists sample cards driven by CSV listing
      bindTests(main);
    }
    if(name === "profile"){
      bindProfile(main);
    }
    if(name === "home"){
      // nothing specific; banner already shown in partial
    }
  }catch(e){
    main.innerHTML = `<div class="container"><div class="card">Sahifa yuklanmadi: ${e.message}</div></div>`;
  }
}

function bindTests(root){
  // Expect <a data-src="/csv/tests/demo.csv" data-price="5000" data-title="DTM Demo" class="start">Boshlash</a>
  root.querySelectorAll('a.start').forEach(a=>{
    a.addEventListener('click', async (ev)=>{
      ev.preventDefault();
      const src = a.dataset.src;
      const price = Number(a.dataset.price||0);
      const title = a.dataset.title||a.textContent||"Test";
      const perq = Number(a.dataset.perq||120);
      const mod = await import('./tests.js');
      await mod.startTest(root, {src, price, title, perQuestionSec: perq});
    });
  });
}

function bindProfile(root){
  const form = root.querySelector('#profile-form');
  if(!form) return;
  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    if(!auth.currentUser){ await modal({title:"Kirish", body:"Avval kiring."}); return; }
    const ref = doc(db, 'users', auth.currentUser.uid);
    try{
      await updateDoc(ref, {...data, updatedAt: new Date()});
      await modal({title:"Saqlangan", body:"Profil yangilandi."});
      location.hash="#home";
    }catch(e){
      await modal({title:"Xato", body:e.message});
    }
  });
}

renderHeader(null); renderFooter();
window.addEventListener('hashchange', renderRoute);

onAuthStateChanged(auth, async (user)=>{
  renderHeader(user);
  if(user){ await ensureUserDoc(user); await guardProfile(user); }
  renderRoute();
});
