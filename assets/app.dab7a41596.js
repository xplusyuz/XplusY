const $=(s)=>document.querySelector(s);
const $$=(s)=>document.querySelectorAll(s);

const API_BASE="/api";
const TOKEN_KEY="lm_platform_token_v1";
let session=null;

function saveToken(t){localStorage.setItem(TOKEN_KEY,t);}
function loadToken(){return localStorage.getItem(TOKEN_KEY)||"";}
function clearToken(){localStorage.removeItem(TOKEN_KEY);}

async function api(path,{method="GET",body=null,auth=true}={}){
  const headers={"Content-Type":"application/json"};
  if(auth){
    const token=loadToken();
    if(token) headers["Authorization"]="Bearer "+token;
  }
  const res = await fetch(API_BASE+path,{
    method,
    headers,
    body: body ? JSON.stringify(body) : null
  });

  // Netlify function errors sometimes return HTML/text (not JSON). Read text first.
  const raw = await res.text();
  let data = {};
  if(raw){
    try{ data = JSON.parse(raw); }
    catch{
      data = { _raw: raw };
    }
  }

  if(!res.ok){
    const msg =
      (data && data.error) ? data.error :
      (data && data._raw) ? (String(data._raw).replace(/\s+/g,' ').trim().slice(0,160)) :
      `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.raw = raw;
    throw err;
  }

  if(data && data._raw){
    return { raw };
  }
  return data;
}

function formatUzDateTime(d){
  const date=d.toLocaleDateString("uz-UZ",{weekday:"long",year:"numeric",month:"long",day:"numeric"});
  const time=d.toLocaleTimeString("uz-UZ",{hour12:false});
  return `${date} • ${time}`;
}
function startClock(){
  const el=document.getElementById("todayLabel");
  if(!el) return;
  const tick=()=>el.textContent=formatUzDateTime(new Date());
  tick(); setInterval(tick,1000);
}

function showOverlay(sel){$(sel).classList.add("show");}
function hideOverlay(sel){$(sel).classList.remove("show");}

function setStatus(el,msg,ok=true){
  el.className="status show "+(ok?"ok":"bad");
  el.textContent=msg;
}
function clearStatus(el){el.className="status";el.textContent="";}

function initials(name){
  const s=String(name||"").trim();
  if(!s) return "LM";
  const parts=s.split(/\s+/).filter(Boolean);
  return (parts[0]?.[0]||"L").toUpperCase()+(parts[1]?.[0]||"M").toUpperCase();
}

function injectChrome(){
  const header=document.createElement("header");
  header.className="topbar";
  header.innerHTML=`
    <div class="brand">
      <div class="logo" title="LeaderMath">π</div>
      <div class="brandtext">
        <h1>LeaderMath Platform</h1>
        <p id="todayLabel">—</p>
      </div>
    </div>
    <div class="userArea">
      <button id="loginBtn" class="btn btn-primary">Kirish</button>
      <div id="chip" class="userchip" style="display:none;">
        <div class="avatarCircle" id="ava">LM</div>
        <div style="min-width:0">
          <div style="font-weight:1000;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" id="uname">—</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:2px">
            <span class="pill" id="pointsPill">0 ball</span>
            <span class="pill" id="balancePill">0 so'm</span>
          </div>
        </div>
        <button id="profileBtn" class="btn btn-ghost">Profil</button>
        <button id="logoutBtn" class="btn btn-ghost">Chiqish</button>
      </div>
    </div>`;
  document.body.prepend(header);

  const nav=document.createElement("div");
  nav.className="bottomNav";
  nav.innerHTML=`
    <div class="navRow">
      <a class="navItem" href="index.html" data-nav="index">🏠 Bosh sahifa</a>
      <a class="navItem" href="test.html" data-nav="test">🧪 Test</a>
      <a class="navItem" href="simulator.html" data-nav="sim">🧩 Simulator</a>
      <a class="navItem" href="game.html" data-nav="game">🎮 Game</a>
    </div>`;
  document.body.appendChild(nav);

  const overlays=document.createElement("div");
  overlays.innerHTML=`
  <div class="overlay" id="authOverlay">
    <div class="modal">
      <div class="mhead">
        <div>
          <h3>Kirish tizimi</h3>
          <div class="mini">Kirish: ID + Parol. Yangi bo‘lsangiz “ID olish” orqali ro‘yxatdan o‘ting.</div>
        </div>
        <button class="btn x" id="closeAuth">✕</button>
      </div>
      <div class="mbody">
        <div id="authStatus" class="status"></div>

        <div class="card" id="loginBox" style="padding:12px;border-radius:22px">
          <div style="font-weight:1000;margin-bottom:8px">Kirish</div>
          <div class="two">
            <input id="loginId" class="input" placeholder="ID (1000...)" />
            <input id="loginPass" class="input" type="password" placeholder="Parol" />
          </div>
          <div class="row" style="margin-top:10px">
            <button class="btn btn-primary" id="doLoginBtn">Kirish</button>
            <button class="btn btn-ghost" id="openSignup">ID olish</button>
          </div>
        </div>

        <div class="card" id="signupBox" style="padding:12px;border-radius:22px;display:none">
          <div style="font-weight:1000;margin-bottom:8px">ID olish (ro‘yxatdan o‘tish)</div>
          <div class="two">
            <input id="suPass" class="input" type="password" placeholder="Parol" />
            <input id="suPass2" class="input" type="password" placeholder="Parol (takror)" />
          </div>
          <div class="two" style="margin-top:10px">
            <input id="suFirst" class="input" placeholder="Ism" />
            <input id="suLast" class="input" placeholder="Familiya" />
          </div>
          <input id="suDobPicker" class="input" style="margin-top:10px" type="date" />
          <input id="suDob" type="hidden" />
          <div class="mini" style="margin-top:6px">Tug‘ilgan sana avtomatik DD:MM:YYYY formatga o‘tkaziladi.</div>
          <div class="row" style="margin-top:10px">
            <button class="btn btn-primary" id="doSignupBtn">ID berish</button>
            <button class="btn btn-ghost" id="closeSignup">Bekor</button>
          </div>
          <div class="mini" style="margin-top:6px">Parol serverda shifrlanib saqlanadi. Profil kartada ko‘zcha bilan ko‘rsatish mumkin.</div>
        </div>
      </div>
    </div>
  </div>

  <div class="overlay" id="profileOverlay">
    <div class="modal">
      <div class="mhead">
        <div>
          <h3>Profil (ID CARD)</h3>
          <div class="mini">Tahrirlash keyin qo‘shiladi. Hozir: ko‘rish + parolni ko‘zcha bilan ko‘rsatish.</div>
        </div>
        <button class="btn x" id="closeProfile">✕</button>
      </div>
      <div class="mbody">
        <div class="idCard">
          <div class="idTop">
            <div class="idAvatar" id="pAva">LM</div>
            <div>
              <div class="idName" id="pName">—</div>
              <div class="idSub" id="pSub">ID: —</div>
            </div>
          </div>

          <div class="kv">
            <div class="k">Tug‘ilgan sana</div><div class="v" id="pDob">—</div>
            <div class="k">Ball</div><div class="v" id="pPoints">—</div>
            <div class="k">Balans</div><div class="v" id="pBalance">—</div>
            <div class="k">Ro‘yxat sanasi</div><div class="v" id="pCreated">—</div>
          </div>

          <div class="passRow">
            <div style="flex:1">
              <div class="k">Parol</div>
              <div class="v" id="pPass">••••••</div>
            </div>
            <button class="eye" id="togglePass" title="Ko‘rsatish">👁</button>
          </div>
          <div class="mini">Eslatma: parolni ko‘rsatish xavfsizlik uchun keyin “tasdiqlash” bilan qilinadi. Hozir demo.</div>
        </div>

        <div class="row">
          <button class="btn btn-ghost" id="logoutBtn2">Chiqish</button>
          <button class="btn btn-primary" id="closeProfile2">Yopish</button>
        </div>
      </div>
    </div>
  </div>`;
  document.body.appendChild(overlays);

  const page=document.body.dataset.page||"";
  $$(".navItem").forEach(a=>a.classList.toggle("active", a.dataset.nav===page));
}

async function refreshMe(){
  const out=await api("/auth/me",{method:"GET",auth:true});
  session=out?.user||null;
  renderChip();
}

function renderChip(){
  const logged=!!session;
  const loginBtn=document.getElementById("loginBtn");
  const chip=document.getElementById("chip");
  if(!loginBtn||!chip) return;
  loginBtn.style.display=logged?"none":"inline-flex";
  chip.style.display=logged?"flex":"none";
  if(logged){
    const nm=`${session.firstName||""} ${session.lastName||""}`.trim();
    document.getElementById("uname").textContent=nm||("ID "+session.loginId);
    document.getElementById("ava").textContent=initials(nm||"LM");
    document.getElementById("pointsPill").textContent=(session.points||0)+" ball";
    document.getElementById("balancePill").textContent=(session.balance||0)+" so'm";
  }
}

function isValidDOB(s){
  const m=/^(\d{2}):(\d{2}):(\d{4})$/.exec(String(s||"").trim());
  if(!m) return false;
  const dd=+m[1], mm=+m[2], yy=+m[3];
  if(yy<1900||yy>new Date().getFullYear()) return false;
  if(mm<1||mm>12) return false;
  const dim=new Date(yy,mm,0).getDate();
  return dd>=1&&dd<=dim;
}
function dobFromISO(iso){
  // iso: YYYY-MM-DD
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso||"").trim());
  if(!m) return "";
  const yyyy=m[1], mm=m[2], dd=m[3];
  return `${dd}:${mm}:${yyyy}`;
}



function fillProfile(){
  if(!session) return;
  const nm=`${session.firstName||""} ${session.lastName||""}`.trim();
  document.getElementById("pAva").textContent=initials(nm||"LM");
  document.getElementById("pName").textContent=nm||("ID "+session.loginId);
  document.getElementById("pSub").textContent="ID: "+session.loginId;
  document.getElementById("pDob").textContent=session.dob||"—";
  document.getElementById("pPoints").textContent=(session.points||0)+" ball";
  document.getElementById("pBalance").textContent=(session.balance||0)+" so'm";
  document.getElementById("pCreated").textContent=session.createdAtText||"—";
  document.getElementById("pPass").textContent="••••••";
}

function wireUI(){
  const authOverlay=document.getElementById("authOverlay");
  const profileOverlay=document.getElementById("profileOverlay");
  const statusEl=document.getElementById("authStatus");
  const signupBox=document.getElementById("signupBox");
  const loginBox=document.getElementById("loginBox");

  function setAuthMode(mode){
    const isSignup = mode === "signup";
    if(loginBox) loginBox.style.display = isSignup ? "none" : "block";
    if(signupBox) signupBox.style.display = isSignup ? "block" : "none";
    clearStatus(statusEl);
  }
  setAuthMode("login");

  // DOB date-picker -> hidden DD:MM:YYYY
  const dobPicker = document.getElementById("suDobPicker");
  const dobHidden = document.getElementById("suDob");
  if(dobPicker && dobHidden){
    dobPicker.addEventListener("change", ()=>{
      dobHidden.value = dobFromISO(dobPicker.value);
    });
  }



  document.getElementById("loginBtn")?.addEventListener("click",()=>{ setAuthMode("login"); showOverlay("#authOverlay"); });
  document.getElementById("closeAuth")?.addEventListener("click",()=>{ setAuthMode("login"); hideOverlay("#authOverlay"); });
  authOverlay?.addEventListener("click",(e)=>{ if(e.target===authOverlay) hideOverlay("#authOverlay"); });

  document.getElementById("profileBtn")?.addEventListener("click",()=>{ fillProfile(); showOverlay("#profileOverlay"); });
  document.getElementById("closeProfile")?.addEventListener("click",()=>hideOverlay("#profileOverlay"));
  document.getElementById("closeProfile2")?.addEventListener("click",()=>hideOverlay("#profileOverlay"));
  profileOverlay?.addEventListener("click",(e)=>{ if(e.target===profileOverlay) hideOverlay("#profileOverlay"); });

  const logout=()=>{ clearToken(); session=null; renderChip(); showOverlay("#authOverlay"); };
  document.getElementById("logoutBtn")?.addEventListener("click",logout);
  document.getElementById("logoutBtn2")?.addEventListener("click",logout);

  document.getElementById("openSignup")?.addEventListener("click",()=>{ setAuthMode("signup"); });
  document.getElementById("closeSignup")?.addEventListener("click",()=>{ setAuthMode("login"); });

  document.getElementById("doLoginBtn")?.addEventListener("click",async()=>{
    clearStatus(statusEl);
    try{
      const loginId=document.getElementById("loginId").value.trim();
      const password=document.getElementById("loginPass").value;
      if(!loginId||!password) throw new Error("ID va parolni kiriting.");
      const out=await api("/auth/login",{method:"POST",auth:false,body:{loginId,password}});
      saveToken(out.token);
      await refreshMe();
      hideOverlay("#authOverlay");
    }catch(e){ setStatus(statusEl,"❌ "+e.message,false); }
  });

  const suPass = document.getElementById("suPass");
  const suPass2 = document.getElementById("suPass2");
  const doSignupBtn = document.getElementById("doSignupBtn");

  function syncSignupState(){
    if(!doSignupBtn) return;
    const p1 = suPass?.value || "";
    const p2 = suPass2?.value || "";
    const okLen = p1.length >= 6;
    const okEq  = p1 && p2 && (p1 === p2);
    doSignupBtn.disabled = !(okLen && okEq);
    doSignupBtn.style.opacity = doSignupBtn.disabled ? ".55" : "1";
  }
  suPass?.addEventListener("input", syncSignupState);
  suPass2?.addEventListener("input", syncSignupState);
  syncSignupState();

  document.getElementById("doSignupBtn")?.addEventListener("click",async()=>{
    clearStatus(statusEl);
    try{
      const password=document.getElementById("suPass").value;
      const password2=document.getElementById("suPass2").value;
      const firstName=document.getElementById("suFirst").value.trim();
      const lastName=document.getElementById("suLast").value.trim();
      const dobRaw=document.getElementById("suDob").value.trim(); // YYYY-MM-DD
      const dob = (()=> {
        if(!dobRaw) return "";
        const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(dobRaw);
        if(!m) return dobRaw;
        return `${m[3]}:${m[2]}:${m[1]}`;
      })();

      if(!password||password.length<6) throw new Error("Parol kamida 6 bo‘lsin.");
      if(password!==password2) throw new Error("Parol takror mos emas.");
      if(!firstName) throw new Error("Ism majburiy.");
      if(!lastName) throw new Error("Familiya majburiy.");
      if(!isValidDOB(dob)) throw new Error("Tug‘ilgan sana noto‘g‘ri (kalendar orqali tanlang).");

      const out=await api("/auth/signup",{method:"POST",auth:false,body:{password,firstName,lastName,dob}});
      saveToken(out.token);
      await refreshMe();
      setStatus(statusEl,`✅ ID berildi: ${out.loginId} (eslab qoling!)`,true);
      setTimeout(()=>hideOverlay("#authOverlay"),900);
    }catch(e){ setStatus(statusEl,"❌ "+e.message,false); }
  });

  let passShown=false;
  document.getElementById("togglePass")?.addEventListener("click",async()=>{
    if(!session) return;
    const el=document.getElementById("pPass");
    if(!passShown){
      try{
        const out=await api("/profile/password",{method:"GET",auth:true});
        el.textContent=out.password||"—";
        passShown=true;
      }catch(e){ el.textContent="••••••"; passShown=false; alert("Xato: "+e.message); }
    }else{
      el.textContent="••••••"; passShown=false;
    }
  });
}

(async function init(){
  injectChrome();
  startClock();
  wireUI();

  const token=loadToken();
  if(token){
    try{ await refreshMe(); }
    catch{ clearToken(); showOverlay("#authOverlay"); }
  }else{
    showOverlay("#authOverlay");
  }
})();