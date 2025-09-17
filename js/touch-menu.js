// touch-menu.js — FAB + bottom sheet (green), signout only here
import { attachAuthUI, isSignedIn, requireAuthOrModal } from "./common.js";
const $=(s,r=document)=>r.querySelector(s);

const fab = $("#tdFab"), sheet=$("#tdSheet"), backdrop=$("#tdBackdrop"), grid=$("#tdGrid");

function openSheet(){ sheet.hidden=false; backdrop.hidden=false; fab?.setAttribute("aria-expanded","true"); }
function closeSheet(){ sheet.hidden=true; backdrop.hidden=true; fab?.setAttribute("aria-expanded","false"); }

function bindDrag(){
  const grabber = $("#tdGrabber"); if(!grabber) return;
  let startY=0, curY=0, dragging=false;
  const onStart = (e)=>{ dragging=true; startY=(e.touches?e.touches[0].clientY:e.clientY); sheet.style.transition="none"; };
  const onMove  = (e)=>{ if(!dragging) return; curY=(e.touches?e.touches[0].clientY:e.clientY); const dy=Math.max(0,curY-startY); sheet.style.transform=`translateY(${dy}px)`; };
  const onEnd   = ()=>{ if(!dragging) return; dragging=false; sheet.style.transition=""; const dy=Math.max(0,curY-startY); if(dy>80){ closeSheet(); } sheet.style.transform=""; };
  grabber.addEventListener("mousedown", onStart); grabber.addEventListener("touchstart", onStart,{passive:true});
  window.addEventListener("mousemove", onMove); window.addEventListener("touchmove", onMove,{passive:true});
  window.addEventListener("mouseup", onEnd); window.addEventListener("touchend", onEnd);
}

function bind(){
  fab?.addEventListener("click", ()=> fab.getAttribute("aria-expanded")==="true" ? closeSheet() : openSheet());
  backdrop?.addEventListener("click", closeSheet);
  grid?.addEventListener("click", (e)=>{
    const a = e.target.closest("[data-route]"); if(!a) return;
    if(a.hasAttribute("data-auth-required") && !isSignedIn()){ e.preventDefault(); requireAuthOrModal(); return; }
    closeSheet();
  });
  bindDrag();
  attachAuthUI(document);
}

document.addEventListener("DOMContentLoaded", bind);
