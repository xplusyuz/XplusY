// LeaderMath — app.js
const $ = (s)=>document.querySelector(s);
const $$ = (s)=>document.querySelectorAll(s);

function formatUzDateTime(d){
  const date = d.toLocaleDateString("uz-UZ", {
    weekday:"long", year:"numeric", month:"long", day:"numeric"
  });
  const time = d.toLocaleTimeString("uz-UZ", { hour12:false });
  return `${date} • ${time}`;
}
function startClock(){
  const el = $("#todayLabel");
  const tick = ()=>{ el.textContent = formatUzDateTime(new Date()); };
  tick();
  setInterval(tick, 1000);
}


const API_BASE = "/api";
const TOKEN_KEY = "lm_token_v1";
let session = null;
let regionsData = null;
let answersMap = null;
let currentQIndex = 1;



function setStatus(el, msg, ok=true){
  el.className = "status show " + (ok ? "ok" : "bad");
  el.textContent = msg;
}
function clearStatus(el){
  el.className = "status";
  el.textContent = "";
}
function normalizeAnswer(s){
  return String(s ?? "").trim().toLowerCase().replace(/\s+/g," ");
}
function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

function saveToken(t){ localStorage.setItem(TOKEN_KEY, t); }
function loadToken(){ return localStorage.getItem(TOKEN_KEY) || ""; }
function clearToken(){ localStorage.removeItem(TOKEN_KEY); }

async function api(path, {method="GET", body=null, auth=true}={}){
  const headers = {"Content-Type":"application/json"};
  if(auth){
    const token = loadToken();
    if(token) headers["Authorization"] = "Bearer " + token;
  }
  const res = await fetch(API_BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null
  });
  const data = await res.json().catch(()=> ({}));
  if(!res.ok){
    const msg = data?.error || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

/* Modal helpers */
function showOverlay(sel){ $(sel).classList.add("show"); $(sel).setAttribute("aria-hidden","false"); }
function hideOverlay(sel){ $(sel).classList.remove("show"); $(sel).setAttribute("aria-hidden","true"); }

const authOverlay = $("#authOverlay");
$("#loginBtn").addEventListener("click", ()=>showOverlay("#authOverlay"));
$("#closeAuth").addEventListener("click", ()=>hideOverlay("#authOverlay"));
authOverlay.addEventListener("click",(e)=>{ if(e.target===authOverlay) hideOverlay("#authOverlay"); });

const profileOverlay = $("#profileOverlay");
$("#profileBtn").addEventListener("click", async ()=>{
  await refreshMe();
  fillProfileView();
  showOverlay("#profileOverlay");
});
$("#closeProfile").addEventListener("click", ()=>hideOverlay("#profileOverlay"));
profileOverlay.addEventListener("click",(e)=>{ if(e.target===profileOverlay) hideOverlay("#profileOverlay"); });

const editOverlay = $("#editOverlay");
$("#openEdit").addEventListener("click", async ()=>{
  await refreshMe();
  fillEditForm();
  hideOverlay("#profileOverlay");
  showOverlay("#editOverlay");
});
$("#closeEdit").addEventListener("click", ()=>hideOverlay("#editOverlay"));
editOverlay.addEventListener("click",(e)=>{ if(e.target===editOverlay) hideOverlay("#editOverlay"); });

$("#logoutBtn").addEventListener("click", logout);
$("#logoutBtn2").addEventListener("click", logout);

function lock(on){
  $("#lockScreen").style.display = on ? "grid" : "none";
}
$("#lockLogin").addEventListener("click", ()=>{ lock(false); showOverlay("#authOverlay"); $("#loginId")?.focus?.(); });
/* Tabs */
$$(".seg button").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    $$(".seg button").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    const tab = btn.dataset.tab;
    $("#tab-login").style.display = tab==="login" ? "grid" : "none";
    $("#tab-signup").style.display = tab==="signup" ? "grid" : "none";
    clearStatus($("#status"));
  });
});

/* DOB validate DD:MM:YYYY */
function isValidDOB(s){
  const m = /^(\d{2}):(\d{2}):(\d{4})$/.exec(String(s||"").trim());
  if(!m) return false;
  const dd = +m[1], mm = +m[2], yy = +m[3];
  if(yy < 1900 || yy > new Date().getFullYear()) return false;
  if(mm < 1 || mm > 12) return false;
  const dim = new Date(yy, mm, 0).getDate();
  return dd >= 1 && dd <= dim;
}

/* region.json */
async function loadRegions(){
  const r = await fetch("data/region.json?v=" + Date.now());
  if(!r.ok) throw new Error("data/region.json topilmadi");
  regionsData = await r.json();
}

function fillRegionSelect(regionEl, districtEl, selectedRegion="", selectedDistrict=""){
  regionEl.innerHTML = "";
  districtEl.innerHTML = "";
  const regions = regionsData?.regions || [];
  regionEl.appendChild(new Option("Viloyatni tanlang", "", true, false));
  regions.forEach(x=>{
    regionEl.appendChild(new Option(x.name, x.name, false, x.name===selectedRegion));
  });

  function fillDistricts(regionName){
    districtEl.innerHTML = "";
    districtEl.appendChild(new Option("Tumanni tanlang", "", true, false));
    const reg = regions.find(x=>x.name===regionName);
    (reg?.districts || []).forEach(d=>{
      districtEl.appendChild(new Option(d, d, false, d===selectedDistrict));
    });
  }
  fillDistricts(selectedRegion);
  regionEl.onchange = ()=> fillDistricts(regionEl.value);
}

/* probe images */
async function probeImagesSequential(folder, start=1, max=80){
  const urls = [];
  for(let i=start;i<=max;i++){
    const url = `${folder}/${i}.png`;
    const ok = await new Promise(res=>{
      const img = new Image();
      img.onload = ()=>res(true);
      img.onerror = ()=>res(false);
      img.src = url + `?v=${Date.now()}`;
    });
    if(!ok){
      if(i===start) return [];
      break;
    }
    urls.push(url);
  }
  return urls;
}

/* avatars */
function buildAvatarPicker(container, hiddenInput, urls, selected=""){
  container.innerHTML = "";
  if(!urls.length){
    container.innerHTML = `<div style="color:#4b6b59;font-weight:900;font-size:12px">avatar/1.png topilmadi</div>`;
    hiddenInput.value = "";
    return;
  }
  urls.forEach(u=>{
    const div = document.createElement("div");
    div.className = "aItem" + (u===selected ? " active" : "");
    div.innerHTML = `<img src="${u}" alt="avatar">`;
    div.onclick = ()=>{
      [...container.children].forEach(x=>x.classList.remove("active"));
      div.classList.add("active");
      hiddenInput.value = u;
    };
    container.appendChild(div);
  });
  if(!selected){
    container.children[0].classList.add("active");
    hiddenInput.value = urls[0];
  }else{
    hiddenInput.value = selected;
  }
}

/* Auth actions */
$("#doLoginBtn").addEventListener("click", async ()=>{
  const st = $("#status"); clearStatus(st);
  try{
    const loginId = $("#loginId").value.trim();
    const password = $("#loginPass").value;
    if(!loginId || !password) throw new Error("ID va parolni kiriting.");
    const out = await api("/auth/login", {method:"POST", body:{loginId, password}, auth:false});
    saveToken(out.token);
    await refreshMe();
    hideOverlay("#authOverlay");
    lock(false);
  }catch(e){
    setStatus(st, "❌ " + e.message, false);
  }
});

$("#doSignupBtn").addEventListener("click", async ()=>{
  const st = $("#status"); clearStatus(st);
  try{
    const firstName = $("#firstName").value.trim();
    const lastName  = $("#lastName").value.trim();
    const dob       = $("#dob").value.trim();
    const region    = $("#regionSel").value;
    const district  = $("#districtSel").value;
    const password  = $("#newPass").value;
    const avatar    = $("#avatarValue").value;

    if(!firstName) throw new Error("Ism majburiy.");
    if(!lastName)  throw new Error("Familiya majburiy.");
    if(!isValidDOB(dob)) throw new Error("Tug‘ilgan sana qat’iy DD:MM:YYYY formatda bo‘lsin.");
    if(!region) throw new Error("Viloyatni tanlang.");
    if(!district) throw new Error("Tumanni tanlang.");
    if(!password || password.length < 6) throw new Error("Yangi parol kamida 6 bo‘lsin.");
    if(!avatar) throw new Error("Avatar tanlang (avatar/ papkada rasmlar bo‘lsin).");

    const out = await api("/auth/signup", {method:"POST", body:{ firstName, lastName, dob, region, district, password, avatar }, auth:false});
    saveToken(out.token);
    await refreshMe();
    setStatus(st, `✅ Ro‘yxatdan o‘tdingiz! Sizning ID: ${out.loginId} (eslab qoling)`, true);
    setTimeout(()=>{ hideOverlay("#authOverlay"); lock(false); }, 850);
  }catch(e){
    setStatus(st, "❌ " + e.message, false);
  }
});

async function refreshMe(){
  const out = await api("/auth/me", {method:"GET", auth:true});
  session = out;
  renderUserChip();
}

function renderUserChip(){
  const logged = !!session?.user;
  $("#loginBtn").style.display = logged ? "none" : "inline-flex";
  $("#chip").style.display = logged ? "flex" : "none";
  if(logged){
    const u = session.user;
    const nm = `${u.firstName} ${u.lastName}`.trim();
    $("#uname").textContent = nm;
    $("#ava").textContent = (nm[0] || "L").toUpperCase();
    $("#pointsPill").textContent = (u.points || 0) + " ball";
  }
}

function logout(){
  clearToken();
  session = null;
  renderUserChip();
  lock(true);
}

/* Profile view/edit */
function fillProfileView(){
  const u = session?.user;
  if(!u) return;
  $("#pAvatar").src = u.avatar || "";
  $("#pName").textContent = `${u.firstName} ${u.lastName}`.trim();
  $("#pIdLine").textContent = `ID: ${u.loginId}`;
  $("#pDob").textContent = u.dob || "—";
  $("#pRegion").textContent = u.region || "—";
  $("#pDistrict").textContent = u.district || "—";
  $("#pPoints").textContent = (u.points || 0) + " ball";
}

function fillEditForm(){
  const u = session?.user;
  if(!u) return;
  $("#eFirstName").value = u.firstName || "";
  $("#eLastName").value  = u.lastName || "";
  $("#eDob").value       = u.dob || "";
  fillRegionSelect($("#eRegionSel"), $("#eDistrictSel"), u.region || "", u.district || "");
  buildAvatarPicker($("#eAvatars"), $("#eAvatarValue"), window.__avatarUrls || [], u.avatar || "");
}

$("#saveProfile").addEventListener("click", async ()=>{
  const st = $("#editStatus"); clearStatus(st);
  try{
    const firstName = $("#eFirstName").value.trim();
    const lastName  = $("#eLastName").value.trim();
    const dob       = $("#eDob").value.trim();
    const region    = $("#eRegionSel").value;
    const district  = $("#eDistrictSel").value;
    const avatar    = $("#eAvatarValue").value;

    if(!firstName) throw new Error("Ism majburiy.");
    if(!lastName) throw new Error("Familiya majburiy.");
    if(!isValidDOB(dob)) throw new Error("Tug‘ilgan sana DD:MM:YYYY bo‘lsin.");
    if(!region) throw new Error("Viloyatni tanlang.");
    if(!district) throw new Error("Tumanni tanlang.");
    if(!avatar) throw new Error("Avatar tanlang.");

    await api("/profile/update", { method:"POST", body:{ firstName, lastName, dob, region, district, avatar }, auth:true });
    setStatus(st, "✅ Saqlandi!", true);
    await refreshMe();
    setTimeout(()=>hideOverlay("#editOverlay"), 450);
  }catch(e){
    setStatus(st, "❌ " + e.message, false);
  }
});

/* Banner carousel */
function buildCarousel(slidesEl, dotsEl, urls){
  slidesEl.innerHTML = "";
  dotsEl.innerHTML = "";
  if(!urls.length){
    slidesEl.innerHTML = `<div style="padding:12px;color:var(--muted);font-weight:900">banner/ ichida 1.png topilmadi</div>`;
    return;
  }
  urls.forEach((u, idx)=>{
    const s = document.createElement("div");
    s.className = "slide";
    s.innerHTML = `<img src="${u}" alt="Banner ${idx+1}">`;
    slidesEl.appendChild(s);

    const d = document.createElement("div");
    d.className = "dot" + (idx===0 ? " active" : "");
    dotsEl.appendChild(d);
  });

  slidesEl.addEventListener("scroll", ()=>{
    const slides = [...slidesEl.children].filter(x=>x.classList.contains("slide"));
    const mid = slidesEl.scrollLeft + slidesEl.clientWidth/2;
    let best = 0, bestDist = Infinity;
    slides.forEach((sl, i)=>{
      const cx = sl.offsetLeft + sl.clientWidth/2;
      const dist = Math.abs(cx - mid);
      if(dist < bestDist){ bestDist = dist; best = i; }
    });
    [...dotsEl.children].forEach((dot,i)=>dot.classList.toggle("active", i===best));
  }, {passive:true});
}

async function loadBanners(){
  const urls = await probeImagesSequential("banner", 1, 80);
  buildCarousel($("#bannerSlides"), $("#bannerDots"), urls);
}
$("#reloadBanners").addEventListener("click", loadBanners);

/* Kun savoli (demo winner local) */
function winnerKey(qIndex){
  const todayISO = new Date().toISOString().slice(0,10);
  return `lm_winner_${todayISO}_q${qIndex}`;
}
function getWinner(qIndex){
  try { return JSON.parse(localStorage.getItem(winnerKey(qIndex)) || "null"); } catch { return null; }
}
function setWinner(qIndex, obj){
  localStorage.setItem(winnerKey(qIndex), JSON.stringify(obj));
}
function showWinnerUI(w){
  if(!w){ $("#winnerBox").style.display = "none"; return; }
  $("#winnerBox").style.display = "block";
  $("#winnerName").textContent = w.name;
  const t = new Date(w.ts);
  $("#winnerMeta").textContent = `Savol #${w.qIndex} • ${t.toLocaleTimeString("uz-UZ")} • +1 ball`;
}

async function loadAnswersJson(){
  const r = await fetch(`kun-savoli/javob.json?v=${Date.now()}`);
  if(!r.ok) throw new Error("kun-savoli/javob.json topilmadi");
  return await r.json();
}
async function findMaxQuestionIndex(){
  const urls = await probeImagesSequential("kun-savoli", 1, 120);
  return urls.length ? urls.length : 1;
}
function getCorrectAnswer(qIndex){
  return answersMap?.[`${qIndex}.png`] ?? answersMap?.[String(qIndex)] ?? answersMap?.[qIndex];
}
async function loadQuestion(qIndex){
  $("#qImg").src = `kun-savoli/${qIndex}.png?v=${Date.now()}`;
  $("#answerInp").value = "";
  $("#ratingBox").style.display = "none";
  showWinnerUI(getWinner(qIndex));
  $("#qNote").innerHTML = `Kirish majburiy. Har bir to‘g‘ri javob = <b>1 ball</b>. (Savol #${qIndex})`;
}
async function submitAnswer(){
  if(!session?.user){
    lock(false); showOverlay("#authOverlay"); return;
  }
  const qIndex = currentQIndex;
  const userAns = normalizeAnswer($("#answerInp").value);
  if(!userAns) return alert("Javobni kiriting.");
  const correct = normalizeAnswer(getCorrectAnswer(qIndex) ?? "");
  if(!correct) return alert("javob.json da bu savol uchun javob topilmadi.");
  const ok = userAns === correct;
  const alreadyWinner = getWinner(qIndex);
  if(ok){
    if(!alreadyWinner){
      const u = session.user;
      const w = { id: u.loginId, name: `${u.firstName} ${u.lastName}`.trim(), ts: Date.now(), qIndex };
      setWinner(qIndex, w);
      showWinnerUI(w);
      alert("✅ TO‘G‘RI! Siz birinchi g‘olibsiz! (+1 ball)");
    }else{
      alert("✅ TO‘G‘RI! Lekin g‘olib allaqachon aniqlangan.");
    }
  }else{
    alert("❌ Noto‘g‘ri. Yana urinib ko‘ring.");
  }
}
$("#sendAnswer").addEventListener("click", submitAnswer);
$("#nextQuestion").addEventListener("click", async ()=>{
  const maxQ = await findMaxQuestionIndex();
  currentQIndex++;
  if(currentQIndex > maxQ) currentQIndex = 1;
  await loadQuestion(currentQIndex);
});
$("#showRating").addEventListener("click", ()=>{ loadLeaderboard().catch(()=>{}); });

let __lbInFlight = false;
async function loadLeaderboard(){
  // Login bo‘lmasa serverga urmaymiz (aks holda 401/500 spam bo‘ladi)
  if(!session?.user){
    lock(false);
    showOverlay("#authOverlay");
    return;
  }
  if(__lbInFlight) return;
  __lbInFlight = true;
  let out;
  try{
    out = await api("/leaderboard", {method:"GET", auth:true});
  }catch(err){
    // UI’da sokin ko‘rsatamiz
    alert("Reytingni yuklab bo‘lmadi: " + (err?.message || "xato"));
    throw err;
  }finally{
    __lbInFlight = false;
  }
  const rows = out.rows || [];
  const body = $("#ratingBody");
  body.innerHTML = "";
  if(!rows.length){
    body.innerHTML = `<tr><td colspan="3" style="color:var(--muted);font-weight:900">Hali reyting yo‘q</td></tr>`;
  }else{
    rows.forEach((r, i)=>{
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><span class="pill">${i+1}</span></td>
        <td style="font-weight:900">${escapeHtml(r.name)}</td>
        <td><span class="pill">${r.points}</span></td>
      `;
      body.appendChild(tr);
    });
  }
  $("#ratingBox").style.display = ($("#ratingBox").style.display==="none" ? "block" : "none");
}

/* INIT */
(async function init(){
  startClock();
  await loadRegions();
  fillRegionSelect($("#regionSel"), $("#districtSel"));
  fillRegionSelect($("#eRegionSel"), $("#eDistrictSel"));

  const avatarUrls = await probeImagesSequential("avatar", 1, 80);
  window.__avatarUrls = avatarUrls;
  buildAvatarPicker($("#avatars"), $("#avatarValue"), avatarUrls, "");
  buildAvatarPicker($("#eAvatars"), $("#eAvatarValue"), avatarUrls, "");

  await loadBanners();

  const now = new Date();
  const start = new Date(now.getFullYear(),0,0);
  const doy = Math.floor((now - start)/86400000);
  const maxQ = await findMaxQuestionIndex();
  currentQIndex = ((doy - 1) % maxQ) + 1;

  try{ answersMap = await loadAnswersJson(); }catch{ answersMap = {}; }
  await loadQuestion(currentQIndex);

  const token = loadToken();
  if(token){
    try{ await refreshMe(); lock(false); }
    catch{ clearToken(); lock(true); }
  }else{
    lock(true);
  }
  startSeasonFx();
})();


/* ===============================
   SEASON FX (Canvas, optimized)
=============================== */
/* ===============================
   SEASON FX — PREMIUM (SVG flakes)
=============================== */
function getSeason(date = new Date()){
  const m = date.getMonth() + 1;
  if(m===12 || m===1 || m===2) return "winter";
  if(m>=3 && m<=5) return "spring";
  if(m>=6 && m<=8) return "summer";
  return "autumn";
}

function startSeasonFx(){
  const canvas = document.getElementById("seasonFx");
  if(!canvas) return;

  const prefersReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  if(prefersReduced) return;

  const ctx = canvas.getContext("2d", { alpha:true });
  let W=0,H=0,DPR=1;
  let season = getSeason();
  let lastT = performance.now();
  const P = [];
  let mouseX = 0, mouseY = 0;

  // Gentle parallax with pointer
  window.addEventListener("pointermove",(e)=>{
    mouseX = (e.clientX / window.innerWidth) * 2 - 1;
    mouseY = (e.clientY / window.innerHeight) * 2 - 1;
  }, {passive:true});

  function resize(){
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = Math.floor(window.innerWidth);
    H = Math.floor(window.innerHeight);
    canvas.width  = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);
    canvas.style.width = W+"px";
    canvas.style.height= H+"px";
    ctx.setTransform(DPR,0,0,DPR,0,0);
  }
  window.addEventListener("resize", resize, {passive:true});
  resize();

  // Stylized snowflake (fast vector)
  function drawSnowflake(x,y,r,rot,alpha){
    ctx.save();
    ctx.translate(x,y);
    ctx.rotate(rot);
    ctx.globalAlpha = alpha;

    ctx.strokeStyle = "rgba(255,255,255,1)";
    ctx.lineWidth = Math.max(1, r*0.12);
    ctx.lineCap = "round";

    const arms = 6;
    for(let i=0;i<arms;i++){
      ctx.rotate(Math.PI*2/arms);

      ctx.beginPath();
      ctx.moveTo(0,0);
      ctx.lineTo(0, -r);
      ctx.stroke();

      // Branches
      ctx.beginPath();
      ctx.moveTo(0, -r*0.55);
      ctx.lineTo(r*0.18, -r*0.68);
      ctx.moveTo(0, -r*0.55);
      ctx.lineTo(-r*0.18, -r*0.68);

      ctx.moveTo(0, -r*0.78);
      ctx.lineTo(r*0.14, -r*0.88);
      ctx.moveTo(0, -r*0.78);
      ctx.lineTo(-r*0.14, -r*0.88);
      ctx.stroke();
    }

    // Center dot
    ctx.fillStyle = "rgba(255,255,255,1)";
    ctx.beginPath();
    ctx.arc(0,0, Math.max(1.2, r*0.12), 0, Math.PI*2);
    ctx.fill();

    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawPetal(x,y,r,rot,alpha,hue){
    ctx.save();
    ctx.translate(x,y);
    ctx.rotate(rot);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = `hsla(${hue}, 80%, 78%, 1)`;
    ctx.beginPath();
    ctx.ellipse(0,0, r*1.35, r*0.78, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawLeaf(x,y,r,rot,alpha,hue){
    ctx.save();
    ctx.translate(x,y);
    ctx.rotate(rot);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = `hsla(${hue}, 78%, 55%, 1)`;
    ctx.beginPath();
    ctx.ellipse(0,0, r*1.45, r*0.82, 0.6, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawSpark(x,y,r,alpha,hue,t){
    const pulse = 0.35 + 0.65*Math.sin((t/550) + (x+y)*0.002);
    ctx.globalAlpha = alpha * pulse;
    ctx.fillStyle = `hsla(${hue}, 95%, 62%, 1)`;
    ctx.fillRect(x,y,r,r);
    ctx.globalAlpha = 1;
  }

  function spawnCount(){
    const isSmall = Math.min(W,H) < 520;
    if(season==="summer") return isSmall ? 36 : 52;
    if(season==="winter") return isSmall ? 70 : 110;
    if(season==="spring") return isSmall ? 55 : 90;
    return isSmall ? 55 : 90; // autumn
  }

  function makeParticle(){
    const z = 0.6 + Math.random()*1.0; // depth
    const common = {
      x: Math.random()*W,
      y: Math.random()*H,
      z,
      r: 2,
      vx: 0,
      vy: 0,
      rot: Math.random()*Math.PI*2,
      vr: (Math.random()*2-1) * 0.6,
      sway: (Math.random()*2-1) * (0.25 + 0.35*z),
      a: 0.35 + Math.random()*0.55,
      t: Math.random()*1000
    };

    if(season==="winter"){
      common.kind="snow";
      common.r = (2.2 + Math.random()*4.8) * z;
      common.vy = (0.55 + Math.random()*1.25) * z;
      common.vx = (-0.12 + Math.random()*0.24);
      common.a  = 0.35 + Math.random()*0.45;
    }else if(season==="spring"){
      common.kind="petal";
      common.r = (3.0 + Math.random()*5.5) * z;
      common.vy = (0.45 + Math.random()*1.0) * z;
      common.vx = (-0.18 + Math.random()*0.36);
      common.a  = 0.35 + Math.random()*0.45;
      common.hue = 320 + Math.random()*38;
    }else if(season==="summer"){
      common.kind="spark";
      common.r = (1.2 + Math.random()*2.2) * z;
      common.vy = (0.12 + Math.random()*0.28) * z;
      common.vx = (-0.08 + Math.random()*0.16);
      common.a  = 0.18 + Math.random()*0.22;
      common.hue = 40 + Math.random()*26;
    }else{
      common.kind="leaf";
      common.r = (3.5 + Math.random()*6.2) * z;
      common.vy = (0.5 + Math.random()*1.15) * z;
      common.vx = (-0.22 + Math.random()*0.44);
      common.a  = 0.32 + Math.random()*0.48;
      common.hue = 16 + Math.random()*30;
    }

    return common;
  }

  function resetParticles(){
    P.length = 0;
    const n = spawnCount();
    for(let i=0;i<n;i++) P.push(makeParticle());
  }

  function ensureSeason(){
    const now = getSeason();
    if(now !== season){
      season = now;
      resetParticles();
    }
  }

  resetParticles();

  function step(t){
    ensureSeason();
    const dt = Math.min(34, t - lastT);
    lastT = t;

    ctx.clearRect(0,0,W,H);

    const wind = Math.sin(t/2400) * 0.22 + mouseX*0.12;

    for(const p of P){
      p.t += dt;

      const sway = Math.sin((p.t/900) + p.x*0.01) * p.sway;

      p.x += (p.vx + wind + sway) * (dt/16) * (0.8 + p.z*0.3);
      p.y += p.vy * (dt/16);
      p.rot += p.vr * (dt/900) * (0.8 + p.z*0.4);

      if(p.y > H + 40){ p.y = -30; p.x = Math.random()*W; }
      if(p.x < -60) p.x = W + 40;
      if(p.x > W + 60) p.x = -40;

      const px = p.x + mouseX * 10 * (p.z-0.6);
      const py = p.y + mouseY *  6 * (p.z-0.6);

      if(p.kind==="snow") drawSnowflake(px, py, p.r, p.rot, p.a);
      if(p.kind==="petal") drawPetal(px, py, p.r, p.rot, p.a, p.hue);
      if(p.kind==="leaf") drawLeaf(px, py, p.r, p.rot, p.a, p.hue);
      if(p.kind==="spark") drawSpark(px, py, p.r, p.a, p.hue, t);
    }

    requestAnimationFrame(step);
  }

  requestAnimationFrame(step);
}

