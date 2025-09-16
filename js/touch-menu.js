const $ = (s, r=document)=> r.querySelector(s);
const $$ = (s, r=document)=> r.querySelectorAll(s);

const dock     = $('#tdDock');
const fab      = $('#tdFab');
const sheet    = $('#tdSheet');
const backdrop = $('#tdBackdrop');
const grabber  = $('#tdGrabber');

let sheetOpen = false;
let dragStartY = null;
let dragDelta  = 0;

function setActive() {
  const hash = location.hash || '#home';
  $$('.td-item').forEach(a=>{
    const href = a.getAttribute('href') || '';
    a.classList.toggle('active', href === hash);
  });
}
window.addEventListener('hashchange', setActive, { passive:true });

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

fab.addEventListener('click', toggleSheet);
backdrop.addEventListener('click', closeSheet);

dock.addEventListener('click', (e)=>{
  const a = e.target.closest('a.td-item');
  if(!a) return;
  closeSheet();
});

sheet.addEventListener('click', (e)=>{
  const link = e.target.closest('a.td-tile');
  if(link){ closeSheet(); }
});

function onPointerDown(e){
  dragStartY = (e.touches ? e.touches[0].clientY : e.clientY);
  dragDelta = 0;
  sheet.style.transition = 'none';
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('pointerup', onPointerUp, { passive: true, once: true });
}
function onPointerMove(e){
  if(dragStartY==null) return;
  const y = (e.touches ? e.touches[0].clientY : e.clientY);
  dragDelta = Math.max(0, y - dragStartY);
  const h = Math.min(1, dragDelta / Math.max(1, window.innerHeight*0.8));
  sheet.style.transform = `translateY(${h*100}%)`;
}
function onPointerUp(){
  sheet.style.transition = '';
  if(dragDelta > 90){ closeSheet(); }
  else { sheet.style.transform = ''; }
  dragStartY = null;
  window.removeEventListener('pointermove', onPointerMove, { passive: true });
}
grabber.addEventListener('pointerdown', onPointerDown);
grabber.addEventListener('touchstart', onPointerDown, { passive:true });

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

document.addEventListener('DOMContentLoaded', setActive);