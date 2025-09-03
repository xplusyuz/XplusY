
const $=(s,r=document)=>r.querySelector(s); const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));

function initMenu(){
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

async function ensureAds(){
  if(!document.querySelector("#ads-grid")){
    const mainContainer = document.querySelector("main .container") || document.querySelector(".container");
    if(mainContainer){
      const sec = document.createElement("section");
      sec.id = "ads-grid"; sec.className = "mt-2";
      mainContainer.appendChild(sec);
    }
  }
  try{
    const mod = await import("./ads.js");
    if(mod && typeof mod.renderAdsGrid === "function"){ mod.renderAdsGrid(); }
  }catch(e){ console.warn("ads.js load error:", e); }
}

document.addEventListener("DOMContentLoaded", ()=>{ initMenu(); ensureAds(); });
