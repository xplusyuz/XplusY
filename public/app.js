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
};

let products = [];

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
    card.innerHTML = `
      <img class="pimg" src="${p.image || ""}" alt="${p.name || "product"}" loading="lazy"/>
      <div class="pbody">
        <div class="pname">${p.name || "Nomsiz"}</div>
        <div class="ptags">${(p.tags||[]).map(t=>`#${t}`).join(" ")}</div>
        <div class="priceRow">
          <div class="price">${moneyUZS(p.price || 0)}</div>
          <div class="badge">ID: ${p.id || "-"}</div>
        </div>
      </div>
    `;
    els.grid.appendChild(card);
  }
}

async function loadProducts(){
  const res = await fetch("./products.json", { cache: "no-store" });
  const json = await res.json();
  products = Array.isArray(json.items) ? json.items : [];
  applyFilterSort();
}

function setUserUI(user){
  if(!user){
    els.userName.textContent = "Mehmon";
    els.userSmall.textContent = "Kirish talab qilinadi";
    els.avatar.src = "";
    els.avatar.style.visibility = "hidden";
    els.btnLogout.hidden = true;
    return;
  }

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

onAuthStateChanged(auth, (user)=> setUserUI(user));

await loadProducts();
