
const $=(s,r=document)=>r.querySelector(s); const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));

function absUrl(p){
  const baseEl = document.querySelector('base');
  const baseHref = baseEl ? baseEl.getAttribute('href') : '/';
  try{ return new URL(p.replace(/^\//,''), baseHref).href }catch{ return p }
}
async function loadFragment(el,url, fallback){
  try{
    const res=await fetch(absUrl(url), {cache:"no-store"});
    if(!res.ok) throw new Error(res.status+" "+res.statusText);
    el.innerHTML=await res.text();
  }catch(e){
    console.warn("Fragment yuklanmadi:", url, e);
    if(fallback) el.innerHTML = fallback;
  }
}
async function hydrateFetchers(){}
async function initLayout(){
  const headerFallback = `
  <div class="header">
    <div class="navbar container">
      <div class="header-row1">
        <div class="brand">
          <img src="assets/svg/examhouse-mark.svg" alt="ExamHouse mark" style="height:28px;width:28px"/>
          <span class="wordmark"><span class="wm-exam">Exam</span><span class="wm-house">House.uz</span></span>
        </div>
        <div class="header-right">
          <button class="btn btn-ghost" aria-label="Menyu">☰</button>
        </div>
      </div>
    </div>
  </div>`;
  const footerFallback = `
  <footer class="footer">
    <div class="container">
      <div class="brand">
        <img src="assets/svg/examhouse-mark.svg" alt="ExamHouse" style="height:28px;width:28px"/>
        <span class="wordmark"><span class="wm-exam">Exam</span><span class="wm-house">House.uz</span></span>
      </div>
      <p class="text-muted mt-2">Zamonaviy test va olimpiada platformasi.</p>
    </div>
  </footer>`;

  await loadFragment($("#header-slot"), "/components/header.html", headerFallback);
  await loadFragment($("#menu-slot"),   "/components/menu.html",  "");
  await loadFragment($("#footer-slot"), "/components/footer.html", footerFallback);

  const drawer=document.querySelector(".drawer");
  const backdrop=document.querySelector(".drawer .backdrop");
  const openBtn=document.querySelector("#menuOpenBtn");
  const closeBtn=document.querySelector("#menuCloseBtn");
  openBtn?.addEventListener("click", ()=>drawer?.classList.add("open"));
  closeBtn?.addEventListener("click", ()=>drawer?.classList.remove("open"));
  backdrop?.addEventListener("click", ()=>drawer?.classList.remove("open"));

  const here = location.pathname.replace(/\\index\\.html$/,"/");
  $$(".menu a").forEach(a=>{ const href=a.getAttribute("href"); if(!href) return; if(href===here || (href!=="/" && here.includes(href))) a.classList.add("active"); });
}

  // Ensure ads grid exists and render cards
  if(!document.querySelector("#ads-grid")){
    const mainContainer = document.querySelector("main .container") || document.querySelector(".container");
    if(mainContainer){
      const sec = document.createElement("section");
      sec.id = "ads-grid";
      sec.className = "mt-2";
      mainContainer.appendChild(sec);
    }
  }
  try{
    const mod = await import("./ads.js");
    if(mod && typeof mod.renderAdsGrid === "function"){ mod.renderAdsGrid(); }
  }catch(e){ console.warn("ads.js yuklanmadi:", e); }

document.addEventListener("DOMContentLoaded", initLayout);
