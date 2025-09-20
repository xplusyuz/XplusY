
export function initUI(){
  // Splash hide after 3s
  setTimeout(()=>document.getElementById("splash")?.remove(), 3000);

  const fab = document.getElementById("fab");
  const menu = document.getElementById("fab-menu");

  // Track FAB position and sync menu origin
  const syncMenu = ()=>{
    const r = fab.getBoundingClientRect();
    const cx = r.left + r.width/2;
    const cy = r.top + r.height/2;
    menu.style.left = (cx) + "px";
    menu.style.top  = (cy) + "px";
  };
  syncMenu();
  window.addEventListener("resize", syncMenu);

  // Draggable
  let drag=false, sx=0, sy=0, ox=0, oy=0;
  const start = e=>{
    drag=true; const t=e.touches?e.touches[0]:e;
    sx=t.clientX; sy=t.clientY;
    const r=fab.getBoundingClientRect(); ox=r.left; oy=r.top;
    fab.style.willChange="transform,left,top";
  };
  const move = e=>{
    if(!drag) return; const t=e.touches?e.touches[0]:e;
    const x = ox + (t.clientX - sx);
    const y = oy + (t.clientY - sy);
    fab.style.left = x + "px";
    fab.style.top = y + "px";
    fab.style.right = "auto"; fab.style.bottom="auto";
    syncMenu();
  };
  const end = ()=>{ drag=false; fab.style.willChange=""; };
  ["mousedown","touchstart"].forEach(ev=>fab.addEventListener(ev,start));
  ["mousemove","touchmove"].forEach(ev=>window.addEventListener(ev,move));
  ["mouseup","touchend","touchcancel"].forEach(ev=>window.addEventListener(ev,end));

  // Radial quick menu
  const placeRadial = ()=>{
    const items = Array.from(menu.querySelectorAll(".fab-item"));
    const base = -110; // up-left arc origin angle
    const step = 36;   // degrees
    items.forEach((el, i)=>{
      const angle = base - i*step;
      const rad = angle * Math.PI / 180;
      const radius = 110; // px
      const tx = Math.cos(rad) * radius;
      const ty = Math.sin(rad) * radius;
      el.style.transform = `translate(${tx}px, ${ty}px) scale(1)`;
    });
  };

  fab.addEventListener("click", ()=>{
    const open = menu.classList.toggle("open");
    if(open){ placeRadial(); }
  });
}
