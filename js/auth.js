import { Router } from "./router.js";
import { REGIONS, DISTRICTS } from "./regions.js";
import { initUI } from "./ui.js";

// Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword,
         GoogleAuthProvider, signInWithPopup, RecaptchaVerifier,
         signInWithPhoneNumber, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, runTransaction } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDYwHJou_9GqHZcf8XxtTByC51Z8un8rrM",
  authDomain: "xplusy-760fa.firebaseapp.com",
  projectId: "xplusy-760fa",
  storageBucket: "xplusy-760fa.appspot.com",
  messagingSenderId: "992512966017",
  appId: "1:992512966017:web:5e919dbc9b8d8abcb43c80",
  measurementId: "G-459PLJ7P7L"
};

const appFB = initializeApp(firebaseConfig);
const auth = getAuth(appFB);
const db = getFirestore(appFB);

// Global app singleton
window.App = {
  user: null,
  profile: null,
  router: null,
  async start(){
    initUI();
    this.router = new Router("#app");
    await this.router.render();
    setupAuthUI();
    onAuthStateChanged(auth, async (u)=>{
      this.user = u;
      await refreshHeader();
      if(u){
        const p = await loadProfile(u.uid);
        // If profile missing -> force modal
        if(!p){
          openProfileModal(true);
        }
      }else{
        openLoginModal();
      }
    });
  },
  async renderProfileView(){
    const container = document.getElementById("profile-view");
    const p = window.App.profile;
    if(!container) return;
    if(!p){
      container.innerHTML = `<p>Profil ma'lumoti topilmadi.</p>`;
      return;
    }
    
    const labels = {
      firstName:"Ism",
      lastName:"Familiya",
      patronymic:"Sharif",
      birthDate:"Tugʻilgan sana",
      phone:"Telefon",
      telegram:"Telegram",
      email:"Email",
      role:"Rol",
      region:"Viloyat",
      district:"Tuman/Shahar",
      school:"Maktab"
    };
    const show = Object.keys(labels).filter(k => p[k] && String(p[k]).trim() !== "");
    container.innerHTML = `
      <div class="grid two">
        ${show.map(k=>`<div class="mini-card"><span style="min-width:140px;"><b>${labels[k]}</b></span><span>${p[k]}</span></div>`).join("")}
      </div>
      <p style="color:#ef4444;margin-top:12px">Eslatma: Profil ma'lumotlari tahrirlanmaydi.</p>
    `;
    
  }
};

// ---------- UI helpers ----------
function $(sel, root=document){ return root.querySelector(sel); }
function $all(sel, root=document){ return Array.from(root.querySelectorAll(sel)); }

async function refreshHeader(){
  const helloName = document.getElementById("hello-name");
  const helloAge = document.getElementById("hello-age");
  const mini = document.getElementById("header-mini");
  const u = auth.currentUser;

  if(!u){
    helloName.textContent = "Mehmon";
    helloAge.textContent = "— yosh";
    mini.innerHTML = "";
    return;
  }
  const p = await loadProfile(u.uid);
  const age = p?.birthDate ? calcAge(p.birthDate) : "—";
  helloName.textContent = `${p?.firstName ?? "Foydalanuvchi"}`;
  helloAge.textContent = `${age} yosh`;

  mini.innerHTML = `
    <span class="mini-chip">🆔 <b>${p?.numericId ?? "—"}</b></span>
    <span class="mini-chip">💰 <b>${p?.balance ?? 0}</b></span>
    <span class="mini-chip">🏅 <b>${p?.score ?? 0}</b></span>
  `;
}

function calcAge(iso){
  try{
    const d = new Date(iso);
    const now = new Date();
    let a = now.getFullYear() - d.getFullYear();
    const m = now.getMonth() - d.getMonth();
    if(m<0 || (m===0 && now.getDate()<d.getDate())) a--;
    return a;
  }catch(e){ return "—" }
}

// ---------- Auth Modals ----------
function setupAuthUI(){
  // Login modal triggers
  $("#btn-login").addEventListener("click", openLoginModal);
  $("#btn-profile").addEventListener("click", ()=>location.hash="#/profile");
  $("#btn-home").addEventListener("click", ()=>location.hash="#/home");
  $("#nav-tests").addEventListener("click", ()=>location.hash="#/tests");
  $("#nav-live").addEventListener("click", ()=>location.hash="#/live");
  $("#nav-about").addEventListener("click", ()=>location.hash="#/about");
}

function openLoginModal(){
  const modal = $("#modal-login");
  modal.classList.add("open");

  // ID+Parol login (ID -> users collection numericId field)
  $("#login-id-form").onsubmit = async (e)=>{
    e.preventDefault();
    const id = $("#login-id").value.trim();
    const pass = $("#login-pass").value;
    try{
      // we assume email is uid@mathcenter.uz if logged by ID
      const email = `${id}@id.mathcenter.uz`;
      await signInWithEmailAndPassword(auth, email, pass);
      modal.classList.remove("open");
    }catch(err){
      $("#login-id-error").textContent = err.message;
    }
  };

  // Email+Password register
  $("#reg-email-form").onsubmit = async (e)=>{
    e.preventDefault();
    const email = $("#reg-email").value.trim();
    const pass = $("#reg-pass").value;
    try{
      await createUserWithEmailAndPassword(auth, email, pass);
      modal.classList.remove("open");
      openProfileModal(true);
    }catch(err){
      $("#reg-email-error").textContent = err.message;
    }
  };

  // Google sign-in
  $("#btn-google").onclick = async ()=>{
    try{
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      modal.classList.remove("open");
      openProfileModal(true);
    }catch(err){
      $("#reg-email-error").textContent = err.message;
    }
  };

  // Phone sign-in
  window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', { size: 'invisible' });
  $("#phone-send").onclick = async ()=>{
    const phone = $("#reg-phone").value.trim();
    try{
      const confirmation = await signInWithPhoneNumber(auth, phone, window.recaptchaVerifier);
      const code = prompt("SMS kodni kiriting:");
      if(code) await confirmation.confirm(code);
      modal.classList.remove("open");
      openProfileModal(true);
    }catch(err){
      $("#reg-phone-error").textContent = err.message;
    }
  };

  // Close
  $("#modal-login-close").onclick = ()=> modal.classList.remove("open");
}

function openProfileModal(force=false){
  const modal = $("#modal-profile");
  const form = $("#profile-form");
  const closeBtn = $("#modal-profile-close");
  // Fill selects
  const regionSel = $("#region");
  regionSel.innerHTML = `<option value="" disabled selected>Viloyatni tanlang</option>` + 
    REGIONS.map(r=>`<option value="${r}">${r}</option>`).join("");

  const districtWrap = $("#district-wrap");
  const districtSel = $("#district-select");
  const districtInput = $("#district-input");

  regionSel.onchange = ()=>{
    const r = regionSel.value;
    const list = DISTRICTS[r];
    if(list && list.length){
      districtSel.innerHTML = list.map(d=>`<option value="${d}">${d}</option>`).join("");
      districtSel.parentElement.style.display = "block";
      districtInput.parentElement.style.display = "none";
    }else{
      districtSel.parentElement.style.display = "none";
      districtInput.parentElement.style.display = "block";
      districtInput.value = "";
    }
  };

  // Lock close if force
  closeBtn.style.display = force ? "none" : "inline-flex";

  // If profile exists, show read-only and prevent submit
  const u = auth.currentUser;
  if(!u){ return; }
  loadProfile(u.uid).then(p=>{
    if(p){
      form.innerHTML = `<p style="color:#16a34a;font-weight:700">Profil allaqachon saqlangan. Tahrirlash mumkin emas.</p>`;
    }
  });

  modal.classList.add("open");

  form.onsubmit = async (e)=>{
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    // Compose normalized object
    const profile = {
      firstName: data.firstName?.trim(),
      lastName: data.lastName?.trim(),
      patronymic: data.patronymic?.trim(),
      birthDate: data.birthDate,
      phone: data.phone?.trim(),
      telegram: data.telegram?.trim(),
      email: auth.currentUser?.email ?? data.email?.trim() ?? null,
      role: data.role,
      region: data.region,
      district: DISTRICTS[data.region]?.length ? data.districtSelect : (data.districtInput?.trim() || null),
      school: data.school?.trim(),
      balance: 0,
      score: 0,
      numericId: await ensureNumericId()
    };
    try{
      await setDoc(doc(db,"users", auth.currentUser.uid), profile, { merge: true });
      window.App.profile = profile;
      await refreshHeader();
      modal.classList.remove("open");
      location.hash = "#/profile";
      App.router.render();
    }catch(err){
      alert("Saqlashda xatolik: "+ err.message);
    }
  }
}

// Load profile helper
async function loadProfile(uid){
  const snap = await getDoc(doc(db,"users", uid));
  if(snap.exists()){
    window.App.profile = snap.data();
    return snap.data();
  }
  return null;
}

// Ensure numericId with transaction (collection: meta/counters -> users.lastId)
async function ensureNumericId(){
  const ref = doc(db, "meta", "counters");
  const id = await runTransaction(db, async (tx)=>{
    const snap = await tx.get(ref);
    let last = 1000;
    if(snap.exists()){
      last = snap.data().users_lastId ?? 1000;
    }
    const next = last + 1;
    tx.set(ref, { users_lastId: next }, { merge:true });
    return next;
  });
  return id;
}

window.addEventListener("DOMContentLoaded", ()=> window.App.start());
