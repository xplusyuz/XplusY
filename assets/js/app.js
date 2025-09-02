
// assets/js/app.js
import { currentUser, doSignOut } from "./auth.js";

const $ = (s, r=document)=>r.querySelector(s);
const $$ = (s, r=document)=>Array.from(r.querySelectorAll(s));

async function loadFragment(el, url){
  const res = await fetch(url, { cache: "no-store" });
  const html = await res.text();
  el.innerHTML = html;
}

async function initLayout(){
  // Inject header / menu / footer
  await loadFragment($("#header-slot"), "/components/header.html");
  await loadFragment($("#menu-slot"), "/components/menu.html");
  await loadFragment($("#footer-slot"), "/components/footer.html");

  // After injection, wire up menu toggle
  const drawer = $(".drawer");
  const backdrop = $(".drawer .backdrop");
  const openBtn = $("#menuOpenBtn");
  const closeBtn = $("#menuCloseBtn");
  openBtn?.addEventListener("click", ()=>drawer?.classList.add("open"));
  closeBtn?.addEventListener("click", ()=>drawer?.classList.remove("open"));
  backdrop?.addEventListener("click", ()=>drawer?.classList.remove("open"));

  // Active link highlight
  const here = location.pathname.replace(/\/index\.html$/,"/");
  $$(".menu a").forEach(a=>{
    const href = a.getAttribute("href");
    if(!href) return;
    if(href === here || (href !== "/" && here.includes(href))) a.classList.add("active");
  });

  // Sign out
  document.addEventListener("click", (e)=>{
    const t = e.target;
    if(!(t instanceof HTMLElement)) return;
    if(t.matches("#signOutBtn")){
      doSignOut();
    }
  });
}

document.addEventListener("DOMContentLoaded", initLayout);
