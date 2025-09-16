const $ = (s, r=document)=> r.querySelector(s);
const $$ = (s, r=document)=> r.querySelectorAll(s);

const fab      = $('#tdFab');
const sheet    = $('#tdSheet');
const backdrop = $('#tdBackdrop');
const grabber  = $('#tdGrabber');

let sheetOpen = false;

// ---- Sheet open/close ----
function openSheet() {
  sheetOpen = true;
  sheet.hidden = false;
  backdrop.hidden = false;
  requestAnimationFrame(()=> sheet.classList.add('open'));
  fab.setAttribute('aria-expanded', 'true');
}
function closeSheet() {
  sheetOpen = false;
  sheet.classList.remove('open');
  fab.setAttribute('aria-expanded', 'false');
  sheet.addEventListener('transitionend', function once(){
    sheet.hidden = true; backdrop.hidden = true;
    sheet.style.transform = '';
    sheet.removeEventListener('transitionend', once);
  });
}
function toggleSheet(){ sheetOpen ? closeSheet() : openSheet(); }

backdrop.addEventListener('click', closeSheet);
sheet.addEventListener('click', (e)=>{
  const link = e.target.closest('a.td-tile');
  if(link){ closeSheet(); }
});

// ---- Drag-to-close on the sheet ----
let dragStartY = null, dragDelta = 0;
function onSheetPointerDown(e){
  dragStartY = (e.touches ? e.touches[0].clientY : e.clientY);
  dragDelta = 0;
  sheet.style.transition = 'none';
  window.addEventListener('pointermove', onSheetPointerMove, { passive: true });
  window.addEventListener('pointerup', onSheetPointerUp, { passive: true, once: true });
}
function onSheetPointerMove(e){
  if(dragStartY==null) return;
  const y = (e.touches ? e.touches[0].clientY : e.clientY);
  dragDelta = Math.max(0, y - dragStartY);
  const h = Math.min(1, dragDelta / Math.max(1, window.innerHeight*0.8));
  sheet.style.transform = `translateY(${h*100}%)`;
}
function onSheetPointerUp(){
  sheet.style.transition = '';
  if(dragDelta > 90){ closeSheet(); }
  else { sheet.style.transform = ''; }
  dragStartY = null;
  window.removeEventListener('pointermove', onSheetPointerMove, { passive: true });
}
grabber.addEventListener('pointerdown', onSheetPointerDown);
grabber.addEventListener('touchstart', onSheetPointerDown, { passive:true });

// ---- Swipe up to open (from bottom 100px) ----
let swipeStartY = null, swipeArmed = false;
window.addEventListener('touchstart', (e)=>{
  const t = e.touches[0];
  swipeStartY = t.clientY;
  swipeArmed = (window.innerHeight - swipeStartY) < 100 && !sheetOpen;
}, { passive:true });
window.addEventListener('touchmove', (e)=>{
  if(!swipeArmed || sheetOpen) return;
  const y = e.touches[0].clientY;
  if(swipeStartY - y > 60){ openSheet(); swipeArmed = false; }
}, { passive:true });

// ---- Draggable FAB (touch + mouse) ----
let startX=null, startY=null, fabStartLeft=null, fabStartTop=null, dragging=false;
function clamp(n, min, max){ return Math.max(min, Math.min(max, n)); }

function readFabLT(){
  const rect = fab.getBoundingClientRect();
  return [rect.left, rect.top];
}
function applyFabLT(l, t){
  fab.style.left = l + 'px';
  fab.style.top  = t + 'px';
  fab.style.right = 'auto';
  fab.style.bottom = 'auto';
}

function loadFabPos(){
  try{
    const saved = localStorage.getItem('td_fab_pos');
    if(saved){
      const {l, t} = JSON.parse(saved);
      applyFabLT(l, t);
    }
  }catch{}
}
function saveFabPos(l, t){
  try{ localStorage.setItem('td_fab_pos', JSON.stringify({l, t})); }catch{}
}

fab.addEventListener('pointerdown', (e)=>{
  e.preventDefault();
  fab.setPointerCapture(e.pointerId);
  const ptX = (e.touches ? e.touches[0].clientX : e.clientX);
  const ptY = (e.touches ? e.touches[0].clientY : e.clientY);
  startX = ptX; startY = ptY;
  const [l, t] = readFabLT();
  fabStartLeft = l; fabStartTop = t;
  dragging = false;
}, {passive:false});

fab.addEventListener('pointermove', (e)=>{
  if(startX==null) return;
  const ptX = (e.touches ? e.touches[0].clientX : e.clientX);
  const ptY = (e.touches ? e.touches[0].clientY : e.clientY);
  const dx = ptX - startX, dy = ptY - startY;
  if(!dragging && Math.hypot(dx,dy) > 8){ dragging = true; }
  if(dragging){
    const W = window.innerWidth, H = window.innerHeight;
    const size = Math.max(fab.offsetWidth||60, 60);
    const l = clamp(fabStartLeft + dx, 8, W - size - 8);
    const t = clamp(fabStartTop  + dy, 8, H - size - 8);
    applyFabLT(l, t);
  }
}, {passive:true});

fab.addEventListener('pointerup', (e)=>{
  if(!dragging){
    toggleSheet();
  }else{
    const rect = fab.getBoundingClientRect();
    saveFabPos(rect.left, rect.top);
  }
  startX = startY = fabStartLeft = fabStartTop = null;
  dragging = false;
});

document.addEventListener('DOMContentLoaded', loadFabPos);
