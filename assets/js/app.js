import { refreshHeaderUI } from "./auth.js";
const $=(s,r=document)=>r.querySelector(s); const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
<<<<<<< HEAD

=======
>>>>>>> 960df9666f20cbe58c8e436b8447b04fa1cce72d
async function loadFragment(el,url){ const res=await fetch(url,{cache:"no-store"}); el.innerHTML=await res.text(); }

async function initLayout(){
  await loadFragment($("#header-slot"), "/components/header.html");
  await loadFragment($("#menu-slot"), "/components/menu.html");
  await loadFragment($("#footer-slot"), "/components/footer.html");

  // Drawer controls
  const drawer=document.querySelector(".drawer");
  const backdrop=document.querySelector(".drawer .backdrop");
  const openBtn=document.querySelector("#menuOpenBtn");
  const closeBtn=document.querySelector("#menuCloseBtn");
  openBtn?.addEventListener("click", ()=>drawer?.classList.add("open"));
  closeBtn?.addEventListener("click", ()=>drawer?.classList.remove("open"));
  backdrop?.addEventListener("click", ()=>drawer?.classList.remove("open"));

  // Active link
  const here = location.pathname.replace(/\/index\.html$/,"/");
  $$(".menu a").forEach(a=>{ const href=a.getAttribute("href"); if(!href) return; if(href===here || (href!=="/" && here.includes(href))) a.classList.add("active"); });

  // Banners (only on pages with #ads-slot)
  const slot = $("#ads-slot");
  if(slot){ await loadFragment(slot, "/components/banners.html"); }

  refreshHeaderUI();
}
document.addEventListener("DOMContentLoaded", initLayout);
