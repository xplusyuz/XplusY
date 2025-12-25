// LeaderMath — app.js
const $ = (s)=>document.querySelector(s);
const $$ = (s)=>document.querySelectorAll(s);

const API_BASE = "/api";
const TOKEN_KEY = "lm_token_v1";
let session = null;
let regionsData = null;
let answersMap = null;
let currentQIndex = 1;

$("#todayLabel").textContent = "Bugun: " + new Date().toLocaleDateString("uz-UZ", {
  weekday:"long", year:"numeric", month:"long", day:"numeric"
});

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
$("#lockLogin").addEventListener("click", ()=>showOverlay("#authOverlay"));

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
  showOverlay("#authOverlay");
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
    showOverlay("#authOverlay"); lock(true); return;
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

async function loadLeaderboard(){
  const out = await api("/leaderboard", {method:"GET", auth:true});
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
    catch{ clearToken(); lock(true); showOverlay("#authOverlay"); }
  }else{
    lock(true); showOverlay("#authOverlay");
  }
})();
