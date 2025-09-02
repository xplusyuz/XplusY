// ExamHouse — App
// Inject partials + UI interactions + demo content
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
  if(toggle) toggle.addEventListener("click",()=>panel.classList.add("open"));
  if(close) close.addEventListener("click",()=>panel.classList.remove("open"));

  // Open auth modals
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

async function renderOlympiads(){
  const el = document.getElementById("olymp-grid");
  if(!el) return;
  let data = [];
  try{
    data = await fetch("assets/data/competitions.json").then(r=>r.json());
  }catch(e){
    // fallback
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
    btn.addEventListener("click", ()=>{
      // Demo only
      alert("Ro‘yxatdan o‘tish uchun — iltimos, kirish qiling. (Demo)")
    });
  });
}

function cardTemplate(o){
  const d = new Date(o.when);
  const date = d.toLocaleDateString("uz-UZ", {year:"numeric", month:"short", day:"2-digit"});
  return `<article class="card">
    <span class="badge">${o.tag}</span>
    <h3>${o.title}</h3>
    <div class="meta">
      <span>📅 ${date}</span>
      <span>💳 ${o.fee.toLocaleString("uz-UZ")} so‘m</span>
    </div>
    <div class="row">
      <button class="btn" data-join="${o.id}">Ro‘yxatdan o‘tish</button>
      <button class="btn ghost">Batafsil</button>
    </div>
  </article>`;
}

// Simple demo balance buttons on balans.html
function wireBalanceDemo(){
  const amount = document.getElementById("balance-amount");
  if(!amount) return;
  const btns = document.querySelectorAll("[data-amount]");
  btns.forEach(b=> b.addEventListener("click", ()=>{
    const val = Number((amount.dataset.val||"0")) + Number(b.dataset.amount||0);
    amount.dataset.val = String(val);
    amount.textContent = val.toLocaleString("uz-UZ") + " so‘m";
    // If logged in, you can call userUpdateBalanceDelta(valDelta) here
  }));
}

document.addEventListener("DOMContentLoaded", includePartials);

window.wireHeader = wireHeader;