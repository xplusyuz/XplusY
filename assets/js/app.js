
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
document.addEventListener("DOMContentLoaded", initMenu);
