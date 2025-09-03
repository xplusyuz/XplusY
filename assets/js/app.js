const $=(s,r=document)=>r.querySelector(s); const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
async function loadFragment(el,url){ const res=await fetch(url,{cache:"no-store"}); el.innerHTML=await res.text(); }
async function hydrateFetchers(){}
  }));
}
async function initLayout(){
  await loadFragment($("#header-slot"), "components/header.html");
  await loadFragment($("#menu-slot"),   "components/menu.html");
  await loadFragment($("#footer-slot"), "components/footer.html");
  const drawer=document.querySelector(".drawer");
  const backdrop=document.querySelector(".drawer .backdrop");
  const openBtn=document.querySelector("#menuOpenBtn");
  const closeBtn=document.querySelector("#menuCloseBtn");
  openBtn?.addEventListener("click", ()=>drawer?.classList.add("open"));
  closeBtn?.addEventListener("click", ()=>drawer?.classList.remove("open"));
  backdrop?.addEventListener("click", ()=>drawer?.classList.remove("open"));
  const here = location.pathname.replace(/\\index\.html$/,"/");
  $$(".menu a").forEach(a=>{ const href=a.getAttribute("href"); if(!href) return; if(href===here || (href!=="/" && here.includes(href))) a.classList.add("active"); });
    // ads grid rendered by ads.js
