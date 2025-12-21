
/* LeaderMath — Zero v1 (admin)
   Controls banners + cards + chips per page.
   Storage: localStorage key "lm_content_v1"
*/

const $ = (q, el=document) => el.querySelector(q);
const $$ = (q, el=document) => [...el.querySelectorAll(q)];
const key = "lm_content_v1";

function load(){
  const raw = localStorage.getItem(key);
  if(!raw) return null;
  try{ return JSON.parse(raw);}catch(_){ return null; }
}
function save(data){
  data.updatedAt = new Date().toISOString();
  localStorage.setItem(key, JSON.stringify(data));
  ping("Saqlandi ✅");
}

function ping(msg){
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(ping.t);
  ping.t = setTimeout(()=> t.classList.remove("show"), 1600);
}

let data = load();
if(!data){
  // if no content created yet, load default from app.js expectation by importing from window? easiest: minimal skeleton
  data = { version: 1, updatedAt: new Date().toISOString(), pages: [] };
}

let selPage = null;
let selKind = "cards"; // "banners" | "cards" | "chips"
let selIdx = -1;

const el = {
  pages: $("#pages"),
  items: $("#items"),
  editorTitle: $("#editorTitle"),
  tabs: $("#tabs"),
  btnAddPage: $("#btnAddPage"),
  btnDelPage: $("#btnDelPage"),
  btnUpPage: $("#btnUpPage"),
  btnDownPage: $("#btnDownPage"),
  btnExport: $("#btnExport"),
  btnImport: $("#btnImport"),
  fileImport: $("#fileImport"),
  btnReset: $("#btnReset"),
  btnAddItem: $("#btnAddItem"),
  btnDelItem: $("#btnDelItem"),
  btnUpItem: $("#btnUpItem"),
  btnDownItem: $("#btnDownItem"),
  form: $("#editorForm"),
  toast: $("#toast")
};

function ensureDemoPages(){
  if(data.pages && data.pages.length) return;
  data.pages = [
    {id:"home", title:"Bosh sahifa", subtitle:"Bannerlar + eng kerakli kartalar", chips:["Hammasi","Yangi","Tavsiya","Gratis"], banners:[], cards:[]},
    {id:"lessons", title:"Darslar", subtitle:"Kategoriyalar bo'yicha tartiblab ko'ring", chips:["Hammasi","Algebra","Geometriya","Olimpiada","DTM"], banners:[], cards:[]},
    {id:"tests", title:"Testlar", subtitle:"Kartalarni chiplar bilan filter qiling", chips:["Hammasi","Oson","O'rta","Qiyin","Vaqtli"], banners:[], cards:[]},
    {id:"leaderboard", title:"Reyting", subtitle:"Demo: lokal reyting", chips:["Hammasi","Bugun","Hafta","Oy"], banners:[], cards:[]}
  ];
}
ensureDemoPages();
save(data);

function renderPages(){
  el.pages.innerHTML = "";
  data.pages.forEach((p, i)=>{
    const div = document.createElement("div");
    div.className = "item" + (selPage===i ? " active":"");
    div.innerHTML = `
      <div class="meta">
        <b>${escapeHtml(p.title || p.id)}</b>
        <span>#${p.id} • ${escapeHtml(p.subtitle||"")}</span>
      </div>
      <div class="row">
        <span class="pill"><b>${(p.banners||[]).length}</b> banner</span>
        <span class="pill"><b>${(p.cards||[]).length}</b> card</span>
      </div>
    `;
    div.addEventListener("click", ()=>{
      selPage=i; selIdx=-1;
      renderPages(); renderTabs(); renderItems(); renderEditor();
    });
    el.pages.appendChild(div);
  });
}

function renderTabs(){
  el.tabs.innerHTML = "";
  const tabs = [
    {id:"banners", label:"Bannerlar"},
    {id:"cards", label:"Cardlar"},
    {id:"chips", label:"Chiplar"},
    {id:"page", label:"Sahifa sozlamalari"}
  ];
  tabs.forEach(t=>{
    const b = document.createElement("div");
    b.className="tab"+(selKind===t.id?" active":"");
    b.textContent = t.label;
    b.addEventListener("click", ()=>{
      selKind=t.id; selIdx=-1;
      renderTabs(); renderItems(); renderEditor();
    });
    el.tabs.appendChild(b);
  });
}

function renderItems(){
  el.items.innerHTML = "";
  if(selPage===null) return;

  const p = data.pages[selPage];
  if(selKind==="banners"){
    (p.banners||[]).forEach((b, i)=>{
      const div=document.createElement("div");
      div.className="item"+(selIdx===i?" active":"");
      div.innerHTML = `
        <div class="meta">
          <b>${escapeHtml(b.title||"Banner")}</b>
          <span>${escapeHtml(b.subtitle||"")}</span>
        </div>
        <div class="row"><span class="pill">${escapeHtml(b.ctaLabel||"CTA")}</span></div>
      `;
      div.addEventListener("click", ()=>{ selIdx=i; renderItems(); renderEditor(); });
      el.items.appendChild(div);
    });
  }else if(selKind==="cards"){
    (p.cards||[]).forEach((c, i)=>{
      const div=document.createElement("div");
      div.className="item"+(selIdx===i?" active":"");
      div.innerHTML=`
        <div class="meta">
          <b>${escapeHtml(c.title||"Card")}</b>
          <span>${escapeHtml(c.tag||"Hammasi")} • ${escapeHtml(c.status||"")}</span>
        </div>
        <div class="row"><span class="pill">${escapeHtml(c.status||"")}</span></div>
      `;
      div.addEventListener("click", ()=>{ selIdx=i; renderItems(); renderEditor(); });
      el.items.appendChild(div);
    });
  }else{
    const div=document.createElement("div");
    div.className="note";
    if(selKind==="chips"){
      div.innerHTML = `Chiplar sahifadagi cardlarni filter qiladi. “Hammasi” bo‘lishi tavsiya.`;
    }else{
      div.innerHTML = `Sahifa sozlamalari: id, title, subtitle.`;
    }
    el.items.appendChild(div);
  }
}

function renderEditor(){
  if(selPage===null){
    el.editorTitle.textContent="Editor";
    el.form.innerHTML = `<div class="note">Chapdan sahifani tanlang.</div>`;
    return;
  }
  const p = data.pages[selPage];
  if(selKind==="banners"){
    el.editorTitle.textContent = "Banner editor";
    if(selIdx<0){
      el.form.innerHTML = `<div class="note">Banner tanlang yoki “+ Qo‘shish” bosing.</div>`;
      return;
    }
    const b = p.banners[selIdx];
    el.form.innerHTML = bannerForm(b);
    bindBannerForm(b);
  }else if(selKind==="cards"){
    el.editorTitle.textContent = "Card editor";
    if(selIdx<0){
      el.form.innerHTML = `<div class="note">Card tanlang yoki “+ Qo‘shish” bosing.</div>`;
      return;
    }
    const c = p.cards[selIdx];
    el.form.innerHTML = cardForm(c, p);
    bindCardForm(c, p);
  }else if(selKind==="chips"){
    el.editorTitle.textContent = "Chiplar";
    el.form.innerHTML = chipsForm(p);
    bindChipsForm(p);
  }else if(selKind==="page"){
    el.editorTitle.textContent = "Sahifa sozlamalari";
    el.form.innerHTML = pageForm(p);
    bindPageForm(p);
  }
}

function bannerForm(b){
  return `
    <div class="field"><label>Sarlavha</label><input id="b_title" value="${escAttr(b.title||"")}" /></div>
    <div class="field"><label>Tagline</label><textarea id="b_sub">${escapeHtml(b.subtitle||"")}</textarea></div>
    <div class="field"><label>Rasm URL (banner)</label><input id="b_img" value="${escAttr(b.image||"")}" placeholder="https://..." /></div>
    <div class="field"><label>CTA label</label><input id="b_cta" value="${escAttr(b.ctaLabel||"Ko'rish")}" /></div>
    <div class="field"><label>Havola (href)</label><input id="b_href" value="${escAttr(b.href||"#home")}" placeholder="#tests yoki https://..." /></div>
    <div class="row">
      <button class="btn" id="b_save">Saqlash</button>
      <button class="btn secondary" id="b_preview">Preview</button>
    </div>
  `;
}
function bindBannerForm(b){
  $("#b_save").addEventListener("click", ()=>{
    b.title = $("#b_title").value.trim();
    b.subtitle = $("#b_sub").value.trim();
    b.image = $("#b_img").value.trim();
    b.ctaLabel = $("#b_cta").value.trim();
    b.href = $("#b_href").value.trim();
    save(data); renderPages(); renderItems();
  });
  $("#b_preview").addEventListener("click", ()=>{
    const url = $("#b_img").value.trim();
    if(url) window.open(url,"_blank","noopener");
  });
}

function cardForm(c, p){
  const chips = (p.chips||[]).map(x=>`<option ${x===(c.tag||"Hammasi")?"selected":""}>${escapeHtml(x)}</option>`).join("");
  return `
    <div class="field"><label>Title</label><input id="c_title" value="${escAttr(c.title||"")}" /></div>
    <div class="field"><label>Description</label><textarea id="c_desc">${escapeHtml(c.desc||"")}</textarea></div>
    <div class="field"><label>Chip / Tag</label>
      <select id="c_tag">${chips}</select>
    </div>
    <div class="field"><label>Status</label>
      <select id="c_status">
        <option value="ok" ${c.status==="ok"?"selected":""}>ok (tayyor)</option>
        <option value="soon" ${c.status==="soon"?"selected":""}>soon (tez kunda)</option>
        <option value="lock" ${c.status==="lock"?"selected":""}>lock (pro)</option>
      </select>
    </div>
    <div class="field"><label>Href</label><input id="c_href" value="${escAttr(c.href||"#home")}" placeholder="#lessons yoki https://..." /></div>
    <div class="row">
      <button class="btn" id="c_save">Saqlash</button>
    </div>
  `;
}
function bindCardForm(c, p){
  $("#c_save").addEventListener("click", ()=>{
    c.title = $("#c_title").value.trim();
    c.desc = $("#c_desc").value.trim();
    c.tag = $("#c_tag").value;
    c.status = $("#c_status").value;
    c.href = $("#c_href").value.trim();
    save(data); renderPages(); renderItems();
  });
}

function chipsForm(p){
  return `
    <div class="note">Chiplar vergul bilan: <b>Hammasi, Algebra, ...</b></div>
    <div class="field"><label>Chiplar</label>
      <input id="p_chips" value="${escAttr((p.chips||[]).join(", "))}" />
    </div>
    <div class="row"><button class="btn" id="p_savechips">Saqlash</button></div>
  `;
}
function bindChipsForm(p){
  $("#p_savechips").addEventListener("click", ()=>{
    const arr = $("#p_chips").value.split(",").map(s=>s.trim()).filter(Boolean);
    if(!arr.includes("Hammasi")) arr.unshift("Hammasi");
    p.chips = [...new Set(arr)];
    // normalize card tags
    (p.cards||[]).forEach(c=>{ if(!p.chips.includes(c.tag)) c.tag="Hammasi"; });
    save(data); renderPages(); renderItems(); renderEditor();
  });
}

function pageForm(p){
  return `
    <div class="field"><label>id (latin, unique)</label><input id="p_id" value="${escAttr(p.id||"")}" /></div>
    <div class="field"><label>Title</label><input id="p_title" value="${escAttr(p.title||"")}" /></div>
    <div class="field"><label>Subtitle</label><input id="p_sub" value="${escAttr(p.subtitle||"")}" /></div>
    <div class="note">Diqqat: id o'zgarsa eski linklar (#id) ham o'zgaradi.</div>
    <div class="row"><button class="btn" id="p_save">Saqlash</button></div>
  `;
}
function bindPageForm(p){
  $("#p_save").addEventListener("click", ()=>{
    const nid = $("#p_id").value.trim();
    if(!/^[a-z0-9_-]{2,24}$/i.test(nid)){
      ping("id noto‘g‘ri (2-24, a-z0-9_-)");
      return;
    }
    // uniqueness
    const exists = data.pages.some((x, idx)=> idx!==selPage && x.id===nid);
    if(exists){ ping("Bu id band"); return; }
    p.id = nid;
    p.title = $("#p_title").value.trim();
    p.subtitle = $("#p_sub").value.trim();
    save(data); renderPages();
  });
}

/* Toolbar actions */
el.btnAddPage.addEventListener("click", ()=>{
  const nid = prompt("Yangi sahifa id (masalan: simulators)");
  if(!nid) return;
  if(!/^[a-z0-9_-]{2,24}$/i.test(nid)){ ping("id noto‘g‘ri"); return; }
  if(data.pages.some(p=>p.id===nid)){ ping("Bu id band"); return; }
  data.pages.push({ id:nid, title:nid, subtitle:"", chips:["Hammasi"], banners:[], cards:[] });
  selPage = data.pages.length-1;
  selKind="page"; selIdx=-1;
  save(data); renderPages(); renderTabs(); renderItems(); renderEditor();
});

el.btnDelPage.addEventListener("click", ()=>{
  if(selPage===null) return;
  const p = data.pages[selPage];
  if(!confirm(`Sahifa o‘chirilsinmi?\n#${p.id}`)) return;
  data.pages.splice(selPage,1);
  selPage = Math.min(selPage, data.pages.length-1);
  selIdx=-1;
  save(data); renderPages(); renderTabs(); renderItems(); renderEditor();
});

el.btnUpPage.addEventListener("click", ()=>{
  if(selPage===null || selPage===0) return;
  const a = data.pages;
  [a[selPage-1], a[selPage]] = [a[selPage], a[selPage-1]];
  selPage -= 1;
  save(data); renderPages();
});
el.btnDownPage.addEventListener("click", ()=>{
  if(selPage===null || selPage===data.pages.length-1) return;
  const a = data.pages;
  [a[selPage+1], a[selPage]] = [a[selPage], a[selPage+1]];
  selPage += 1;
  save(data); renderPages();
});

el.btnAddItem.addEventListener("click", ()=>{
  if(selPage===null) return;
  const p = data.pages[selPage];
  if(selKind==="banners"){
    p.banners = p.banners || [];
    p.banners.push({ title:"Yangi banner", subtitle:"", image:"", ctaLabel:"Ko'rish", href:`#${p.id}` });
    selIdx = p.banners.length-1;
  }else if(selKind==="cards"){
    p.cards = p.cards || [];
    p.cards.push({ title:"Yangi card", desc:"", tag:"Hammasi", status:"ok", href:`#${p.id}` });
    selIdx = p.cards.length-1;
  }else{
    ping("Bu bo‘limda item yo‘q");
    return;
  }
  save(data); renderPages(); renderItems(); renderEditor();
});

el.btnDelItem.addEventListener("click", ()=>{
  if(selPage===null || selIdx<0) return;
  const p = data.pages[selPage];
  const arr = selKind==="banners" ? p.banners : p.cards;
  if(!arr || !arr[selIdx]) return;
  if(!confirm("O‘chirilsinmi?")) return;
  arr.splice(selIdx,1);
  selIdx = Math.min(selIdx, arr.length-1);
  save(data); renderPages(); renderItems(); renderEditor();
});

el.btnUpItem.addEventListener("click", ()=>{
  if(selPage===null || selIdx<=0) return;
  const p = data.pages[selPage];
  const arr = selKind==="banners" ? p.banners : p.cards;
  [arr[selIdx-1], arr[selIdx]] = [arr[selIdx], arr[selIdx-1]];
  selIdx -= 1;
  save(data); renderPages(); renderItems();
});
el.btnDownItem.addEventListener("click", ()=>{
  if(selPage===null) return;
  const p = data.pages[selPage];
  const arr = selKind==="banners" ? p.banners : p.cards;
  if(!arr || selIdx<0 || selIdx>=arr.length-1) return;
  [arr[selIdx+1], arr[selIdx]] = [arr[selIdx], arr[selIdx+1]];
  selIdx += 1;
  save(data); renderPages(); renderItems();
});

/* import/export */
el.btnExport.addEventListener("click", ()=>{
  const blob = new Blob([JSON.stringify(data,null,2)], {type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `leaderMath-content-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});

el.btnImport.addEventListener("click", ()=> el.fileImport.click());
el.fileImport.addEventListener("change", async (e)=>{
  const f = e.target.files[0];
  if(!f) return;
  try{
    const txt = await f.text();
    const obj = JSON.parse(txt);
    if(!obj || !Array.isArray(obj.pages)) throw new Error("Invalid format");
    data = obj;
    selPage = 0; selKind="cards"; selIdx=-1;
    save(data); renderPages(); renderTabs(); renderItems(); renderEditor();
    ping("Import bo‘ldi ✅");
  }catch(err){
    ping("Import xato: " + err.message);
  }finally{
    e.target.value = "";
  }
});

el.btnReset.addEventListener("click", ()=>{
  if(!confirm("Kontentni tozalab, demo sahifalarni qayta yaratilsinmi?")) return;
  localStorage.removeItem(key);
  data = load() || {version:1, updatedAt:new Date().toISOString(), pages:[]};
  ensureDemoPages();
  selPage=0; selKind="cards"; selIdx=-1;
  save(data); renderPages(); renderTabs(); renderItems(); renderEditor();
});

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, m=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m]));
}
function escAttr(s){ return escapeHtml(String(s)).replace(/"/g,"&quot;"); }

/* init */
selPage = 0;
renderPages();
renderTabs();
renderItems();
renderEditor();
