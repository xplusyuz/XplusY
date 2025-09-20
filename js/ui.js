export function initUI(){
  // Splash hide after 3s
  setTimeout(()=>document.getElementById("splash")?.remove(), 3000);

  // Drawer toggle from header menu button
  const drawer = document.getElementById("drawer");
  document.getElementById("btn-menu")?.addEventListener("click", ()=>{
    drawer.classList.toggle("open");
  });

  // Floating Action Button (draggable)
  const fab = document.getElementById("fab");
  const menu = document.getElementById("fab-menu");
  let drag=false, sx=0, sy=0, ox=0, oy=0;
  const start = e=>{
    drag=true; const t=e.touches?e.touches[0]:e;
    sx=t.clientX; sy=t.clientY;
    const r=fab.getBoundingClientRect(); ox=r.left; oy=r.top;
  };
  const move = e=>{
    if(!drag) return; const t=e.touches?e.touches[0]:e;
    const x = ox + (t.clientX - sx);
    const y = oy + (t.clientY - sy);
    fab.style.left = x + "px";
    fab.style.top = y + "px";
    fab.style.right = "auto"; fab.style.bottom="auto";
  };
  const end = ()=> drag=false;
  ["mousedown","touchstart"].forEach(ev=>fab.addEventListener(ev,start));
  ["mousemove","touchmove"].forEach(ev=>window.addEventListener(ev,move));
  ["mouseup","touchend","touchcancel"].forEach(ev=>window.addEventListener(ev,end));

  // FAB click -> open quick menu
  fab.addEventListener("click", ()=>{
    menu.classList.toggle("open");
  });
}
