
function calcAgePrecise(birth){
  if(!birth) return "-";
  const b = new Date(birth+"T00:00:00");
  const n = new Date();
  let y = n.getFullYear() - b.getFullYear();
  let m = n.getMonth() - b.getMonth();
  let d = n.getDate() - b.getDate();
  if(d < 0){
    m--;
    const pm = new Date(n.getFullYear(), n.getMonth(), 0).getDate();
    d += pm;
  }
  if(m < 0){
    y--;
    m += 12;
  }
  return `${y} yosh ${m} oy ${d} kun`;
}

import { api } from "./api.js";
import { getToken, clearSession, me, updateProfile, changePassword } from "./auth.js";
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

async function runOnboarding(user){
  return new Promise((resolve)=>{
    const overlay = document.getElementById("onboardOverlay");
    const bSave = document.getElementById("obSave");
    const f = document.getElementById("obFirst");
    const l = document.getElementById("obLast");
    const bd = document.getElementById("obBirth");
    const p1 = document.getElementById("obPass1");
    const p2 = document.getElementById("obPass2");

    // prefill if exists
    f.value = user.firstName || "";
    l.value = user.lastName || "";
    bd.value = user.birthdate || "";

    overlay.style.display = "flex";

    const doSave = async ()=>{
      bSave.disabled = true;
      try{
        const firstName = f.value.trim();
        const lastName = l.value.trim();
        const birthdate = bd.value.trim();
        const pass1 = p1.value;
        const pass2 = p2.value;

        if(firstName.length < 2) throw new Error("Ism kamida 2 ta harf bo‘lsin");
        if(lastName.length < 2) throw new Error("Familiya kamida 2 ta harf bo‘lsin");
        if(!birthdate) throw new Error("Tug‘ilgan sanani tanlang");
        if(pass1.length < 6) throw new Error("Yangi parol kamida 6 belgidan iborat bo‘lsin");
        if(pass1 !== pass2) throw new Error("Parollar mos emas");

        await changePassword({newPassword: pass1});
        await updateProfile({firstName,lastName,birthdate});

        overlay.style.display = "none";
        resolve(true);
      }catch(e){
        toast(e.message || "Xatolik");
      }finally{
        bSave.disabled = false;
      }
    };

    bSave.onclick = doSave;
  });
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
setText("userAge", calcAgePrecise(profile.user.birthdate));
    // mandatory onboarding
    if(!profile.user.profileComplete){
      await runOnboarding(profile.user);
      const refreshed = await me();
      setText("userName", refreshed.user.name || refreshed.user.loginId);
      setText("userId", refreshed.user.loginId);
      setText("userPoints", String(refreshed.user.points ?? 0));
      setText("userBalance", String(refreshed.user.balance ?? 0));
    }

  }catch(e){
    clearSession();
    location.href="/index.html";
    return;
  }

  content = await api("/content", {token:getToken()});
  renderCarousel();

  renderFixedSections();

  $("#logoutBtn").onclick = ()=>{
    clearSession();
    location.href="/index.html";
  };
}

function escapeHtml(s){ return String(s).replace(/[&<>"']/g, m=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m])); }
function escapeAttr(s){ return escapeHtml(s).replace(/"/g,"&quot;"); }

load().catch(e=>toast(e.message||"Xatolik"));
