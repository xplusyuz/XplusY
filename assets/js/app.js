// App: partials, header wiring, olympiad grid, balance demo, auth gate
async function includePartials(){
  const header = await fetch("partials/header.html").then(r=>r.text());
  const footer = await fetch("partials/footer.html").then(r=>r.text());
  document.getElementById("header-container").innerHTML = header;
  document.getElementById("footer-container").innerHTML = footer;
  wireHeader();
  renderAfterAuth(); // from user.js
  renderOlympiads();
  wireBalanceDemo();
}
function wireHeader(){
  const toggle = document.getElementById("menu-toggle");
  const panel = document.getElementById("side-panel");
  const close = document.getElementById("panel-close");
  toggle && toggle.addEventListener("click",()=>panel.classList.add("open"));
  close && close.addEventListener("click",()=>panel.classList.remove("open"));
  const btnLogin = document.getElementById("btn-login");
  const btnRegister = document.getElementById("btn-register");
  const loginModal = document.getElementById("login-modal");
  const registerModal = document.getElementById("register-modal");
  const openLogin = document.getElementById("open-login");
  const openRegister = document.getElementById("open-register");
  btnLogin && btnLogin.addEventListener("click", ()=> loginModal.showModal());
  btnRegister && btnRegister.addEventListener("click", ()=> registerModal.showModal());
  openLogin && openLogin.addEventListener("click", (e)=>{ e.preventDefault(); registerModal.close(); loginModal.showModal(); });
  openRegister && openRegister.addEventListener("click", (e)=>{ e.preventDefault(); loginModal.close(); registerModal.showModal(); });
}
window.wireHeader = wireHeader;

async function renderOlympiads(){
  const el = document.getElementById("olymp-grid");
  if(!el) return;
  let data = [];
  try{ data = await fetch("assets/data/competitions.json").then(r=>r.json()); }
  catch(e){
    data = [
      {id:"dtm-2025-try", tag:"DTM", title:"DTM 2025 sinov", when:"2025-09-20", fee:20000},
      {id:"sat-math", tag:"SAT", title:"SAT Math Practice", when:"2025-10-05", fee:30000},
      {id:"olimp-oq-phys", tag:"Olimpiada", title:"Fizika — O‘quvchilar", when:"2025-11-01", fee:25000},
      {id:"chsb-math", tag:"ChSB", title:"ChSB Matematika", when:"2025-09-28", fee:15000},
      {id:"milliy-uzb", tag:"Milliy", title:"Ona tili va adabiyot", when:"2025-09-15", fee:18000},
      {id:"bsb-chem", tag:"BSB", title:"Kimyo — BSB", when:"2025-12-10", fee:22000},
    ];
  }
  el.innerHTML = data.map(cardTemplate).join("");
  el.querySelectorAll("[data-join]").forEach(btn=>{
    btn.addEventListener("click", ()=>{ alert("Ro‘yxatdan o‘tish uchun — iltimos, kirish qiling. (Demo)"); });
  });
}
function cardTemplate(o){
  const d = new Date(o.when);
  const date = d.toLocaleDateString("uz-UZ", {year:"numeric", month:"short", day:"2-digit"});
  return `<article class="card">
    <span class="badge">${o.tag}</span>
    <h3>${o.title}</h3>
    <div class="meta"><span>📅 ${date}</span><span>💳 ${o.fee.toLocaleString("uz-UZ")} so‘m</span></div>
    <div class="row"><button class="btn" data-join="${o.id}">Ro‘yxatdan o‘tish</button><button class="btn ghost">Batafsil</button></div>
  </article>`;
}

// Balance demo
function wireBalanceDemo(){
  const amount = document.getElementById("balance-amount");
  if(!amount) return;
  document.querySelectorAll("[data-amount]").forEach(b=> b.addEventListener("click", ()=>{
    const val = Number((amount.dataset.val||"0")) + Number(b.dataset.amount||0);
    amount.dataset.val = String(val);
    amount.textContent = val.toLocaleString("uz-UZ") + " so‘m";
  }));
}

// ---- Auth gate (require login to use the site) ----
function ensureAuthGate(){
  const required = document.body.dataset.requireAuth !== "false";
  if(!required) return;
  const gate = document.createElement("div");
  gate.className = "auth-gate"; gate.style.display = "grid"; // show by default
  gate.innerHTML = `<div class="box">
    <h3>Kirish talab qilinadi</h3>
    <p class="muted">Platformadan foydalanish uchun hisobingizga kiring yoki ro‘yxatdan o‘ting.</p>
    <div class="row"><button class="btn ghost" id="gate-login">Kirish</button><button class="btn" id="gate-register">Registr</button></div>
  </div>`;
  document.body.appendChild(gate);
  function show(){ gate.style.display = "grid"; }
  function hide(){ gate.style.display = "none"; }
  document.addEventListener("click",(e)=>{
    const t = e.target;
    if(t && t.id === "gate-login"){ e.preventDefault(); document.getElementById("login-modal")?.showModal(); }
    else if(t && t.id === "gate-register"){ e.preventDefault(); document.getElementById("register-modal")?.showModal(); }
  });
  try{
    if(window.EXH && window.EXH.auth){
      window.EXH.auth.onAuthStateChanged((u)=>{ if(u) hide(); else show(); });
    } else {
      let tries = 0; const iv = setInterval(()=>{
        tries++;
        if(window.EXH && window.EXH.auth){ clearInterval(iv); window.EXH.auth.onAuthStateChanged((u)=>{ if(u) hide(); else show(); }); }
        else if(tries>20){ clearInterval(iv); }
      }, 150);
    }
  }catch(e){ console.warn("Gate error:", e?.message||e); show(); }
}
document.addEventListener("DOMContentLoaded", ()=>{ includePartials(); ensureAuthGate(); });
