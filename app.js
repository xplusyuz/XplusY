
/* LeaderMath — Zero v1 (front-end)
   Data source: localStorage (content + user profile)
   You can later replace ContentStore with Firebase/Supabase adapter.
*/

const $ = (q, el=document) => el.querySelector(q);
const $$ = (q, el=document) => [...el.querySelectorAll(q)];

const DEFAULT_CONTENT = {
  version: 1,
  updatedAt: new Date().toISOString(),
  pages: [
    {
      id: "home",
      title: "Bosh sahifa",
      subtitle: "Bannerlar + eng kerakli kartalar",
      chips: ["Hammasi","Yangi","Tavsiya","Gratis"],
      banners: [
        {
          title: "LeaderMath Premium",
          subtitle: "Matematika: testlar, darslar, simulyatorlar — barchasi bitta joyda.",
          image: "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1200&q=70",
          ctaLabel: "Boshlash",
          href: "#lessons"
        }
      ],
      cards: [
        { title:"1-kun: Algebra bazasi", desc:"Eng kerakli formulalar va tushunchalar. 15 daqiqalik qisqa dars.", tag:"Tavsiya", status:"ok", href:"#lessons" },
        { title:"Tezkor test — 10 savol", desc:"O'zingizni tekshirib ko'ring. Natija darhol.", tag:"Yangi", status:"ok", href:"#tests" },
        { title:"Reytinglar", desc:"Eng ko'p ball to'plaganlar ro'yxati. Motivatsiya!", tag:"Hammasi", status:"soon", href:"#leaderboard" }
      ]
    },
    {
      id: "lessons",
      title: "Darslar",
      subtitle: "Kategoriyalar bo'yicha tartiblab ko'ring",
      chips: ["Hammasi","Algebra","Geometriya","Olimpiada","DTM"],
      banners: [],
      cards: [
        { title:"Algebra: Kasrlar", desc:"Kasrli ifodalarni soddalashtirish va amaliy mashqlar.", tag:"Algebra", status:"ok", href:"#lessons" },
        { title:"Geometriya: Uchburchaklar", desc:"Asosiy teoremalar, isbotlar, masalalar.", tag:"Geometriya", status:"ok", href:"#lessons" },
        { title:"Olimpiada: Mantiq", desc:"Mantiqiy masalalar — bosqichma-bosqich yechim.", tag:"Olimpiada", status:"soon", href:"#lessons" },
        { title:"DTM: Tezkor konspekt", desc:"Eng ko'p tushadigan mavzular bo'yicha qisqa jamlanma.", tag:"DTM", status:"ok", href:"#lessons" }
      ]
    },
    {
      id: "tests",
      title: "Testlar",
      subtitle: "Kartalarni chiplar bilan filter qiling",
      chips: ["Hammasi","Oson","O'rta","Qiyin","Vaqtli"],
      banners: [
        {
          title:"Test Pro",
          subtitle:"Telefon uchun qulay: bitta qo'l bilan ishlaydigan test UX.",
          image:"https://images.unsplash.com/photo-1516979187457-637abb4f9353?auto=format&fit=crop&w=1200&q=70",
          ctaLabel:"Sinab ko'rish",
          href:"#tests"
        }
      ],
      cards: [
        { title:"Oson — 12 savol", desc:"Boshlovchilar uchun. 10 daqiqa.", tag:"Oson", status:"ok", href:"#tests" },
        { title:"O'rta — 15 savol", desc:"Standart daraja. 15 daqiqa.", tag:"O'rta", status:"ok", href:"#tests" },
        { title:"Qiyin — 10 savol", desc:"Olimpiada uslubida. 20 daqiqa.", tag:"Qiyin", status:"soon", href:"#tests" },
        { title:"Vaqtli challenge", desc:"Har savolga 30 soniya!", tag:"Vaqtli", status:"ok", href:"#tests" }
      ]
    },
    {
      id: "leaderboard",
      title: "Reyting",
      subtitle: "Demo: lokal reyting (keyin serverga ulash mumkin)",
      chips: ["Hammasi","Bugun","Hafta","Oy"],
      banners: [],
      cards: [
        { title:"Top 10", desc:"Reytinglar bu yerda chiqadi (demo).", tag:"Hammasi", status:"soon", href:"#leaderboard" }
      ]
    }
  ]
};

const ContentStore = {
  key: "lm_content_v1",
  load(){
    try{
      const raw = localStorage.getItem(this.key);
      if(!raw) return structuredClone(DEFAULT_CONTENT);
      const data = JSON.parse(raw);
      if(!data || !Array.isArray(data.pages)) return structuredClone(DEFAULT_CONTENT);
      return data;
    }catch(e){
      return structuredClone(DEFAULT_CONTENT);
    }
  },
  save(data){
    data.updatedAt = new Date().toISOString();
    localStorage.setItem(this.key, JSON.stringify(data));
  },
  reset(){
    localStorage.removeItem(this.key);
  }
};

const UserStore = {
  key:"lm_user_v1",
  load(){
    const raw = localStorage.getItem(this.key);
    if(raw){
      try{ return JSON.parse(raw);}catch(_){}
    }
    // auto-create ID + password
    const id = "LM" + Math.floor(100000 + Math.random()*900000);
    const pass = Array.from({length:8}, () => "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"[Math.floor(Math.random()*56)]).join("");
    const user = {
      id, password: pass,
      name: "Mehmon",
      phone: "",
      telegram: "",
      role: "student",
      region: "",
      school: "",
      points: 0,
      balance: 0,
      avatarText: "LM"
    };
    this.save(user);
    return user;
  },
  save(u){ localStorage.setItem(this.key, JSON.stringify(u)); },
  logout(){
    // keep content, reset user
    localStorage.removeItem(this.key);
  }
};

/* UI */
let content = ContentStore.load();
let user = UserStore.load();

const el = {
  nav: $("#navBar"),
  pageTitle: $("#pageTitle"),
  pageSubtitle: $("#pageSubtitle"),
  pills: $("#topPills"),
  chips: $("#chips"),
  grid: $("#grid"),
  userName: $("#userName"),
  userSub: $("#userSub"),
  avatar: $("#avatar"),
  modal: $("#profileModal"),
  modalTitle: $("#modalTitle"),
  closeModal: $("#closeModal"),
  formName: $("#f_name"),
  formPhone: $("#f_phone"),
  formTg: $("#f_tg"),
  formRole: $("#f_role"),
  formRegion: $("#f_region"),
  formSchool: $("#f_school"),
  formPass: $("#f_pass"),
  formNewPass: $("#f_newpass"),
  btnSaveProfile: $("#btnSaveProfile"),
  btnChangePass: $("#btnChangePass"),
  btnLogout: $("#btnLogout"),
  userIdBox: $("#userIdBox"),
  btnCopyCreds: $("#btnCopyCreds"),
  toast: $("#toast")
};

function toast(msg){
  el.toast.textContent = msg;
  el.toast.classList.add("show");
  clearTimeout(toast.t);
  toast.t = setTimeout(()=> el.toast.classList.remove("show"), 1800);
}

function setUserUI(){
  const name = (user.name || "Mehmon").trim();
  el.userName.textContent = name;
  el.userSub.textContent = `${user.id} • ${user.role || "student"}`;
  el.avatar.textContent = (user.avatarText || name || "LM").trim().slice(0,2).toUpperCase();
  el.userIdBox.innerHTML = `<span class="pill">ID: <b>${user.id}</b></span> <span class="pill">Parol: <b>${user.password}</b></span>`;
}

function iconSVG(kind){
  const map = {
    home:`<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 11.5 12 4l8 7.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-8.5Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`,
    lessons:`<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 19V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M4 19a2 2 0 0 0 2 2h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M8 8h8M8 12h8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
    tests:`<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M7 4h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" stroke="currentColor" stroke-width="1.8"/><path d="M8 9h8M8 13h5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M16.5 13.5 18 15l2.5-3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    leaderboard:`<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 20V10m6 10V4m6 16v-7m6 7v-9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`
  };
  return map[kind] || map.home;
}

function renderNav(activeId){
  el.nav.innerHTML = "";
  for(const p of content.pages){
    const btn = document.createElement("div");
    btn.className = "navbtn" + (p.id===activeId ? " active":"");
    btn.dataset.page = p.id;
    btn.innerHTML = `
      <div class="ico">${iconSVG(p.id)}</div>
      <div class="txt"><b>${p.title}</b><span>${p.subtitle || ""}</span></div>
    `;
    btn.addEventListener("click", ()=> navigate(p.id));
    el.nav.appendChild(btn);
  }
}

let currentPageId = (location.hash || "#home").slice(1);
if(!content.pages.some(p=>p.id===currentPageId)) currentPageId="home";

function renderChips(page, selected){
  el.chips.innerHTML = "";
  const chips = (page.chips && page.chips.length) ? page.chips : ["Hammasi"];
  chips.forEach(c=>{
    const b = document.createElement("div");
    b.className = "chip" + (c===selected ? " active":"");
    b.textContent = c;
    b.addEventListener("click", ()=>{
      renderPage(page.id, c);
    });
    el.chips.appendChild(b);
  });
}

function statusBadge(status){
  if(status==="ok") return `<span class="badge ok">✅ Tayyor</span>`;
  if(status==="soon") return `<span class="badge soon">⏳ Tez kunda</span>`;
  if(status==="lock") return `<span class="badge lock">🔒 Pro</span>`;
  return `<span class="badge">ℹ️</span>`;
}

function renderGrid(page, chip){
  el.grid.innerHTML = "";
  const grid = el.grid;

  // banners first
  for(const b of (page.banners||[])){
    const div = document.createElement("div");
    div.className = "banner";
    div.innerHTML = `
      <img src="${b.image}" alt="">
      <div class="overlay">
        <div class="in">
          <div>
            <h2>${escapeHtml(b.title||"")}</h2>
            <p>${escapeHtml(b.subtitle||"")}</p>
          </div>
          <button class="btn">${escapeHtml(b.ctaLabel||"Ko'rish")}</button>
        </div>
      </div>
    `;
    div.querySelector("button").addEventListener("click", ()=> safeGo(b.href||"#home"));
    grid.appendChild(div);
  }

  const cards = (page.cards||[]).filter(c=>{
    if(!chip || chip==="Hammasi") return true;
    return (c.tag||"Hammasi") === chip;
  });

  for(const c of cards){
    const div = document.createElement("div");
    div.className = "card";
    div.innerHTML = `
      <div class="in">
        <h3>${escapeHtml(c.title||"")}</h3>
        <p>${escapeHtml(c.desc||"")}</p>
        <div class="row">
          <div class="badges">
            ${statusBadge(c.status)}
            <span class="badge">#${escapeHtml(c.tag||"Hammasi")}</span>
          </div>
          <button class="btn ${c.status==="soon" ? "secondary":""}">${c.status==="soon" ? "Kutish":"Ochish"}</button>
        </div>
      </div>
    `;
    div.querySelector("button").addEventListener("click", ()=>{
      if(c.status==="soon"){ toast("Tez kunda 🔥"); return; }
      safeGo(c.href || "#home");
    });
    grid.appendChild(div);
  }

  if((page.banners||[]).length===0 && cards.length===0){
    const div = document.createElement("div");
    div.className="card";
    div.innerHTML = `<div class="in"><h3>Hozircha bo‘sh</h3><p>Admin panelda banner va card qo‘shing.</p><div class="row"><span class="small">admin.html orqali boshqariladi</span><a class="link" href="admin.html">Admin</a></div></div>`;
    grid.appendChild(div);
  }
}

function renderPage(pageId, chip="Hammasi"){
  currentPageId = pageId;
  const page = content.pages.find(p=>p.id===pageId) || content.pages[0];
  document.title = `LeaderMath — ${page.title}`;
  el.pageTitle.textContent = page.title;
  el.pageSubtitle.textContent = page.subtitle || "";
  renderNav(pageId);
  renderChips(page, chip);
  renderGrid(page, chip);
  history.replaceState(null,"",`#${pageId}`);
}

function navigate(pageId){
  renderPage(pageId, "Hammasi");
}

function safeGo(href){
  if(!href) return;
  if(href.startsWith("#")){
    navigate(href.slice(1));
  }else{
    window.open(href, "_blank", "noopener");
  }
}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, m=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m]));
}

/* profile modal */
function openModal(){
  el.modal.classList.add("open");
  el.modalTitle.textContent = "Profil";
  el.formName.value = user.name || "";
  el.formPhone.value = user.phone || "";
  el.formTg.value = user.telegram || "";
  el.formRole.value = user.role || "student";
  el.formRegion.value = user.region || "";
  el.formSchool.value = user.school || "";
  el.formPass.value = user.password || "";
  el.formNewPass.value = "";
}
function closeModal(){ el.modal.classList.remove("open"); }

el.avatar.addEventListener("click", openModal);
el.closeModal.addEventListener("click", closeModal);
el.modal.addEventListener("click", (e)=>{ if(e.target===el.modal) closeModal(); });

el.btnSaveProfile.addEventListener("click", ()=>{
  user.name = el.formName.value.trim() || "Mehmon";
  user.phone = el.formPhone.value.trim();
  user.telegram = el.formTg.value.trim();
  user.role = el.formRole.value;
  user.region = el.formRegion.value.trim();
  user.school = el.formSchool.value.trim();
  UserStore.save(user);
  setUserUI();
  toast("Saqlandi ✅");
});

el.btnChangePass.addEventListener("click", ()=>{
  const oldp = el.formPass.value.trim();
  const newp = el.formNewPass.value.trim();
  if(oldp !== user.password){
    toast("Eski parol noto'g'ri");
    return;
  }
  if(newp.length < 6){
    toast("Yangi parol kamida 6 belgi");
    return;
  }
  user.password = newp;
  UserStore.save(user);
  setUserUI();
  el.formNewPass.value="";
  toast("Parol yangilandi 🔒");
});

el.btnLogout.addEventListener("click", ()=>{
  UserStore.logout();
  user = UserStore.load();
  setUserUI();
  closeModal();
  toast("Chiqildi");
});

el.btnCopyCreds.addEventListener("click", async ()=>{
  const t = `LeaderMath\nID: ${user.id}\nParol: ${user.password}`;
  try{
    await navigator.clipboard.writeText(t);
    toast("Nusxalandi 📋");
  }catch(_){
    toast("Clipboard ruxsat yo'q");
  }
});

/* load content updates if admin changed it */
window.addEventListener("storage", (e)=>{
  if(e.key === ContentStore.key){
    content = ContentStore.load();
    renderPage(currentPageId, "Hammasi");
    toast("Kontent yangilandi");
  }
});

/* service worker */
if("serviceWorker" in navigator){
  window.addEventListener("load", ()=>{
    navigator.serviceWorker.register("sw.js").catch(()=>{});
  });
}

/* boot */
setUserUI();
renderPage(currentPageId, "Hammasi");

/* bg animation */
(function(){
  const c = document.getElementById("bgCanvas");
  const ctx = c.getContext("2d");
  let w=0,h=0, t=0;
  const symbols = ["π","∑","√","∞","≠","≤","≥","∫","θ","λ","x²","a/b","log","sin","cos","tan"];
  const dots = Array.from({length: 70}, ()=>({
    x: Math.random(),
    y: Math.random(),
    s: 10 + Math.random()*26,
    v: 0.15 + Math.random()*0.35,
    a: 0.08 + Math.random()*0.22,
    sym: symbols[Math.floor(Math.random()*symbols.length)]
  }));
  function resize(){
    w = c.width = window.innerWidth * devicePixelRatio;
    h = c.height = window.innerHeight * devicePixelRatio;
  }
  window.addEventListener("resize", resize, {passive:true});
  resize();

  function draw(){
    t += 0.01;
    ctx.clearRect(0,0,w,h);
    ctx.save();
    ctx.globalAlpha = 0.8;
    ctx.font = `${14*devicePixelRatio}px ui-sans-serif`;
    for(const p of dots){
      const px = p.x*w;
      const py = p.y*h;
      const wob = Math.sin(t*p.v + p.x*10)*10*devicePixelRatio;
      ctx.globalAlpha = p.a;
      ctx.fillStyle = "#CFF8DD";
      ctx.fillText(p.sym, px, py + wob);
      p.y += 0.00022 * p.v;
      if(p.y>1.05){ p.y=-0.05; p.x=Math.random(); p.sym=symbols[Math.floor(Math.random()*symbols.length)]; }
    }
    ctx.restore();
    requestAnimationFrame(draw);
  }
  draw();
})();
