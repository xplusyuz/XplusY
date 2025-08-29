
// HTML slide-lar uchun carousel
export function initCarousel() {
  const root = document.querySelector('.h-banner-carousel');
  if (!root) return;
  const slides = Array.from(root.querySelectorAll('.h-slide'));
  if (!slides.length) return;

  let i = 0;
  const show = (idx) => slides.forEach((s, k)=> s.classList.toggle('active', k === idx));
  show(0);

  setInterval(()=> {
    i = (i + 1) % slides.length;
    show(i);
  }, 4000);
}

// Draggable assistive menyu o‘sha-o‘sha…
export function initAssistive() {
  const bubble = document.getElementById('assistiveTouch');
  const menu = document.getElementById('assistiveMenu');
  if (!bubble || !menu) return;
  let offsetX = 0, offsetY = 0, sx = 0, sy = 0, drag = false;
  const down = e => { drag = true; sx = (e.touches?e.touches[0].clientX:e.clientX); sy = (e.touches?e.touches[0].clientY:e.clientY);
    const r = bubble.getBoundingClientRect(); offsetX = sx - r.left; offsetY = sy - r.top; };
  const move = e => { if (!drag) return; const x = (e.touches?e.touches[0].clientX:e.clientX) - offsetX;
    const y = (e.touches?e.touches[0].clientY:e.clientY) - offsetY; bubble.style.left = x+'px'; bubble.style.top = y+'px';
    bubble.style.right = 'auto'; bubble.style.bottom = 'auto'; };
  const up = () => drag = false;
  bubble.addEventListener('mousedown', down); bubble.addEventListener('touchstart', down);
  window.addEventListener('mousemove', move); window.addEventListener('touchmove', move);
  window.addEventListener('mouseup', up); window.addEventListener('touchend', up);
  bubble.addEventListener('click', ()=> menu.classList.toggle('show'));
}

// Floating / draggable assistive menu
export function initAssistive() {
  const bubble = document.getElementById('assistiveTouch');
  const menu = document.getElementById('assistiveMenu');
  if (!bubble || !menu) return;

  let offsetX = 0, offsetY = 0, startX = 0, startY = 0, dragging = false;

  function pointerDown(e){
    dragging = true;
    startX = e.clientX || (e.touches && e.touches[0].clientX);
    startY = e.clientY || (e.touches && e.touches[0].clientY);
    const rect = bubble.getBoundingClientRect();
    offsetX = startX - rect.left;
    offsetY = startY - rect.top;
  }
  function pointerMove(e){
    if(!dragging) return;
    const x = (e.clientX || (e.touches && e.touches[0].clientX)) - offsetX;
    const y = (e.clientY || (e.touches && e.touches[0].clientY)) - offsetY;
    bubble.style.left = x + 'px';
    bubble.style.top  = y + 'px';
    bubble.style.right = 'auto';
    bubble.style.bottom = 'auto';
  }
  function pointerUp(){ dragging = false; }

  bubble.addEventListener('mousedown', pointerDown);
  bubble.addEventListener('touchstart', pointerDown);
  window.addEventListener('mousemove', pointerMove);
  window.addEventListener('touchmove', pointerMove);
  window.addEventListener('mouseup', pointerUp);
  window.addEventListener('touchend', pointerUp);

  bubble.addEventListener('click', ()=> menu.classList.toggle('show'));
}
