import { refreshHeaderUI } from "./auth.js";
const $=(s,r=document)=>r.querySelector(s); const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
async function loadFragment(el,url){ const res=await fetch(url,{cache:"no-store"}); el.innerHTML=await res.text(); }
function base(){ const b = document.querySelector('base'); return b ? b.getAttribute('href') || '/' : '/'; }
async function initLayout(){
  await loadFragment($("#header-slot"), base()+"components/header.html");
  await loadFragment($("#menu-slot"),   base()+"components/menu.html");
  await loadFragment($("#footer-slot"), base()+"components/footer.html");
  const drawer=document.querySelector(".drawer");
  const backdrop=document.querySelector(".drawer .backdrop");
  const closeBtn=document.querySelector("#menuCloseBtn");
  document.addEventListener("click",(e)=>{
    const t=e.target;
    if(t && (t.id==="menuOpenBtn" || t.closest("#menuOpenBtn"))) drawer?.classList.add("open");
    if(t && (t.id==="menuCloseBtn"|| t.closest("#menuCloseBtn") || t===backdrop)) drawer?.classList.remove("open");
  });
  const here = location.pathname.replace(/\/index\.html$/,"/");
  $$(".menu a").forEach(a=>{ const href=a.getAttribute("href"); if(!href) return; if(href===here || (href!=="/" && here.includes(href))) a.classList.add("active"); });
  const slot = $("#ads-slot"); if(slot){ await loadFragment(slot, base()+"components/banners.html"); }
  refreshHeaderUI();
}
document.addEventListener("DOMContentLoaded", initLayout);
