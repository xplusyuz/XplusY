const API="/api";const $=id=>document.getElementById(id);
const state={token:localStorage.getItem("lm_token")||"",idDraft:"",app:null,activeNav:null,activeChip:"all"};
async function api(p,o={}){const h={"Content-Type":"application/json",...(o.headers||{})};if(state.token)h.Authorization=`Bearer ${state.token}`;
const r=await fetch(API+p,{...o,headers:h});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||"Xatolik");return d;}
function show(s){$("stepId").hidden=s!=="id";$("stepPw").hidden=s!=="pw";$("stepCreate").hidden=s!=="create";}
function modal(id,on){$(id).setAttribute("aria-hidden",on?"false":"true");}
async function loadRegions(){const r=await fetch("region.json").then(x=>x.json());
const reg=$("pfRegion");reg.innerHTML=`<option value="">Tanlang</option>`+Object.keys(r).map(k=>`<option>${k}</option>`).join("");
const fill=()=>{const arr=r[reg.value]||[];$("pfDistrict").innerHTML=`<option value="">Tanlang</option>`+arr.map(x=>`<option>${x}</option>`).join("");};reg.onchange=fill;fill();}
function setChip(me){$("userChip").hidden=false;$("uHello").textContent=("Salom! "+(me.profile?.firstName||"")).trim()||"Salom!";
$("uId").textContent=me.id;$("uPts").textContent=(me.points||0)+" pt";$("uAge").textContent=me.age==null?"—":me.age+" yosh";
$("uAvatar").src=me.avatarUrl||"";}
async function ensure(){const me=await api("/me");setChip(me);if(!me.profileCompleted){await loadRegions();modal("profileModal",true);} else {modal("profileModal",false);await loadApp();}}
function renderNav(){const el=$("bottomNav");el.hidden=false;el.innerHTML="";(state.app.nav||[]).forEach(n=>{const b=document.createElement("button");b.className="navBtn";b.innerHTML=`<div class="i">${n.icon||"✨"}</div><div class="t">${n.label||n.id}</div>`;b.onclick=()=>activate(n.id);el.appendChild(b);});}
function setActiveNav(id){document.querySelectorAll(".navBtn").forEach((b,i)=>{const n=state.app.nav[i];b.classList.toggle("active",n.id===id);});}
function renderChips(sec){const el=$("chips");el.innerHTML="";const chips=sec.chips?.length?sec.chips:[{id:"all",label:"Hammasi"}];
chips.forEach(c=>{const b=document.createElement("button");b.className="chip"+(c.id===state.activeChip?" active":"");b.textContent=c.label;b.onclick=()=>{state.activeChip=c.id;renderChips(sec);renderFeed(sec);};el.appendChild(b);});}
function renderFeed(sec){const el=$("feed");el.innerHTML="";const items=(sec.items||[]).filter(it=>state.activeChip==="all"?true:it.chipId===state.activeChip);
items.forEach(it=>{const d=document.createElement("div");d.className="item";d.innerHTML=`${it.imageUrl?`<img class="itemImg" src="${it.imageUrl}">`:""}
<div class="itemBody"><div class="itemTitle">${it.title||""}</div>${it.subtitle?`<div class="itemSub">${it.subtitle}</div>`:""}
${it.href?`<a class="itemBtn" href="${it.href}">Ochish →</a>`:""}</div>`;el.appendChild(d);});}
async function loadApp(){ $("authCard").hidden=true; $("content").hidden=false;
const cache=JSON.parse(localStorage.getItem("lm_app_cache")||"null");const remote=await api("/app");
state.app=(cache&&cache.version===remote.version)?cache:remote;localStorage.setItem("lm_app_cache",JSON.stringify(state.app));
renderNav();const first=state.app.nav?.[0];if(first)activate(first.id);}
function activate(navId){state.activeNav=navId;setActiveNav(navId);
const n=(state.app.nav||[]).find(x=>x.id===navId);const sec=state.app.sections[n.sectionId];state.activeChip="all";renderChips(sec);renderFeed(sec);}
async function openRank(on){$("rankPanel").classList.toggle("open",on); if(on){const d=await api("/rank");$("rankList").innerHTML=d.items.map(u=>`
<div class="rankRow"><div class="rankPlace">${u.place}</div><img class="rankAv" src="${u.avatarUrl||""}"><div><div class="rankName">${u.name||u.id}</div>
<div style="font-size:11px;color:rgba(255,255,255,.65)">${u.id}</div></div><div class="rankPts">${u.points} pt</div></div>`).join("");}}
function menuOpen(a){const m=$("userMenu"),r=a.getBoundingClientRect();m.style.left=Math.max(10,Math.min(window.innerWidth-280,r.right-260))+"px";m.style.top=(r.bottom+10)+"px";m.classList.add("open");}
function menuClose(){ $("userMenu").classList.remove("open");}
$("btnStart").onclick=async()=>{const id=$("loginId").value.trim().toUpperCase(); if(!id) return;
const s=await api("/auth/login-step1",{method:"POST",body:JSON.stringify({id})}); if(!s.exists){$("loginErr").hidden=false;$("loginErr").textContent="Bunday ID topilmadi. “Men yangiman” ni bosing."; return;}
state.idDraft=id; $("pillId").textContent=id; $("loginErr").hidden=true; show("pw"); $("loginPw").focus();};
$("btnBack").onclick=()=>show("id");
$("btnLogin").onclick=async()=>{ $("loginErr").hidden=true; try{const t=await api("/auth/login",{method:"POST",body:JSON.stringify({id:state.idDraft,password:$("loginPw").value})});
state.token=t.token; localStorage.setItem("lm_token",state.token); await ensure();}catch(e){$("loginErr").hidden=false;$("loginErr").textContent=e.message;}};
$("btnNew").onclick=()=>{show("create"); $("pwWarn").hidden=true;};
$("btnCreate").onclick=async()=>{ $("pwWarn").hidden=true; try{const pw=($("newPw").value||"").toString();
const r=await api("/auth/new",{method:"POST",body:JSON.stringify({password:pw})}); state.token=r.token; localStorage.setItem("lm_token",state.token);
$("pwWarn").hidden=false; $("pwWarn").textContent=("✅ Yangi ID: "+r.id)+(r.warnings?.length?("\n⚠️ "+r.warnings.join(" ")):""); await ensure();}catch(e){$("pwWarn").hidden=false;$("pwWarn").textContent=e.message;}};
$("btnSaveProfile").onclick=async()=>{ $("profileErr").hidden=true; try{await api("/me/profile",{method:"POST",body:JSON.stringify({firstName:$("pfFirst").value,lastName:$("pfLast").value,birthDate:$("pfBirth").value,region:$("pfRegion").value,district:$("pfDistrict").value})});
modal("profileModal",false); await loadApp();}catch(e){$("profileErr").hidden=false;$("profileErr").textContent=e.message;}};
$("rankTab").onclick=()=>openRank(true); $("rankClose").onclick=()=>openRank(false);
$("userChip").onclick=(e)=>{e.stopPropagation();menuOpen($("userChip"));}; document.addEventListener("click",menuClose);
$("miLogout").onclick=()=>{localStorage.removeItem("lm_token");localStorage.removeItem("lm_app_cache");location.reload();};
$("miAvatar").onclick=()=>{menuClose();modal("avatarModal",true);$("avOk").hidden=true;$("avUrl").value="";};
$("btnSaveAvatar").onclick=async()=>{const url=$("avUrl").value.trim(); await api("/me/avatar",{method:"POST",body:JSON.stringify({avatarUrl:url})});
$("avOk").hidden=false;$("avOk").textContent="✅ Saqlandi!"; setTimeout(()=>{modal("avatarModal",false); ensure();},500);};
(async()=>{ if(state.token){try{await ensure();}catch{localStorage.removeItem("lm_token");state.token="";show("id");}} else show("id");})();