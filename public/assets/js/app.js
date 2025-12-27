import { api } from "./api.js";
import { getToken, clearSession, me } from "./auth.js";
import { $, $all, toast, setText } from "./ui.js";
import { startClock, startSeasonParticles } from "./season.js";

function guard(){
  const t = getToken();
  if(!t){
    location.href = "/index.html";
    return false;
  }
  return true;
}

let content = null;
let carouselIndex = 0;
let carouselTimer = null;
let activeTag = "Hammasi";

function buildChips(cards){
  const tags = ["Hammasi", ...Array.from(new Set(cards.map(c=>c.tag || "Boshqa")))];
  const wrap = $("#chips");
  wrap.innerHTML = "";
  for(const tag of tags){
    const el = document.createElement("div");
    el.className = "chip" + (tag===activeTag ? " active":"");
    el.textContent = tag;
    el.onclick = ()=>{
      activeTag = tag;
      $all(".chip", wrap).forEach(x=>x.classList.remove("active"));
      el.classList.add("active");
      renderCards();
    };
    wrap.appendChild(el);
  }
}

function renderCards(){
  const wrap = $("#cards");
  const cards = (content?.cards || []).filter(c=>c.active!==false);
  const filtered = activeTag==="Hammasi" ? cards : cards.filter(c => (c.tag||"Boshqa")===activeTag);
  wrap.innerHTML = "";
  if(filtered.length===0){
    wrap.innerHTML = `<div class="cardItem"><div class="title">Hozircha card yo‘q</div><div class="desc">Admin paneldan qo‘shing.</div></div>`;
    return;
  }
  for(const c of filtered){
    const el = document.createElement("div");
    el.className = "cardItem";
    el.innerHTML = `
      <div class="badge" style="justify-content:space-between">
        <span>${(c.tag||"Boshqa")}</span>
        <span style="color:var(--brand)">●</span>
      </div>
      <div class="title">${escapeHtml(c.title||"Card")}</div>
      <div class="desc">${escapeHtml(c.desc||"")}</div>
      <button class="btn primary" style="width:100%" ${c.href? "":"disabled"}>
        Ochish
      </button>
    `;
    el.querySelector("button").onclick = ()=>{
      if(!c.href) return;
      window.open(c.href, "_blank", "noopener");
    };
    wrap.appendChild(el);
  }
}

function renderCarousel(){
  const banners = (content?.banners || []).filter(b=>b.active!==false);
  const track = $("#carouselTrack");
  const dots = $("#dots");
  track.innerHTML = "";
  dots.innerHTML = "";
  if(banners.length===0){
    track.innerHTML = `<div class="slide"><div style="padding:16px"><b>Banner yo‘q</b><div style="color:var(--muted);margin-top:6px">Admin paneldan qo‘shing.</div></div></div>`;
    return;
  }
  banners.forEach((b,i)=>{
    const slide = document.createElement("div");
    slide.className="slide";
    slide.innerHTML = b.img
      ? `<img alt="banner" src="${escapeAttr(b.img)}" />`
      : `<div style="padding:16px"><b>${escapeHtml(b.title||"Banner")}</b><div style="color:var(--muted);margin-top:6px">${escapeHtml(b.subtitle||"")}</div></div>`;
    slide.onclick = ()=>{ if(b.href) window.open(b.href,"_blank","noopener"); };
    track.appendChild(slide);

    const dot = document.createElement("div");
    dot.className = "dot" + (i===carouselIndex ? " active":"");
    dot.onclick = ()=>{ carouselIndex=i; updateCarousel(); resetCarouselTimer(); };
    dots.appendChild(dot);
  });
  updateCarousel();
  resetCarouselTimer();
}

function updateCarousel(){
  const banners = (content?.banners || []).filter(b=>b.active!==false);
  const track = $("#carouselTrack");
  const dots = $all(".dot", $("#dots"));
  if(banners.length===0) return;
  if(carouselIndex>=banners.length) carouselIndex=0;
  track.style.transform = `translateX(${-carouselIndex*100}%)`;
  dots.forEach((d,i)=> d.classList.toggle("active", i===carouselIndex));
}

function resetCarouselTimer(){
  clearInterval(carouselTimer);
  carouselTimer = setInterval(()=>{
    const banners = (content?.banners || []).filter(b=>b.active!==false);
    if(!banners.length) return;
    carouselIndex = (carouselIndex + 1) % banners.length;
    updateCarousel();
  }, 4500);
}

async function load(){
  if(!guard()) return;
  startClock();
  startSeasonParticles();

  try{
    const profile = await me();
    setText("userName", profile.user.name || profile.user.loginId);
    setText("userId", profile.user.loginId);
    setText("userPoints", String(profile.user.points ?? 0));
    setText("userBalance", String(profile.user.balance ?? 0));
  }catch(e){
    clearSession();
    location.href="/index.html";
    return;
  }

  content = await api("/content", {token:getToken()});
  renderCarousel();

  const cards = (content?.cards || []).filter(c=>c.active!==false);
  buildChips(cards);
  renderCards();

  $("#logoutBtn").onclick = ()=>{
    clearSession();
    location.href="/index.html";
  };
}

function escapeHtml(s){ return String(s).replace(/[&<>"']/g, m=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m])); }
function escapeAttr(s){ return escapeHtml(s).replace(/"/g,"&quot;"); }

load().catch(e=>toast(e.message||"Xatolik"));
