// app.js (rootda)
const API_BASE = "/.netlify/functions/api";

const state = {
  token: localStorage.getItem("lm_token") || "",
  user: null,
  revealPass: false,
};

function $(sel, root=document){ return root.querySelector(sel); }
function el(tag, attrs={}, children=[]){
  const n = document.createElement(tag);
  Object.entries(attrs).forEach(([k,v])=>{
    if (k === "class") n.className = v;
    else if (k === "html") n.innerHTML = v;
    else n.setAttribute(k, v);
  });
  children.forEach(c=> n.appendChild(c));
  return n;
}

async function api(path, opts={}){
  const headers = Object.assign(
    { "Content-Type": "application/json" },
    opts.headers || {}
  );
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  const res = await fetch(API_BASE + path, { ...opts, headers });
  const data = await res.json().catch(()=> ({}));
  if (!res.ok) throw new Error(data.error || "Xatolik");
  return data;
}

function mountChrome(){
  const topbar = el("div", { class:"topbar" });
  topbar.appendChild(el("div", { class:"topbar-inner container", html: `
    <a class="brand" href="index.html">
      <div class="logo"></div>
      <div>
        <h1>Leader Platform</h1>
        <p>ID+Parol • Test • Simulator • Game</p>
      </div>
    </a>

    <div style="display:flex;gap:10px;align-items:center">
      <div class="pills" id="pills"></div>
      <div class="userchip" id="userchip" role="button" tabindex="0">
        <div class="avatar" id="avatar">?</div>
        <div class="meta">
          <b id="chipName">Mehmon</b>
          <span id="chipSub">Kirish/ID olish</span>
        </div>
      </div>
    </div>
  `}));
  document.body.prepend(topbar);

  const nav = el("div", { class:"bottomnav" });
  nav.appendChild(el("div", { class:"navrow container", html: `
    <a class="navbtn" data-page="index.html" href="index.html">
      <div class="navicon">🏠</div><div class="navtxt"><b>Bosh sahifa</b><span>banner/card</span></div>
    </a>
    <a class="navbtn" data-page="test.html" href="test.html">
      <div class="navicon">🧪</div><div class="navtxt"><b>Test</b><span>imtihon</span></div>
    </a>
    <a class="navbtn" data-page="simulator.html" href="simulator.html">
      <div class="navicon">🧠</div><div class="navtxt"><b>Simulator</b><span>mashq</span></div>
    </a>
    <a class="navbtn" data-page="game.html" href="game.html">
      <div class="navicon">🎮</div><div class="navtxt"><b>Game</b><span>o‘yin</span></div>
    </a>
  `}));
  document.body.appendChild(nav);

  const cur = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".navbtn").forEach(a=>{
    if (a.getAttribute("data-page") === cur) a.classList.add("active");
  });

  document.body.appendChild(authModal());
  document.body.appendChild(profileModal());

  $("#userchip").addEventListener("click", ()=>{
    if (state.user) openProfile();
    else openAuth();
  });
  $("#userchip").addEventListener("keydown", (e)=>{
    if (e.key === "Enter" || e.key === " ") $("#userchip").click();
  });
}

function authModal(){
  const m = el("div", { class:"modal", id:"authModal" });
  m.appendChild(el("div", { class:"sheet", html: `
    <header>
      <b>Hisobga kirish / ID olish</b>
      <button id="authClose">✕</button>
    </header>
    <div class="body">
      <div class="card" style="padding:12px">
        <h3 style="margin:0 0 10px">Kirish (ID + Parol)</h3>
        <div class="field">
          <label>ID</label>
          <input id="loginId" inputmode="numeric" placeholder="1000">
        </div>
        <div class="field">
          <label>Parol</label>
          <input id="loginPass" type="password" placeholder="••••••">
        </div>
        <div class="err" id="loginErr" style="display:none"></div>
        <div class="btnrow">
          <button class="btn primary" id="btnLogin">Kirish</button>
          <button class="btn" id="btnGoRegister">ID olish</button>
        </div>
      </div>

      <div class="card" id="regCard" style="padding:12px; display:none; margin-top:12px">
        <h3 style="margin:0 0 10px">Yangi foydalanuvchi (ID olish)</h3>

        <div class="field">
          <label>Parol</label>
          <input id="regPass1" type="password" placeholder="kamida 6 belgi">
        </div>
        <div class="field">
          <label>Takror parol</label>
          <input id="regPass2" type="password" placeholder="parolni qayta kiriting">
        </div>
        <div class="field">
          <label>Ism</label>
          <input id="regFirst" placeholder="Sohibjon">
        </div>
        <div class="field">
          <label>Familiya</label>
          <input id="regLast" placeholder="Sattorov">
        </div>
        <div class="field">
          <label>Tug‘ilgan sana</label>
          <input id="regBirth" type="date">
        </div>

        <div class="err" id="regErr" style="display:none"></div>
        <div class="btnrow">
          <button class="btn primary" id="btnRegister">ID ni olish</button>
          <button class="btn" id="btnBackLogin">Orqaga</button>
        </div>

        <div class="small" style="margin-top:8px">
          Eslatma: ID 1000 dan boshlab avtomatik beriladi.
        </div>
      </div>
    </div>
  `}));

  m.addEventListener("click", (e)=>{ if (e.target === m) closeAuth(); });

  setTimeout(()=>{
    $("#authClose").onclick = closeAuth;
    $("#btnGoRegister").onclick = ()=>{
      $("#regCard").style.display = "block";
      $("#btnGoRegister").disabled = true;
    };
    $("#btnBackLogin").onclick = ()=>{
      $("#regCard").style.display = "none";
      $("#btnGoRegister").disabled = false;
    };

    $("#btnLogin").onclick = doLogin;
    $("#btnRegister").onclick = doRegister;
  }, 0);

  return m;
}

function profileModal(){
  const m = el("div", { class:"modal", id:"profileModal" });
  m.appendChild(el("div", { class:"sheet", html: `
    <header>
      <b>Profil — ID Card</b>
      <button id="profClose">✕</button>
    </header>
    <div class="body">
      <div class="idcard" id="idcardBox"></div>

      <div class="btnrow" style="margin-top:12px">
        <button class="btn" id="btnHideShowPass">👁 Parol</button>
        <button class="btn danger" id="btnLogout">Chiqish</button>
      </div>

      <div class="small" style="margin-top:10px">
        Profil tahrirlash hozircha yopiq (keyin admin/profil tizimini qo‘shamiz).
      </div>
    </div>
  `}));

  m.addEventListener("click", (e)=>{ if (e.target === m) closeProfile(); });

  setTimeout(()=>{
    $("#profClose").onclick = closeProfile;
    $("#btnLogout").onclick = logout;
    $("#btnHideShowPass").onclick = ()=>{
      state.revealPass = !state.revealPass;
      renderIdCard();
    };
  }, 0);

  return m;
}

function openAuth(){ $("#authModal").classList.add("open"); }
function closeAuth(){ $("#authModal").classList.remove("open"); }
function openProfile(){ $("#profileModal").classList.add("open"); renderIdCard(); }
function closeProfile(){ $("#profileModal").classList.remove("open"); }

function setErr(id, msg){
  const box = $(id);
  box.style.display = msg ? "block" : "none";
  box.textContent = msg || "";
}

async function doRegister(){
  try{
    setErr("#regErr", "");
    const password = $("#regPass1").value.trim();
    const password2 = $("#regPass2").value.trim();
    const firstName = $("#regFirst").value.trim();
    const lastName = $("#regLast").value.trim();
    const birthDate = $("#regBirth").value;

    const r = await api("/auth/register", {
      method:"POST",
      body: JSON.stringify({ password, password2, firstName, lastName, birthDate })
    });

    $("#loginId").value = String(r.id);
    $("#loginPass").value = password;
    $("#regCard").style.display = "none";
    $("#btnGoRegister").disabled = false;

    alert(`✅ Sizning ID: ${r.id}\nEndi kirish tugmasini bosing.`);
  }catch(e){
    setErr("#regErr", e.message);
  }
}

async function doLogin(){
  try{
    setErr("#loginErr", "");
    const id = $("#loginId").value.trim();
    const password = $("#loginPass").value;

    const r = await api("/auth/login", {
      method:"POST",
      body: JSON.stringify({ id, password })
    });

    state.token = r.token;
    localStorage.setItem("lm_token", state.token);
    state.user = r.user;

    closeAuth();
    paintHeader();
  }catch(e){
    setErr("#loginErr", e.message);
  }
}

async function fetchMe(){
  if (!state.token) return null;
  try{
    const r = await api("/auth/me", { method:"GET" });
    state.user = r.user;
    return r.user;
  }catch{
    state.token = "";
    localStorage.removeItem("lm_token");
    state.user = null;
    return null;
  }
}

function logout(){
  state.token = "";
  localStorage.removeItem("lm_token");
  state.user = null;
  state.revealPass = false;
  closeProfile();
  paintHeader();
}

function paintHeader(){
  const pills = $("#pills");
  pills.innerHTML = "";

  if (!state.user){
    $("#avatar").textContent = "?";
    $("#chipName").textContent = "Mehmon";
    $("#chipSub").textContent = "Kirish/ID olish";
    return;
  }

  const u = state.user;
  $("#avatar").textContent = (u.firstName?.[0] || "U").toUpperCase();
  $("#chipName").textContent = `${u.firstName} ${u.lastName}`;
  $("#chipSub").textContent = `ID: ${u.id}`;

  pills.appendChild(el("div", { class:"pill", html:`💰 Balans: <b>${u.balance}</b>` }));
  pills.appendChild(el("div", { class:"pill", html:`⭐ Ball: <b>${u.points}</b>` }));
}

function renderIdCard(){
  if (!state.user) return;
  const u = state.user;

  const passShown = state.revealPass ? "******** (serverda hash)" : "••••••••";

  $("#idcardBox").innerHTML = `
    <div class="idcard-top">
      <div class="tag">LEADER • ID CARD</div>
      <div class="tag">ID: <b>${u.id}</b></div>
    </div>

    <div class="idcard-main">
      <div class="idphoto">${(u.firstName?.[0]||"U").toUpperCase()}</div>
      <div class="idlines">
        <div class="line"><span>Ism Familiya</span><b>${u.firstName} ${u.lastName}</b></div>
        <div class="line"><span>Tug‘ilgan sana</span><b>${u.birthDate}</b></div>
        <div class="line"><span>Balans</span><b>${u.balance}</b></div>
        <div class="line"><span>Ball</span><b>${u.points}</b></div>
        <div class="line">
          <span>Parol</span>
          <div class="passrow">
            <b>${passShown}</b>
            <button class="eye" onclick="window.__toggleEye()">👁</button>
          </div>
        </div>
      </div>
    </div>
  `;
  window.__toggleEye = ()=>{
    state.revealPass = !state.revealPass;
    renderIdCard();
  };
}

async function boot(){
  mountChrome();
  await fetchMe();
  paintHeader();
}

document.addEventListener("DOMContentLoaded", boot);
