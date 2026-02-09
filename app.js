import { db } from "./firebase.js";
import {
  doc, getDoc, setDoc, serverTimestamp, runTransaction,
  collection, getDocs, query, orderBy, limit
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

// --- Tiny state
const state = {
  route: "home",
  tag: "Barchasi",
  products: [],
  cart: JSON.parse(localStorage.getItem("om_cart") || "[]"),
  fav: JSON.parse(localStorage.getItem("om_fav") || "[]"),
  user: JSON.parse(localStorage.getItem("om_user") || "null"),
  deferredPrompt: null
};

// --- UI helpers
function toast(msg){
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(()=>t.classList.remove("show"), 1800);
}
function money(n){
  try{ return new Intl.NumberFormat("uz-UZ").format(n) + " so'm"; }
  catch{ return n + " so'm"; }
}
function saveLocal(){
  localStorage.setItem("om_cart", JSON.stringify(state.cart));
  localStorage.setItem("om_fav", JSON.stringify(state.fav));
}
function setRoute(r){
  state.route = r;
  $$(".navbtn").forEach(b => b.classList.toggle("active", b.dataset.route === r));
  render();
}
function ensureAuth(){
  if(!state.user){
    location.href = "login.html?next=" + encodeURIComponent(location.pathname.replace(/^\/+/,'') || "index.html");
  }
}

// --- PWA install prompt
window.addEventListener("beforeinstallprompt", (e)=>{
  e.preventDefault();
  state.deferredPrompt = e;
  $("#installBtn").style.display = "inline-flex";
});
$("#installBtn").addEventListener("click", async ()=>{
  if(!state.deferredPrompt) return toast("O‘rnatish hozircha mavjud emas");
  state.deferredPrompt.prompt();
  await state.deferredPrompt.userChoice;
  state.deferredPrompt = null;
  $("#installBtn").style.display = "none";
});

// --- Data: try Firestore products, fallback local sample
async function loadProducts(){
  try{
    const snap = await getDocs(query(collection(db, "products"), orderBy("createdAt","desc"), limit(200)));
    if(!snap.empty){
      state.products = snap.docs.map(d => ({ id:d.id, ...d.data() }));
      return;
    }
  }catch(e){ /* ignore */ }
  // sample
  state.products = [
    { id:"p1", name:"Namuna mahsulot 1", price:129000, tags:["Kiyimlar","Premium"], image:"https://picsum.photos/seed/om1/700/700" },
    { id:"p2", name:"Namuna mahsulot 2", price:99000, tags:["Telefonlar"], image:"https://picsum.photos/seed/om2/700/700" },
    { id:"p3", name:"Namuna mahsulot 3", price:215000, tags:["Aksessuar"], image:"https://picsum.photos/seed/om3/700/700" },
    { id:"p4", name:"Namuna mahsulot 4", price:179000, tags:["Kiyimlar"], image:"https://picsum.photos/seed/om4/700/700" },
  ];
}

// --- Renderers
function renderTopUser(){
  const u = state.user;
  $("#userName").textContent = u?.name ? u.name : (u?.phone || "Mehmon");
  $("#userSub").textContent = u?.numericId ? ("ID: " + u.numericId) : "OrzuMall";
}
function allTags(){
  const set = new Set(["Barchasi"]);
  state.products.forEach(p => (p.tags||[]).forEach(t => set.add(t)));
  return Array.from(set);
}
function filterProducts(){
  const q = ($("#q").value || "").trim().toLowerCase();
  let arr = state.products.slice();
  if(state.tag !== "Barchasi") arr = arr.filter(p => (p.tags||[]).includes(state.tag));
  if(q) arr = arr.filter(p => (p.name||"").toLowerCase().includes(q));
  if(state.route === "fav") arr = arr.filter(p => state.fav.includes(p.id));
  return arr;
}
function productCard(p){
  const isFav = state.fav.includes(p.id);
  const inCart = state.cart.find(x => x.id === p.id);
  return `
  <div class="card" data-open="${p.id}">
    <div class="thumb">
      <img loading="lazy" src="${p.image || ""}" alt="">
    </div>
    <div class="meta">
      <p class="name">${escapeHtml(p.name || "")}</p>
      <div class="priceRow">
        <div>
          <div class="price">${money(Number(p.price||0))}</div>
          <div class="muted">${(p.tags||[]).slice(0,1).join(" • ")}</div>
        </div>
        <div class="actions">
          <button class="smallbtn" data-fav="${p.id}" aria-label="Sevimli">
            <i class="${isFav ? "fas" : "far"} fa-heart"></i>
          </button>
          <button class="smallbtn primary" data-cart="${p.id}" aria-label="Savatga">
            <i class="fas fa-cart-plus"></i>
          </button>
        </div>
      </div>
    </div>
  </div>`;
}
function render(){
  renderTopUser();
  $("#cartCount").textContent = String(state.cart.reduce((a,b)=>a+(b.qty||1),0));
  $("#favCount").textContent = String(state.fav.length);
  $("#cartCount").style.display = state.cart.length ? "grid" : "none";
  $("#favCount").style.display = state.fav.length ? "grid" : "none";

  // route-specific
  const title = {
    home:"Bosh sahifa",
    cat:"Kategoriyalar",
    fav:"Sevimlilar",
    cart:"Savat",
    profile:"Profil"
  }[state.route] || "OrzuMall";

  $("#screenTitle").textContent = title;

  // tags
  const tags = allTags();
  $("#pills").innerHTML = tags.map(t => `
    <div class="pill ${t===state.tag?"active":""}" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</div>
  `).join("");

  // main content
  if(state.route === "cart"){
    $("#content").innerHTML = renderCart();
  }else if(state.route === "profile"){
    $("#content").innerHTML = renderProfile();
  }else{
    const list = filterProducts();
    $("#content").innerHTML = `<div class="grid">${list.map(productCard).join("")}</div>`;
  }
}

function renderCart(){
  if(!state.cart.length){
    return `<div class="container">
      <div class="card" style="padding:16px">
        <b>Savat bo‘sh</b>
        <div class="muted" style="margin-top:6px">Mahsulot qo‘shing, keyin buyurtma berasiz.</div>
      </div>
    </div>`;
  }
  const items = state.cart.map(it => {
    const p = state.products.find(x=>x.id===it.id) || {name:"Mahsulot", price:0};
    return `<div class="card" style="margin:0 16px 12px; padding:12px">
      <div class="row2">
        <div>
          <b style="font-size:14px">${escapeHtml(p.name||"")}</b>
          <div class="muted">${money(Number(p.price||0))}</div>
        </div>
        <div class="inline">
          <button class="iconbtn" data-dec="${it.id}" aria-label="Kamaytir"><i class="fas fa-minus"></i></button>
          <b>${it.qty||1}</b>
          <button class="iconbtn" data-inc="${it.id}" aria-label="Ko‘paytir"><i class="fas fa-plus"></i></button>
        </div>
      </div>
    </div>`;
  }).join("");

  const total = state.cart.reduce((sum,it)=>{
    const p = state.products.find(x=>x.id===it.id);
    return sum + (Number(p?.price||0) * (it.qty||1));
  }, 0);

  return `
    ${items}
    <div class="card" style="margin:0 16px 12px; padding:14px">
      <div class="row2">
        <div>
          <div class="muted">Jami</div>
          <div style="font-weight:900; font-size:18px">${money(total)}</div>
        </div>
        <button class="cta" id="checkoutBtn" style="width:auto; padding:12px 16px">
          <i class="fas fa-bag-shopping" style="margin-right:8px"></i> Buyurtma berish
        </button>
      </div>
    </div>
  `;
}

function renderProfile(){
  const u = state.user || {};
  return `<div class="container">
    <div class="card" style="padding:16px">
      <div class="row2">
        <div>
          <b style="font-size:16px">${escapeHtml(u.name || "Foydalanuvchi")}</b>
          <div class="muted">${escapeHtml(u.phone || "")}</div>
          <div class="muted">${u.numericId ? "ID: "+u.numericId : ""}</div>
        </div>
        <button class="iconbtn" id="logoutBtn" title="Chiqish"><i class="fas fa-right-from-bracket"></i></button>
      </div>
      <div style="margin-top:10px" class="muted">Bu demo profil. Keyin edit funksiyasini ham qo‘shamiz.</div>
    </div>
  </div>`;
}

// --- Product sheet (details)
function openProduct(id){
  const p = state.products.find(x=>x.id===id);
  if(!p) return;
  $("#sheetTitle").textContent = p.name || "Mahsulot";
  $("#sheetBody").innerHTML = `
    <div class="thumb" style="border-radius:18px; overflow:hidden; border:1px solid var(--border)">
      <img src="${p.image||""}" alt="">
    </div>
    <div style="margin-top:12px">
      <div style="font-weight:900; font-size:18px">${money(Number(p.price||0))}</div>
      <div class="muted" style="margin-top:6px">${(p.tags||[]).join(" • ")}</div>
    </div>
    <div style="margin-top:12px" class="row2">
      <button class="cta" data-cart="${p.id}"><i class="fas fa-cart-plus" style="margin-right:8px"></i> Savatga qo‘shish</button>
      <button class="iconbtn primary" data-fav="${p.id}" title="Sevimli">
        <i class="${state.fav.includes(p.id) ? "fas" : "far"} fa-heart"></i>
      </button>
    </div>
  `;
  showSheet(true);
}
function showSheet(on){
  $("#sheet").classList.toggle("show", !!on);
}

// --- Events
document.addEventListener("click", (e)=>{
  const t = e.target.closest("[data-route],[data-tag],[data-cart],[data-fav],[data-open],[data-inc],[data-dec]");
  if(!t) return;

  if(t.dataset.route){
    setRoute(t.dataset.route);
    return;
  }
  if(t.dataset.tag){
    state.tag = t.dataset.tag;
    render();
    return;
  }
  if(t.dataset.open){
    openProduct(t.dataset.open);
    return;
  }
  if(t.dataset.fav){
    const id = t.dataset.fav;
    if(state.fav.includes(id)) state.fav = state.fav.filter(x=>x!==id);
    else state.fav.push(id);
    saveLocal();
    render();
    return;
  }
  if(t.dataset.cart){
    const id = t.dataset.cart;
    const item = state.cart.find(x=>x.id===id);
    if(item) item.qty = (item.qty||1)+1;
    else state.cart.push({id, qty:1});
    saveLocal();
    toast("Savatga qo‘shildi");
    render();
    return;
  }
  if(t.dataset.inc){
    const id = t.dataset.inc;
    const item = state.cart.find(x=>x.id===id);
    if(item){ item.qty=(item.qty||1)+1; saveLocal(); render(); }
    return;
  }
  if(t.dataset.dec){
    const id = t.dataset.dec;
    const item = state.cart.find(x=>x.id===id);
    if(item){
      item.qty=(item.qty||1)-1;
      if(item.qty<=0) state.cart = state.cart.filter(x=>x.id!==id);
      saveLocal(); render();
    }
    return;
  }
});

$("#sheetClose").addEventListener("click", ()=>showSheet(false));
$("#sheet").addEventListener("click", (e)=>{
  if(e.target.classList.contains("backdrop")) showSheet(false);
});

$("#q").addEventListener("input", ()=>{
  if(state.route === "cart" || state.route === "profile") return;
  render();
});

document.addEventListener("click", (e)=>{
  if(e.target?.id === "logoutBtn"){
    localStorage.removeItem("om_user");
    state.user=null;
    location.href = "login.html";
  }
  if(e.target?.id === "checkoutBtn"){
    toast("Checkout: keyingi bosqichda manzil/to‘lov qo‘shiladi");
    // Placeholder: open sheet for future checkout
  }
});

// --- Utils
function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
}

// Init
ensureAuth();
await loadProducts();
render();
