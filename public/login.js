import { auth, db } from "./firebase-config.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

let allowAutoRedirect = true;

const els = {
  tabLogin: document.getElementById("tabLogin"),
  tabSignup: document.getElementById("tabSignup"),
  loginForm: document.getElementById("loginForm"),
  signupForm: document.getElementById("signupForm"),

  loginPhone: document.getElementById("loginPhone"),
  loginPass: document.getElementById("loginPass"),
  toggleLoginPass: document.getElementById("toggleLoginPass"),

  // signup profile fields
  signupFirstName: document.getElementById("signupFirstName"),
  signupLastName: document.getElementById("signupLastName"),
  signupPhone: document.getElementById("signupPhone"),
  signupRegion: document.getElementById("signupRegion"),
  signupDistrict: document.getElementById("signupDistrict"),
  signupPost: document.getElementById("signupPost"),
  signupPass: document.getElementById("signupPass"),
  signupPass2: document.getElementById("signupPass2"),
  toggleSignupPass: document.getElementById("toggleSignupPass"),

  notice: document.getElementById("notice"),
  forgotLink: document.getElementById("forgotLink"),
};

function showNotice(msg, kind="ok"){
  if(!els.notice) return;
  els.notice.className = "notice " + (kind==="err" ? "err" : "ok");
  els.notice.textContent = msg;
  els.notice.style.display = "";
  const ms = kind === "err" ? 6500 : 3500;
  clearTimeout(showNotice._t);
  showNotice._t = setTimeout(()=>{ els.notice.style.display="none"; }, ms);
}

// Uzbekistan phone helpers (+998XXXXXXXXX)
function normPhone(raw){
  // returns phone in +998XXXXXXXXX format if possible
  let digits = String(raw||"").replace(/\D/g,"");
  // strip country if user typed it
  if(digits.startsWith("998")) digits = digits.slice(3);
  // keep only 9 digits (operator+number)
  digits = digits.slice(0, 9);
  return "+998" + digits;
}
function isValidUzPhone(phone){
  return /^\+998\d{9}$/.test(String(phone||""));
}
function attachUzPhoneMask(input){
  if(!input) return;
  // default
  if(!input.value) input.value = "+998";

  input.addEventListener("focus", ()=>{
    if(!input.value) input.value = "+998";
    if(!String(input.value).startsWith("+998")) input.value = normPhone(input.value);
  });

  input.addEventListener("input", ()=>{
    const v = normPhone(input.value);
    input.value = v;
  });

  input.addEventListener("keydown", (e)=>{
    // prevent deleting the +998 prefix
    const start = input.selectionStart ?? 0;
    const end = input.selectionEnd ?? 0;
    if((e.key === "Backspace" || e.key === "Delete") && start <= 4 && end <= 4){
      e.preventDefault();
      input.setSelectionRange(4,4);
    }
  });
}
function phoneToEmail(phone){
  const digits = String(phone||"").replace(/[^0-9]/g,"");
  return `p${digits}@orzumall.phone`;
}


// Stable numericId derived from UID (no meta/counters, no extra collections)
function uidToNumericId(uid){
  const hex = (uid || "").replace(/[^0-9a-f]/gi, "").padEnd(10, "0").slice(0, 10);
  let n = 0;
  try{ n = parseInt(hex, 16); }catch(_e){ n = Date.now(); }
  return (n % 900000) + 100000; // 6 digits
}

async function ensureUserDoc(uid, payload){
  const userRef = doc(db, "users", uid);
  const snap = await getDoc(userRef).catch(()=>null);
  const u = snap && snap.exists() ? (snap.data()||{}) : {};

  const numericId = (u.numericId != null && /^\d+$/.test(String(u.numericId))) ? Number(u.numericId) : uidToNumericId(uid);
  const firstName = (payload.firstName || u.firstName || "").trim();
  const lastName = (payload.lastName || u.lastName || "").trim();
  const fullName = (payload.name || u.name || (firstName + " " + lastName).trim() || "User").trim();

  const phone = (payload?.phone || u.phone || "").toString();
  const region = (payload?.region || u.region || "").toString();
  const district = (payload?.district || u.district || "").toString();
  const post = (payload?.post || u.post || "").toString();

  const completed = !!(firstName && lastName && phone && region && district && post);

  const data = {
    numericId,
    phone,
    firstName,
    lastName,
    name: fullName,
    region,
    district,
    post,
    // IMPORTANT: only mark completed when all required fields exist
    profileCompleted: completed,
    updatedAt: serverTimestamp(),
    ...((snap && snap.exists()) ? {} : { createdAt: serverTimestamp(), balanceUZS: 0 }),
  };

  await setDoc(userRef, data, { merge: true });
  return { numericId, name: data.name, phone: data.phone };
}

// Region -> District -> Post loader (signup)
let __regionData = null;
async function loadRegionData(){
  try{
    const res = await fetch("./region.json?v=1", { cache: "no-store" });
    if(!res.ok) throw new Error("region.json fetch failed");
    return await res.json();
  }catch(_e){
    return { regions: [] };
  }
}
function setSelectOptions(sel, items, placeholder){
  if(!sel) return;
  sel.innerHTML = "";
  const ph = document.createElement("option");
  ph.value = "";
  ph.textContent = placeholder;
  sel.appendChild(ph);
  for(const it of (items||[])){
    const opt = document.createElement("option");
    opt.value = it;
    opt.textContent = it;
    sel.appendChild(opt);
  }
}
async function ensureRegionLoaded(){
  if(__regionData) return __regionData;
  __regionData = await loadRegionData();
  const regions = (__regionData.regions || []).map(r=>r.name);
  setSelectOptions(els.signupRegion, regions, "Viloyatni tanlang");
  setSelectOptions(els.signupDistrict, [], "Tumanni tanlang");
  setSelectOptions(els.signupPost, [], "Pochta indeks");
  return __regionData;
}
function populateDistricts(regionName){
  const region = (__regionData?.regions || []).find(r=>r.name===regionName);
  const districts = region ? region.districts.map(d=>d.name) : [];
  setSelectOptions(els.signupDistrict, districts, "Tumanni tanlang");
  setSelectOptions(els.signupPost, [], "Pochta indeks");
}
function populatePosts(regionName, districtName){
  const region = (__regionData?.regions || []).find(r=>r.name===regionName);
  const district = region ? region.districts.find(d=>d.name===districtName) : null;
  const posts = district ? (district.posts || []) : [];
  setSelectOptions(els.signupPost, posts, "Pochta indeks");
}


// Tabs
function setMode(mode){
  const isLogin = mode==="login";
  els.tabLogin.classList.toggle("active", isLogin);
  els.tabSignup.classList.toggle("active", !isLogin);
  els.loginForm.style.display = isLogin ? "" : "none";
  els.signupForm.style.display = isLogin ? "none" : "";

  // prepare region selects when signup is shown
  if(!isLogin){
    ensureRegionLoaded().then(()=>{
      // try preserve selections
      const r = els.signupRegion?.value || "";
      if(r) populateDistricts(r);
      const d = els.signupDistrict?.value || "";
      if(r && d) populatePosts(r, d);
    });
  }
}
els.tabLogin.addEventListener("click", ()=>setMode("login"));
els.tabSignup.addEventListener("click", ()=>setMode("signup"));
setMode("login");

// region chained selects
els.signupRegion?.addEventListener("change", ()=>{
  populateDistricts(els.signupRegion.value);
});
els.signupDistrict?.addEventListener("change", ()=>{
  populatePosts(els.signupRegion.value, els.signupDistrict.value);
});

// Phone auto +998 formatting
attachUzPhoneMask(els.loginPhone);
attachUzPhoneMask(els.signupPhone);

// Phone auto-format (+998)
attachUzPhoneMask(els.loginPhone);
attachUzPhoneMask(els.signupPhone);

// Password toggles
els.toggleLoginPass.addEventListener("click", ()=>{
  const show = els.loginPass.type === "password";
  els.loginPass.type = show ? "text" : "password";
  els.toggleLoginPass.querySelector("i").className = show ? "fa-solid fa-eye-slash" : "fa-solid fa-eye";
});
els.toggleSignupPass.addEventListener("click", ()=>{
  const show = els.signupPass.type === "password";
  els.signupPass.type = show ? "text" : "password";
  els.toggleSignupPass.querySelector("i").className = show ? "fa-solid fa-eye-slash" : "fa-solid fa-eye";
});



// Forgot password -> Telegram bot
if(els.forgotLink){
  els.forgotLink.addEventListener("click", (e)=>{
    e.preventDefault();
    showNotice("Parolni tiklash uchun @OrzuMallUZ_bot ga yozing", "ok");
    setTimeout(()=> window.open("https://t.me/OrzuMallUZ_bot", "_blank"), 180);
  });
}

// If already logged in, go to profile
onAuthStateChanged(auth, (user)=>{
  if(user && allowAutoRedirect) {
    const next = new URLSearchParams(location.search).get("next") || "index.html#profile";
    location.replace(next);
  }
});

// Login
els.loginForm.addEventListener("submit", async (e)=>{
  e.preventDefault();
  allowAutoRedirect = false;
  const phone = normPhone(els.loginPhone.value);
  const pass = els.loginPass.value || "";
  if(!isValidUzPhone(phone)) return showNotice("Telefon raqam noto‘g‘ri. Masalan: +998901234567", "err");
  if(pass.length < 6) return showNotice("Parol kamida 6 ta belgidan iborat bo‘lsin", "err");

  try{
    const email = phoneToEmail(phone);
    const cred = await signInWithEmailAndPassword(auth, email, pass);

    // ensure numericId exists + keep name if already known
    const uid = cred.user.uid;
    await ensureUserDoc(uid, { phone });

    const next = new URLSearchParams(location.search).get("next") || "index.html#profile";
    location.replace(next);
  }catch(err){
    console.error(err);
    const code = String(err?.code || "");
    if(code.includes("user-not-found")){
      showNotice("Bu telefon raqam ro'yxatdan o'tmagan", "err");
    }else if(code.includes("wrong-password") || code.includes("invalid-credential") || code.includes("invalid-login-credentials")){
      showNotice("Login yoki parol xato", "err");
    }else if(code.includes("too-many-requests")){
      showNotice("Juda ko‘p urinish. Birozdan keyin qayta urinib ko‘ring.", "err");
    }else{
      // fallback
      showNotice("Kirishda xatolik yuz berdi. Qayta urinib ko‘ring.", "err");
    }
  }
});

// Signup
els.signupForm.addEventListener("submit", async (e)=>{
  e.preventDefault();
  allowAutoRedirect = false;
  const firstName = (els.signupFirstName?.value || "").trim();
  const lastName = (els.signupLastName?.value || "").trim();
  const phone = normPhone(els.signupPhone.value);
  const region = (els.signupRegion?.value || "").trim();
  const district = (els.signupDistrict?.value || "").trim();
  const post = (els.signupPost?.value || "").trim();
  const pass = els.signupPass.value || "";
  const pass2 = els.signupPass2.value || "";

  if(!firstName) return showNotice("Ismni kiriting", "err");
  if(!lastName) return showNotice("Familiyani kiriting", "err");
  if(!isValidUzPhone(phone)) return showNotice("Telefon raqam noto‘g‘ri. Masalan: +998901234567", "err");
  if(!region) return showNotice("Viloyatni tanlang", "err");
  if(!district) return showNotice("Tumanni tanlang", "err");
  if(!post) return showNotice("Pochta indeksini tanlang", "err");
  if(pass.length < 6) return showNotice("Parol kamida 6 ta belgidan iborat bo‘lsin", "err");
  if(pass !== pass2) return showNotice("Parollar mos emas", "err");

  try{
    const email = phoneToEmail(phone);
    const cred = await createUserWithEmailAndPassword(auth, email, pass);

    const uid = cred.user.uid;
    const { numericId } = await ensureUserDoc(uid, {
      phone,
      firstName,
      lastName,
      name: (firstName + " " + lastName).trim(),
      region,
      district,
      post,
    });

    showNotice(`Tayyor! Sizning ID: ${numericId}`, "ok");

    const next = new URLSearchParams(location.search).get("next") || "index.html#profile";
    setTimeout(()=> location.replace(next), 350);
  }catch(err){
    console.error(err);
    // common: email already in use
    if(String(err?.code||"").includes("email-already-in-use")){
      showNotice("Bu raqam allaqachon ro‘yxatdan o‘tgan. Kirish bo‘limidan parol bilan kiring.", "err");
      // auto switch to login tab
      try{
        els.tabLogin?.click();
        if(els.loginPhone) els.loginPhone.value = phone;
        els.loginPass?.focus();
      }catch(_){}
    }else{
      if(String(err?.code||"").includes("weak-password")){
      showNotice("Parol juda oddiy. Kamida 6 ta belgi bo‘lsin.", "err");
    }else if(String(err?.code||"").includes("invalid-email")){
      showNotice("Telefon raqam formati noto‘g‘ri.", "err");
    }else{
      showNotice("Ro‘yxatdan o‘tishda xatolik", "err");
    }
    }
  }
});
