/* OrzuMall Static + Firebase — Next Stage (Phone+Password via Email/Password) */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import {
  getFirestore, collection, getDocs, query, orderBy, limit,
  doc, setDoc, deleteDoc, getDoc, onSnapshot, serverTimestamp, runTransaction,
  addDoc, updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
import {
  getAuth, onAuthStateChanged, signOut,
  signInWithEmailAndPassword, createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";

const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

/* ===== Config ===== */
const ADMIN_EMAILS = ["sohibjonmath@gmail.com"]; // add more if needed
const PHONE_DOMAIN = "orzumall.uz"; // internal email domain for phone-login

function fmt(n){
  if (n == null || isNaN(n)) return "";
  const s = Math.round(Number(n)).toString();
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}
function escapeHtml(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}
function toast(msg){
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast._tm);
  toast._tm = setTimeout(()=>t.classList.remove("show"), 1700);
}
function safeConfig(){
  const cfg = window.__FIREBASE_CONFIG__;
  if(!cfg || !cfg.apiKey) return null;
  return cfg;
}

/* ===== Phone normalization ===== */
function normalizePhone(input){
  let s = String(input||"").trim();
  // keep digits only
  const digits = s.replace(/\D/g,"");
  // Uzbekistan numbers usually 12 digits with 998
  if (digits.startsWith("998")) return "+" + digits;
  // if user typed 9 digits (like 901234567) or 10 digits (90...)
  if (digits.length === 9) return "+998" + digits;
  if (digits.length === 10 && digits.startsWith("0")) return "+998" + digits.slice(1);
  if (digits.length === 9) return "+998" + digits;
  if (digits.length === 12) return "+" + digits;
  // fallback: if starts with 9 and len 9/10 etc
  if (digits.length >= 9 && digits.length <= 12){
    if (!digits.startsWith("998")) return "+998" + digits.slice(-9);
    return "+" + digits;
  }
  return s.startsWith("+") ? s : ("+998" + digits);
}
function phoneToEmail(phone){
  // "+998901234567" -> "998901234567@orzumall.uz"
  const digits = phone.replace(/\D/g,"");
  return `${digits}@${PHONE_DOMAIN}`;
}

/* ===== Data helpers ===== */
function pickImage(p){
  if (p.image) return p.image;
  if (Array.isArray(p.images) && p.images.length) return p.images[0];
  if (p.imagesByColor && typeof p.imagesByColor === "object"){
    const colors = Object.keys(p.imagesByColor);
    for (const c of colors){
      const v = p.imagesByColor[c];
      if (Array.isArray(v) && v.length) return v[0];
      if (typeof v === "string") return v;
    }
  }
  return null;
}
function calcDiscount(p){
  if (p.discountPercent != null) return Number(p.discountPercent);
  if (p.oldPrice && p.price) {
    const d = (1 - (Number(p.price)/Number(p.oldPrice))) * 100;
    if (isFinite(d) && d > 0) return Math.round(d);
  }
  return 0;
}
function ratingStars(r){
  const x = Math.max(0, Math.min(5, Number(r||0)));
  const full = Math.floor(x);
  const half = (x - full) >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  return (
    "<i class='fas fa-star'></i>".repeat(full) +
    (half ? "<i class='fas fa-star-half-alt'></i>" : "") +
    "<i class='far fa-star'></i>".repeat(empty)
  );
}
function getCatPair(p){
  const tags = Array.isArray(p.tags) ? p.tags.map(String) : [];
  const parent = (p.category ? String(p.category) : (tags[0] || "Boshqa"));
  const child = (tags[1] || "");
  return { parent, child };
}

/* ===== Firebase ===== */
let app, db, auth;
let user = null;
let products = [];
let currentFilter = { parent:"all", child:"" };
let searchText = "";
const state = { favorites: new Set() };

function setActivePage(page){
  $$(".page").forEach(p=>p.classList.remove("active"));
  $(`#page-${page}`).classList.add("active");
  $$(".nav-item").forEach(n=>n.classList.toggle("active", n.dataset.page===page));
}

async function initFirebase(){
  const cfg = safeConfig();
  if(!cfg){
    $("#fbWarn").style.display = "block";
    $("#fbWarn").textContent = "Firebase config topilmadi (assets/firebase-config.js).";
    return false;
  }
  app = initializeApp(cfg);
  db = getFirestore(app);
  auth = getAuth(app);
  return true;
}

/* ===== OM ID ===== */
function omFromNumeric(n){
  const s = String(n).padStart(6,"0");
  return `OM${s}`;
}
async function ensureUserDoc(){
  const uid = user?.uid;
  if(!uid) return;
  const uref = doc(db, "users", uid);
  const cur = await getDoc(uref);
  if(cur.exists()){
    renderProfile(cur.data()||{});
    return;
  }
  const cref = doc(db, "meta", "counters");
  try{
    const numericId = await runTransaction(db, async (tx)=>{
      const csnap = await tx.get(cref);
      const prev = csnap.exists() ? Number(csnap.data().userCounter||0) : 0;
      const next = prev + 1;
      tx.set(cref, { userCounter: next }, { merge:true });
      tx.set(uref, {
        numericId: next,
        omId: omFromNumeric(next),
        createdAt: serverTimestamp(),
        phone: user.phoneNumber || null
      }, { merge:true });
      return next;
    });
    renderProfile({ numericId, omId: omFromNumeric(numericId), phone: user.phoneNumber||"" });
  }catch(e){
    console.error(e);
    await setDoc(uref, { createdAt: serverTimestamp() }, { merge:true });
    renderProfile({ omId:"OM??????" });
  }
}

function renderProfile(d){
  $("#profUid").textContent = user ? user.uid.slice(0,8) + "…" : "-";
  $("#profOm").textContent = d.omId || (d.numericId ? omFromNumeric(d.numericId) : "OM??????");
  $("#profName").textContent = d.name || "Mijoz";
}

/* ===== Products ===== */
async function loadProducts(){
  const q = query(collection(db,"products"), orderBy("createdAt","desc"), limit(80));
  let snap;
  try{ snap = await getDocs(q); }
  catch(e){ snap = await getDocs(collection(db,"products")); }
  products = snap.docs.map(d=>({ id:d.id, ...d.data() }));
  renderHome();
  renderCategoriesPage();
  renderFavoritesPage();
}

function filteredProducts(){
  return products.filter(p=>{
    const t = (p.title||"").toLowerCase();
    const okSearch = !searchText || t.includes(searchText);
    const { parent, child } = getCatPair(p);
    const okParent = (currentFilter.parent==="all") || (parent===currentFilter.parent);
    const okChild  = (!currentFilter.child) || (child===currentFilter.child);
    return okSearch && okParent && okChild;
  });
}

function productCard(p){
  const img = pickImage(p);
  const d = calcDiscount(p);
  const r = Number(p.rating||0);
  const rc = Number(p.reviewsCount||0);
  const ins = p.installmentText ? `<div style="margin-top:6px;color:var(--muted);font-size:11px"><i class="fas fa-coins"></i> ${escapeHtml(p.installmentText)}</div>` : "";
  const favOn = state.favorites.has(p.id);

  return `
  <div class="card" data-id="${p.id}">
    <div class="img">
      ${img ? `<img src="${img}" alt="${escapeHtml(p.title||"Mahsulot")}">` : `<div class="ph"><i class="fas fa-image"></i></div>`}
      ${d>0 ? `<div class="discount">-${d}%</div>` : ``}
    </div>
    <div class="info">
      <div class="title" title="${escapeHtml(p.title||"")}">${escapeHtml(p.title||"Nomsiz mahsulot")}</div>
      <div class="price">
        <div class="cur">${fmt(p.price)} so‘m</div>
        ${p.oldPrice ? `<div class="old">${fmt(p.oldPrice)} so‘m</div>` : ``}
      </div>
      <div class="rating">
        <span>${ratingStars(r)}</span>
        <span class="meta">${rc ? `(${rc})` : ""}</span>
      </div>
      ${ins}
      <div class="actions">
        <button class="btn dark js-fav" title="Saralangan">
          <i class="fas fa-heart"></i>
        </button>
        <button class="btn gold js-cart">
          <i class="fas fa-cart-plus"></i> Savatga
        </button>
      </div>
    </div>
  </div>`;
}

function hydrateCardButtons(root){
  $$(".card", root).forEach(card=>{
    const id = card.dataset.id;
    const favBtn = $(".js-fav", card);
    const cartBtn = $(".js-cart", card);
    const favOn = state.favorites.has(id);

    favBtn.style.opacity = favOn ? "1" : ".65";
    favBtn.style.borderColor = favOn ? "rgba(212,175,55,.40)" : "rgba(34,41,58,.9)";
    favBtn.style.background = favOn ? "rgba(212,175,55,.10)" : "rgba(255,255,255,.04)";
    favBtn.querySelector("i").style.color = favOn ? "var(--gold2)" : "var(--text)";

    cartBtn.onclick = ()=> addToCart(id, 1);
    favBtn.onclick = ()=> toggleFavorite(id);
  });
}

function renderHome(){
  const list = filteredProducts();
  const grid = $("#grid-home");
  if(!list.length){
    grid.innerHTML = `<div class="empty">Mahsulot topilmadi</div>`;
    return;
  }
  grid.innerHTML = list.slice(0, 60).map(productCard).join("");
  hydrateCardButtons(grid);
}

function renderCategoriesPage(){
  const box = $("#catList");
  const tree = new Map();
  for (const p of products){
    const { parent, child } = getCatPair(p);
    if(!tree.has(parent)) tree.set(parent, new Set());
    if(child) tree.get(parent).add(child);
  }
  if(!tree.size){ box.innerHTML = `<div class="empty">Kategoriya yo‘q</div>`; return; }

  const cards = [];
  for (const [parent, children] of tree.entries()){
    const kids = Array.from(children);
    cards.push(`
      <div class="card" style="margin:0 16px 12px; padding:12px;">
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <div style="font-weight:900"><i class="fas fa-tags" style="color:var(--gold2)"></i> ${escapeHtml(parent)}</div>
          <button class="btn gold" style="flex:0; padding:8px 12px;" data-parent="${escapeHtml(parent)}" data-child="">
            Ko‘rish <i class="fas fa-arrow-right"></i>
          </button>
        </div>
        ${kids.length ? `<div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:8px;">
          ${kids.map(ch=>`<button class="cat-chip" data-parent="${escapeHtml(parent)}" data-child="${escapeHtml(ch)}" style="margin:0;">${escapeHtml(ch)}</button>`).join("")}
        </div>` : `<div class="muted" style="margin-top:8px;font-size:12px;">Subkategoriya yo‘q</div>`}
      </div>
    `);
  }
  box.innerHTML = cards.join("");
  box.onclick = (e)=>{
    const btn = e.target.closest("[data-parent]");
    if(!btn) return;
    currentFilter.parent = btn.dataset.parent;
    currentFilter.child = btn.dataset.child || "";
    $("#q").value = ""; searchText="";
    setActivePage("home");
    renderHome();
    toast("Filtr qo‘yildi");
  };
}

function renderFavoritesPage(){
  const grid = $("#grid-fav");
  const list = products.filter(p=>state.favorites.has(p.id));
  if(!list.length){
    grid.innerHTML = `<div class="empty">Saralanganlar bo‘sh</div>`;
    return;
  }
  grid.innerHTML = list.map(productCard).join("");
  hydrateCardButtons(grid);
}

/* ===== Cart/Favorites ===== */
async function addToCart(productId, inc){
  if(!user){ toast("Avval kiring"); setActivePage("auth"); return; }
  const uid = user.uid;
  const ref = doc(db, "users", uid, "cart", productId);
  const cur = await getDoc(ref);
  const qty = (cur.exists() ? (cur.data().qty||1) : 0) + inc;
  await setDoc(ref, { qty, addedAt: serverTimestamp() }, { merge:true });
  toast("Savatga qo‘shildi");
}

async function toggleFavorite(productId){
  if(!user){ toast("Avval kiring"); setActivePage("auth"); return; }
  const uid = user.uid;
  const ref = doc(db, "users", uid, "favorites", productId);
  const cur = await getDoc(ref);
  if(cur.exists()){
    await deleteDoc(ref);
    state.favorites.delete(productId);
    toast("Saralangandan olib tashlandi");
  }else{
    await setDoc(ref, { addedAt: serverTimestamp() }, { merge:true });
    state.favorites.add(productId);
    toast("Saralanganlarga qo‘shildi");
  }
  renderHome();
  renderFavoritesPage();
}

function wireRealtime(){
  if(!user) return;
  const uid = user.uid;

  onSnapshot(collection(db, "users", uid, "cart"), snap=>{
    const n = snap.size;
    $("#cartCount").textContent = String(n);
    $("#navCartCount").textContent = String(n);
    $("#cartCount").style.display = n ? "inline-block" : "none";
    $("#navCartCount").style.display = n ? "inline-block" : "none";
  });

  onSnapshot(collection(db, "users", uid, "favorites"), snap=>{
    const n = snap.size;
    $("#favCount").textContent = String(n);
    $("#navFavCount").textContent = String(n);
    $("#favCount").style.display = n ? "inline-block" : "none";
    $("#navFavCount").style.display = n ? "inline-block" : "none";
    state.favorites = new Set(snap.docs.map(d=>d.id));
    renderHome();
    renderFavoritesPage();
  });
}

/* ===== Cart modal + Orders ===== */
async function openCart(){
  if(!user){ toast("Avval kiring"); setActivePage("auth"); return; }

  $("#cartModalBackdrop").classList.add("show");
  const listEl = $("#cartList");
  listEl.innerHTML = "<div class='empty'>Yuklanmoqda...</div>";

  const uid = user.uid;
  onSnapshot(collection(db, "users", uid, "cart"), async (snap)=>{
    if(!snap.size){
      listEl.innerHTML = "<div class='empty'>Savat bo‘sh</div>";
      $("#cartTotal").textContent = "0 so‘m";
      $("#checkoutBtn").disabled = true;
      $("#checkoutBtn").style.opacity = .7;
      return;
    }
    $("#checkoutBtn").disabled = false;
    $("#checkoutBtn").style.opacity = 1;

    const items = snap.docs.map(d=>({ id:d.id, ...d.data() }));
    const byId = new Map(products.map(p=>[p.id,p]));
    let total = 0;

    listEl.innerHTML = items.map(it=>{
      const p = byId.get(it.id) || { title:"Mahsulot", price:0 };
      const img = pickImage(p);
      const qty = Number(it.qty||1);
      const sum = Number(p.price||0) * qty;
      total += sum;
      return `
        <div class="row" data-id="${it.id}">
          ${img ? `<img src="${img}" alt="">` : `<div class="ph"><i class="fas fa-image"></i></div>`}
          <div class="rinfo">
            <div class="t">${escapeHtml(p.title||"Mahsulot")}</div>
            <div class="p">${fmt(p.price||0)} so‘m</div>
          </div>
          <div class="qty">
            <button class="qminus">-</button>
            <div class="n">${qty}</div>
            <button class="qplus">+</button>
          </div>
        </div>
      `;
    }).join("");

    $("#cartTotal").textContent = `${fmt(total)} so‘m`;

    $$(".row", listEl).forEach(row=>{
      const id = row.dataset.id;
      $(".qminus", row).onclick = async ()=>{
        const ref = doc(db, "users", uid, "cart", id);
        const cur = await getDoc(ref);
        const q = (cur.exists()?Number(cur.data().qty||1):1) - 1;
        if(q<=0) await deleteDoc(ref);
        else await setDoc(ref, { qty:q }, { merge:true });
      };
      $(".qplus", row).onclick = async ()=>{
        const ref = doc(db, "users", uid, "cart", id);
        const cur = await getDoc(ref);
        const q = (cur.exists()?Number(cur.data().qty||1):0) + 1;
        await setDoc(ref, { qty:q }, { merge:true });
      };
    });

    // attach checkout with latest computed items/total
    $("#checkoutBtn").onclick = ()=> createOrder(items, byId, total);
  });
}
function closeCart(){ $("#cartModalBackdrop").classList.remove("show"); }

async function createOrder(cartItems, byId, total){
  try{
    const uid = user.uid;
    // fetch user profile for omId/phone
    const uref = doc(db, "users", uid);
    const usnap = await getDoc(uref);
    const ud = usnap.exists() ? (usnap.data()||{}) : {};
    const order = {
      uid,
      omId: ud.omId || null,
      phone: ud.phone || null,
      status: "new",
      total: Number(total||0),
      items: cartItems.map(it=>{
        const p = byId.get(it.id) || {};
        return {
          productId: it.id,
          title: p.title || "",
          price: Number(p.price||0),
          qty: Number(it.qty||1)
        };
      }),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    const ref = await addDoc(collection(db, "orders"), order);

    // clear cart (client-side)
    for (const it of cartItems){
      await deleteDoc(doc(db, "users", uid, "cart", it.id));
    }

    toast("Buyurtma yaratildi ✅");
    closeCart();

    // orders page simple message
    setActivePage("profile");
    toast(`Order ID: ${ref.id.slice(0,8)}…`);
  }catch(e){
    console.error(e);
    toast("Buyurtma yaratishda xato");
  }
}

/* ===== Admin ===== */
function isAdminUser(){
  const email = user?.email || "";
  return ADMIN_EMAILS.includes(email);
}

function renderAdminButton(){
  const b = $("#btnAdminGo");
  if(!b) return;
  b.style.display = isAdminUser() ? "inline-flex" : "none";
  b.onclick = ()=>{
    setActivePage("admin");
    loadAdminOrders();
  };
}

async function loadAdminOrders(){
  if(!isAdminUser()){
    $("#adminBox").innerHTML = `<div class="empty">Admin ruxsati yo‘q</div>`;
    return;
  }
  $("#adminBox").innerHTML = `<div class="empty">Yuklanmoqda...</div>`;

  const q = query(collection(db,"orders"), orderBy("createdAt","desc"), limit(50));
  onSnapshot(q, (snap)=>{
    if(!snap.size){
      $("#adminBox").innerHTML = `<div class="empty">Buyurtma yo‘q</div>`;
      return;
    }
    const rows = snap.docs.map(d=>{
      const o = d.data()||{};
      const id = d.id;
      const items = Array.isArray(o.items) ? o.items : [];
      const count = items.reduce((a,x)=>a+Number(x.qty||1),0);
      const st = String(o.status||"new");
      return `
        <div class="card" style="margin:0 16px 12px; padding:12px;">
          <div style="display:flex;justify-content:space-between;gap:10px;">
            <div>
              <div style="font-weight:900">#${escapeHtml(id.slice(0,8))} <span class="muted" style="font-size:12px;">${escapeHtml(o.omId||"")}</span></div>
              <div class="muted" style="font-size:12px;margin-top:4px;">${escapeHtml(o.phone||"")}</div>
              <div style="margin-top:6px;color:var(--gold2);font-weight:900;">${fmt(o.total||0)} so‘m</div>
              <div class="muted" style="font-size:12px;margin-top:4px;">${count} ta mahsulot</div>
            </div>
            <div style="min-width:140px;">
              <div class="muted" style="font-size:12px;margin-bottom:6px;">Status</div>
              <select data-oid="${escapeHtml(id)}" class="stsel"
                style="width:100%;padding:10px;border-radius:12px;border:1px solid rgba(34,41,58,.9);background:rgba(255,255,255,.03);color:var(--text);outline:none;">
                ${["new","processing","shipped","done","canceled"].map(s=>`<option value="${s}" ${s===st?"selected":""}>${s}</option>`).join("")}
              </select>
              <button class="btn gold saveStatus" data-oid="${escapeHtml(id)}" style="margin-top:8px;width:100%;padding:10px;">
                <i class="fas fa-floppy-disk"></i> Saqlash
              </button>
            </div>
          </div>
        </div>
      `;
    }).join("");
    $("#adminBox").innerHTML = rows;

    // bind save
    $$(".saveStatus").forEach(btn=>{
      btn.onclick = async ()=>{
        const oid = btn.dataset.oid;
        const sel = $(`select.stsel[data-oid="${oid}"]`);
        const val = sel.value;
        try{
          await updateDoc(doc(db,"orders",oid), { status: val, updatedAt: serverTimestamp() });
          toast("Status saqlandi");
        }catch(e){
          console.error(e);
          toast("Status saqlanmadi");
        }
      };
    });
  });
}

/* ===== Auth UI ===== */
function setAuthMsg(msg, isErr=false){
  const el = $("#authMsg");
  el.textContent = msg || "";
  el.style.color = isErr ? "#ffd1d1" : "var(--muted)";
}

async function doLogin(){
  const phone = normalizePhone($("#authPhone").value);
  $("#authPhone").value = phone;
  const pass = ($("#authPass").value||"").trim();
  if(!pass || pass.length < 6){ setAuthMsg("Parol kamida 6 ta belgi bo‘lsin", true); return; }
  const email = phoneToEmail(phone);
  try{
    await signInWithEmailAndPassword(auth, email, pass);
    setAuthMsg("");
  }catch(e){
    console.error(e);
    const code = e.code || "";
    if(code.includes("user-not-found")) setAuthMsg("Bu telefon ro‘yxatdan o‘tmagan", true);
    else if(code.includes("wrong-password") || code.includes("invalid-credential")) setAuthMsg("Parol yoki telefon xato", true);
    else setAuthMsg("Kirishda xato: " + code, true);
  }
}

async function doRegister(){
  const phone = normalizePhone($("#authPhone").value);
  $("#authPhone").value = phone;
  const pass = ($("#authPass").value||"").trim();
  if(!pass || pass.length < 6){ setAuthMsg("Parol kamida 6 ta belgi bo‘lsin", true); return; }
  const email = phoneToEmail(phone);
  try{
    await createUserWithEmailAndPassword(auth, email, pass);
    setAuthMsg("Ro‘yxatdan o‘tildi ✅");
  }catch(e){
    console.error(e);
    const code = e.code || "";
    if(code.includes("email-already-in-use")) setAuthMsg("Bu telefon oldin ro‘yxatdan o‘tgan", true);
    else if(code.includes("weak-password")) setAuthMsg("Parol juda oson (kamida 6 belgi)", true);
    else setAuthMsg("Ro‘yxatdan o‘tishda xato: " + code, true);
  }
}

async function doLogout(){
  try{ await signOut(auth); toast("Chiqildi"); }
  catch(e){ console.error(e); }
}

function initUI(){
  $("#btnCart").onclick = openCart;
  $("#btnFav").onclick = ()=> setActivePage(user ? "favorites" : "auth");
  $("#btnBell").onclick = ()=> toast("Bildirishnomalar keyin qo‘shiladi");

  $("#q").addEventListener("input", (e)=>{
    searchText = (e.target.value||"").trim().toLowerCase();
    renderHome();
  });

  $$(".nav-item").forEach(n=>{
    n.onclick = ()=>{
      const page = n.dataset.page;
      if(!user && ["home","categories","favorites","profile"].includes(page)){
        setActivePage("auth");
        return;
      }
      setActivePage(page);
      if(page==="favorites") renderFavoritesPage();
      if(page==="categories") renderCategoriesPage();
    };
  });

  $("#cartClose").onclick = closeCart;
  $("#cartModalBackdrop").addEventListener("click",(e)=>{
    if(e.target.id==="cartModalBackdrop") closeCart();
  });

  $("#btnLogin").onclick = doLogin;
  $("#btnRegister").onclick = doRegister;
  $("#btnForgot").onclick = ()=>{
    setAuthMsg("Parolni tiklash: @OrzuMallUZ_bot ga murojaat qiling.", false);
    toast("Botga murojaat qiling");
  };

  $("#btnLogout").onclick = doLogout;

  // auto +998
  const ph = $("#authPhone");
  ph.addEventListener("focus", ()=>{
    if(!ph.value) ph.value = "+998";
  });
  ph.addEventListener("input", ()=>{
    // keep + and digits
    let v = ph.value.replace(/[^\d+]/g,"");
    if(!v.startsWith("+")) v = "+" + v.replace(/\+/g,"");
    if(v === "+") v = "+998";
    ph.value = v;
  });
}

async function boot(){
  initUI();
  const ok = await initFirebase();
  if(!ok) return;

  onAuthStateChanged(auth, async (u)=>{
    user = u;

    if(!user){
      // gate
      setActivePage("auth");
      $("#btnAdminGo").style.display = "none";
      $("#authMsg").textContent = "";
      return;
    }

    // fill profile phone from internal email
    const email = user.email || "";
    // "99890....@orzumall.uz"
    const digits = email.split("@")[0] || "";
    if(digits && digits.startsWith("998")){
      // store display phone in users doc
      try{
        await setDoc(doc(db,"users",user.uid), { phone: "+"+digits }, { merge:true });
      }catch(e){}
    }

    await ensureUserDoc();
    wireRealtime();
    renderAdminButton();

    // load products once
    if(!products.length) await loadProducts();

    // default page home
    setActivePage("home");

    // show warning off
    $("#fbWarn").style.display = "none";
  });
}

boot();
