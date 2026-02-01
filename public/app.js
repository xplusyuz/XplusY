import { auth } from "./firebase-config.js";
import {
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut,
  signInWithCustomToken
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";

const els = {
  userName: document.getElementById("userName"),
  userSmall: document.getElementById("userSmall"),
  avatar: document.getElementById("avatar"),
  btnGoogle: document.getElementById("btnGoogle"),
  btnLogout: document.getElementById("btnLogout"),
  grid: document.getElementById("grid"),
  empty: document.getElementById("empty"),
  q: document.getElementById("q"),
  sort: document.getElementById("sort"),
  btnReload: document.getElementById("btnReload"),
  tgNotice: document.getElementById("tgNotice"),
  authCard: document.getElementById("authCard"),

  // new UI
  favViewBtn: document.getElementById("favViewBtn"),
  cartBtn: document.getElementById("cartBtn"),
  favCount: document.getElementById("favCount"),
  cartCount: document.getElementById("cartCount"),

  overlay: document.getElementById("overlay"),
  sidePanel: document.getElementById("sidePanel"),
  panelTitle: document.getElementById("panelTitle"),
  panelClose: document.getElementById("panelClose"),
  panelList: document.getElementById("panelList"),
  panelEmpty: document.getElementById("panelEmpty"),
  panelBottom: document.getElementById("panelBottom"),
  totalRow: document.getElementById("totalRow"),
  cartTotal: document.getElementById("cartTotal"),
  checkoutBtn: document.getElementById("checkoutBtn"),
  clearBtn: document.getElementById("clearBtn"),
};

let products = [];

const LS = {
  favs: "om_favs",
  cart: "om_cart"
};

function loadLS(key, fallback){
  try{ return JSON.parse(localStorage.getItem(key) || "") ?? fallback; }
  catch{ return fallback; }
}
function saveLS(key, value){
  localStorage.setItem(key, JSON.stringify(value));
}

let viewMode = "all"; // all | fav
let favs = new Set(loadLS(LS.favs, []));
let cart = loadLS(LS.cart, []); // [{id, qty}]


function showTgNotice(msg){
  if(!els.tgNotice) return;
  els.tgNotice.hidden = !msg;
  els.tgNotice.textContent = msg || "";
}

function moneyUZS(n){
  try { return new Intl.NumberFormat("uz-UZ").format(n) + " so‘m"; }
  catch { return `${n} UZS`; }
}
function norm(s){ return (s ?? "").toString().toLowerCase().trim(); }

function applyFilterSort(){
  const query = norm(els.q.value);
  let arr = [...products];

  if(viewMode === "fav"){
    arr = arr.filter(p=>favs.has(p.id));
  }

  if(query){
    arr = arr.filter(p=>{
      const hay = `${p.name} ${(p.tags||[]).join(" ")}`.toLowerCase();
      return hay.includes(query);
    });
  }

  const sort = els.sort.value;
  if(sort === "price_asc") arr.sort((a,b)=>(a.price||0)-(b.price||0));
  if(sort === "price_desc") arr.sort((a,b)=>(b.price||0)-(a.price||0));
  if(sort === "new") arr.sort((a,b)=> new Date(b.createdAt||0) - new Date(a.createdAt||0));
  if(sort === "popular") arr.sort((a,b)=>(b.popularScore||0)-(a.popularScore||0));

  render(arr);
}

function render(arr){
  els.grid.innerHTML = "";
  els.empty.hidden = arr.length !== 0;

  for(const p of arr){
    const card = document.createElement("div");
    card.className = "pcard";

    const isFav = favs.has(p.id);

    card.innerHTML = `
      <button class="favBtn ${isFav ? "active" : ""}" title="Sevimli">❤️</button>
      <img class="pimg" src="${p.image || ""}" alt="${p.name || "product"}" loading="lazy"/>
      <div class="pbody">
        <div class="pname">${p.name || "Nomsiz"}</div>
        <div class="ptags">${(p.tags||[]).map(t=>`#${t}`).join(" ")}</div>
        <div class="priceRow">
          <div class="price">${moneyUZS(p.price || 0)}</div>
          <div class="badge">ID: ${p.id || "-"}</div>
        </div>
        <div class="pActions">
          <button class="pBtn ghost" data-act="buy">⚡ Tezkor</button>
          <button class="pBtn" data-act="cart">🛒 Savatcha</button>
        </div>
      </div>
    `;

    const favBtn = card.querySelector(".favBtn");
    favBtn.addEventListener("click", ()=>{
      if(favs.has(p.id)) favs.delete(p.id); else favs.add(p.id);
      saveLS(LS.favs, Array.from(favs));
      favBtn.classList.toggle("active", favs.has(p.id));
      updateBadges();
      if(viewMode === "fav") applyFilterSort();
    });

    card.querySelector('[data-act="cart"]').addEventListener("click", ()=>{
      addToCart(p.id, 1);
      openPanel("cart");
    });

    card.querySelector('[data-act="buy"]').addEventListener("click", ()=>{
      // quick order: add 1 and open panel
      addToCart(p.id, 1);
      openPanel("cart");
    });

    els.grid.appendChild(card);
  }
}


function addToCart(id, qty){
  const item = cart.find(x=>x.id===id);
  if(item) item.qty += qty;
  else cart.push({id, qty});
  cart = cart.filter(x=>x.qty>0);
  saveLS(LS.cart, cart);
  updateBadges();
}

function cartCount(){
  return cart.reduce((s,x)=>s + (x.qty||0), 0);
}

function updateBadges(){
  if(els.favCount) els.favCount.textContent = String(favs.size);
  if(els.cartCount) els.cartCount.textContent = String(cartCount());
}

function openPanel(mode){
  if(!els.sidePanel || !els.overlay) return;
  // bottom controls exist for both, but differ
  els.panelBottom.style.display = "";
  const isCart = (mode === "cart");
  if(els.totalRow) els.totalRow.style.display = isCart ? "" : "none";
  if(els.checkoutBtn) els.checkoutBtn.style.display = isCart ? "" : "none";
  if(els.clearBtn) els.clearBtn.textContent = isCart ? "Tozalash" : "Sevimlilarni tozalash";
  els.panelTitle.textContent = isCart ? "Savatcha" : "Sevimlilar";
  renderPanel(mode);

  // show + animate
  els.overlay.hidden = false;
  els.sidePanel.hidden = false;
  requestAnimationFrame(()=>{
    els.overlay.classList.add("open");
    els.sidePanel.classList.add("open");
  });
}

function closePanel(){
  if(!els.sidePanel || !els.overlay) return;

  els.overlay.classList.remove("open");
  els.sidePanel.classList.remove("open");

  // wait animation then hide
  const t = 240;
  window.setTimeout(()=>{
    els.overlay.hidden = true;
    els.sidePanel.hidden = true;
  }, t);
}

function renderPanel(mode){
  els.panelList.innerHTML = "";
  const list = [];

  if(mode === "fav"){
    for(const id of favs){
      const p = products.find(x=>x.id===id);
      if(p) list.push({p, qty:0});
    }
  } else {
    for(const ci of cart){
      const p = products.find(x=>x.id===ci.id);
      if(p) list.push({p, qty: ci.qty || 1});
    }
  }

  els.panelEmpty.hidden = list.length !== 0;

  let total = 0;

  for(const row of list){
    const {p, qty} = row;
    if(mode === "cart") total += (p.price||0) * qty;

    const item = document.createElement("div");
    item.className = "cartItem";
    item.innerHTML = `
      <img class="cartImg" src="${p.image||""}" alt="${p.name||"product"}" />
      <div class="cartMeta">
        <div class="cartTitle">${p.name||"Nomsiz"}</div>
        <div class="cartRow">
          <div class="price">${moneyUZS(p.price||0)}</div>
          <button class="removeBtn" title="O‘chirish">🗑️</button>
        </div>
        ${mode==="cart" ? `
        <div class="cartRow">
          <div class="qty">
            <button data-q="-">−</button>
            <span>${qty}</span>
            <button data-q="+">+</button>
          </div>
          <div class="badge">${moneyUZS((p.price||0)*qty)}</div>
        </div>` : `
        <div class="cartRow">
          <button class="pBtn" style="padding:8px 10px" data-add>🛒 Savatchaga</button>
          <div class="badge">❤️ Sevimli</div>
        </div>`}
      </div>
    `;

    const removeBtn = item.querySelector(".removeBtn");
    removeBtn.addEventListener("click", ()=>{
      if(mode==="fav"){
        favs.delete(p.id);
        saveLS(LS.favs, Array.from(favs));
        updateBadges();
        renderPanel("fav");
        if(viewMode==="fav") applyFilterSort();
      } else {
        cart = cart.filter(x=>x.id!==p.id);
        saveLS(LS.cart, cart);
        updateBadges();
        renderPanel("cart");
      }
    });

    if(mode==="cart"){
      item.querySelector('[data-q="-"]').addEventListener("click", ()=>{
        addToCart(p.id, -1);
        renderPanel("cart");
      });
      item.querySelector('[data-q="+"]').addEventListener("click", ()=>{
        addToCart(p.id, +1);
        renderPanel("cart");
      });
    } else {
      const addBtn = item.querySelector("[data-add]");
      addBtn.addEventListener("click", ()=>{
        addToCart(p.id, 1);
        openPanel("cart");
      });
    }

    els.panelList.appendChild(item);
  }

  if(els.cartTotal) els.cartTotal.textContent = moneyUZS(total);
}


async function loadProducts(){
  const res = await fetch("./products.json", { cache: "no-store" });
  const json = await res.json();
  products = Array.isArray(json.items) ? json.items : [];
  applyFilterSort();
}

function setUserUI(user){
  const authCard = els.authCard || document.getElementById("authCard");

  // robust: body class controls CSS hide/show
  document.body.classList.toggle("signed-in", !!user);

  if(!user){
    if(authCard) authCard.style.display = "";
    els.userName.textContent = "Mehmon";
    els.userSmall.textContent = "Kirish talab qilinadi";
    els.avatar.src = "";
    els.avatar.style.visibility = "hidden";
    els.btnLogout.hidden = true;
    return;
  }

  // hide login block after sign-in
  if(authCard) authCard.style.display = "none";

  const name = user.displayName || user.email || user.phoneNumber || "User";
  els.userName.textContent = name;
  els.userSmall.textContent = `UID: ${user.uid.slice(0,8)}…`;

  const photo = user.photoURL;
  if(photo){
    els.avatar.src = photo;
    els.avatar.style.visibility = "visible";
  } else {
    els.avatar.src = "";
    els.avatar.style.visibility = "hidden";
  }
  els.btnLogout.hidden = false;
}

els.btnGoogle.addEventListener("click", async ()=>{
  try{
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  }catch(e){
    alert("Google login xatolik. Console’ni tekshiring. Eng ko‘p sabab: firebase-config.js apiKey noto‘g‘ri.");
    console.error(e);
  }
});

els.btnLogout.addEventListener("click", async ()=>{ await signOut(auth); });

window.addEventListener("tg_auth", async (e)=>{
  const tgUser = e.detail;
  showTgNotice("Telegram auth yuborildi...");

  try{
    const r = await fetch("/.netlify/functions/telegramAuth", {
      method: "POST",
      headers: {"content-type":"application/json"},
      body: JSON.stringify({ tgUser })
    });

    const out = await r.json().catch(()=> ({}));
    if(!r.ok){
      const msg = out?.error || "Telegram auth xatolik";
      const details = out?.details ? `\nDETAILS: ${out.details}` : "";
      const hints = out?.envHints ? `\nENV: ${JSON.stringify(out.envHints)}` : "";
      showTgNotice(msg + details + hints);
      console.error("telegramAuth error:", out);
      return;
    }

    showTgNotice("Firebase token olindi. Kirish...");
    await signInWithCustomToken(auth, out.customToken);
    showTgNotice("");
  }catch(err){
    showTgNotice("Telegram auth network/server xatolik");
    console.error(err);
  }
});

els.q.addEventListener("input", applyFilterSort);
els.sort.addEventListener("change", applyFilterSort);
els.btnReload.addEventListener("click", loadProducts);

// panel & views
// Favorites should open like cart (drawer), not just filter the grid.
els.favViewBtn?.addEventListener("click", ()=> openPanel("fav"));
els.cartBtn?.addEventListener("click", ()=> openPanel("cart"));
els.panelClose?.addEventListener("click", closePanel);
els.overlay?.addEventListener("click", closePanel);
els.clearBtn?.addEventListener("click", ()=>{
  if(els.panelTitle.textContent.includes("Sevimli")){
    favs = new Set();
    saveLS(LS.favs, []);
  } else {
    cart = [];
    saveLS(LS.cart, []);
  }
  updateBadges();
  renderPanel(els.panelTitle.textContent.includes("Sevimli") ? "fav" : "cart");
  if(viewMode === "fav") applyFilterSort();
});
els.checkoutBtn?.addEventListener("click", ()=>{
  // This demo doesn't send automatically. Provide copyable text.
  const lines = cart.map(ci=>{
    const p = products.find(x=>x.id===ci.id);
    if(!p) return null;
    return `${p.name} x${ci.qty} = ${moneyUZS((p.price||0)*ci.qty)}`;
  }).filter(Boolean);
  const total = cart.reduce((s,ci)=>{
    const p = products.find(x=>x.id===ci.id);
    return s + (p? (p.price||0)*(ci.qty||0) : 0);
  },0);
  const msg = `OrzuMall buyurtma:%0A${encodeURIComponent(lines.join("\n"))}%0A%0AJami: ${encodeURIComponent(moneyUZS(total))}`;
  // Try open Telegram share (works if user has TG installed or web)
  window.open(`https://t.me/share/url?url=&text=${msg}`, "_blank");
});

onAuthStateChanged(auth, (user)=> setUserUI(user));

await loadProducts();
updateBadges();
