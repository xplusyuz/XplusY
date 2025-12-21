const API="/api";const $=s=>document.querySelector(s);const $$=s=>Array.from(document.querySelectorAll(s));
let token=localStorage.getItem("lm_token")||"";
async function api(path,opts={}){const h={"Content-Type":"application/json",...(opts.headers||{})}; if(token) h.Authorization="Bearer "+token;
const r=await fetch(API+path,{...opts,headers:h});const d=await r.json().catch(()=>({})); if(!r.ok) throw new Error(d.error||"Xatolik"); return d;}
function setGreeting(me){
  const greet=$(".user-greeting"); if(greet){greet.style.display="block"; const n=greet.querySelector(".user-name"); if(n) n.textContent=me.profile?.firstName||me.id;}
  // If there is a profile button, we can set avatar later in modal.
}
function openRank(open){
  const p=document.getElementById("lmRankPanel"); if(!p) return;
  p.style.right=open?"0px":"-420px";
}
async function loadRank(){
  const list=document.getElementById("lmRankList"); if(!list) return;
  list.innerHTML='<div style="color:rgba(255,255,255,.7);padding:10px">Yuklanmoqda…</div>';
  const d=await api("/rank");
  list.innerHTML = d.items.map(u=>`
    <div style="display:flex;align-items:center;gap:10px;padding:10px 10px;border-radius:16px;border:1px solid rgba(255,255,255,.12);
      background:rgba(255,255,255,.06)">
      <div style="width:34px;text-align:center;font-weight:900;color:#fff">${u.place}</div>
      <div style="width:40px;height:40px;border-radius:999px;overflow:hidden;background:linear-gradient(135deg,#007AFF,#5856D6);flex:0 0 auto">
        ${u.avatarUrl?`<img src="${u.avatarUrl}" style="width:100%;height:100%;object-fit:cover">`:`<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900">${(u.name||u.id||'?')[0]}</div>`}
      </div>
      <div style="min-width:0;flex:1">
        <div style="font-weight:800;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${u.name||u.id}</div>
        <div style="font-size:12px;color:rgba(255,255,255,.65)">${u.id}</div>
      </div>
      <div style="font-weight:900;color:#fff">${u.points} pt</div>
    </div>`).join("");
}
async function ensureProfile(me){
  // Try to use existing profile modal from your design if it exists.
  // If not, use prompt-based minimal fallback.
  if(me.profileCompleted) return me;
  // try detect selects by id
  const modal=$(".profile-modal"); 
  if(modal){
    modal.classList.add("active");
    // fill fields if exist
    const fn=$(".form-input#pfFirst, #pfFirst, #firstName, #profile-first, input[name='firstName']") || null;
    // because user's design uses different ids, we don't assume; fallback to prompts:
  }
  const firstName=prompt("Ismingiz?"); if(!firstName) throw new Error("Profil kerak");
  const lastName=prompt("Familiyangiz?"); if(!lastName) throw new Error("Profil kerak");
  const birthDate=prompt("Tug'ilgan sana (YYYY-MM-DD)?"); if(!birthDate) throw new Error("Profil kerak");
  const reg=prompt("Viloyat? (masalan Namangan)"); if(!reg) throw new Error("Profil kerak");
  const dist=prompt("Tuman?"); if(!dist) throw new Error("Profil kerak");
  await api("/me/profile",{method:"POST",body:JSON.stringify({firstName,lastName,birthDate,region:reg,district:dist})});
  return await api("/me");
}
async function loadApp(){
  const app=await api("/app");
  // if your UI already has bottom nav .bottom-nav and .nav-item, we can fill it.
  const navWrap=$(".bottom-nav");
  if(navWrap){
    navWrap.innerHTML="";
    (app.nav||[]).forEach((n,idx)=>{
      const a=document.createElement("a");
      a.href="#"; a.className="nav-item"+(idx===0?" active":"");
      a.innerHTML=`<span class="nav-icon">${n.icon||"✨"}</span><span class="nav-text">${n.label||n.id}</span>`;
      a.onclick=(e)=>{e.preventDefault(); $$(".nav-item").forEach(x=>x.classList.remove("active")); a.classList.add("active"); renderSection(n.sectionId, app.sections[n.sectionId]);};
      navWrap.appendChild(a);
    });
  }
  // render first section into active page content if any
  const first=(app.nav||[])[0]; if(first) renderSection(first.sectionId, app.sections[first.sectionId]);
}
function renderSection(id, sec){
  if(!sec) return;
  // choose a container: first .page-content.active or first .page-content
  let page=$(".page-content.active")||$(".page-content"); 
  if(!page) return;
  page.classList.add("active"); // ensure visible
  // Create chips row if not exists
  let chips=page.querySelector(".lm-chips"); 
  if(!chips){ chips=document.createElement("div"); chips.className="ranking-filters lm-chips"; page.prepend(chips); }
  let grid=page.querySelector(".lm-grid");
  if(!grid){ grid=document.createElement("div"); grid.className="card-grid lm-grid"; page.appendChild(grid); }
  const all=[{id:"all",label:"Hammasi"}, ...(sec.chips||[]).filter(c=>c.id!=="all")];
  let active="all";
  const draw=()=>{
    chips.innerHTML="";
    all.forEach(c=>{
      const b=document.createElement("button"); b.className="filter-btn"+(c.id===active?" active":""); b.textContent=c.label;
      b.onclick=()=>{active=c.id; draw();}; chips.appendChild(b);
    });
    const items=(sec.items||[]).filter(it=>active==="all"?true:it.chipId===active);
    grid.innerHTML=items.map(it=>`
      <div class="card">
        <div class="card-header blue" style="height:110px;padding:0;display:flex;align-items:center;justify-content:center;overflow:hidden">
          ${it.imageUrl?`<img src="${it.imageUrl}" style="width:100%;height:100%;object-fit:cover">`:`<div class="card-icon">✨</div>`}
        </div>
        <div class="card-body">
          <div class="card-title">${it.title||""}</div>
          ${it.subtitle?`<div class="card-description">${it.subtitle}</div>`:`<div class="card-description"></div>`}
          <div class="card-meta">
            <div class="card-tag">${it.type||"CARD"}</div>
            <div class="card-arrow">→</div>
          </div>
        </div>
      </div>
    `).join("");
    // click
    Array.from(grid.querySelectorAll(".card")).forEach((el,i)=>{
      el.onclick=()=>{const it=items[i]; if(it?.href) window.location.href=it.href;};
    });
  };
  draw();
}
(async()=>{
  if(!token){ location.href="/login.html"; return; }
  try{
    const me=await api("/me");
    setGreeting(me);
    await ensureProfile(me);
    document.getElementById("lmRankOpen")?.addEventListener("click", async()=>{openRank(true); await loadRank();});
    document.getElementById("lmRankClose")?.addEventListener("click", ()=>openRank(false));
    await loadApp();
  }catch(e){
    console.error(e);
    localStorage.removeItem("lm_token");
    location.href="/login.html";
  }
})();