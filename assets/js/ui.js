
export function initCarousel(){
  const root = document.querySelector('.h-banner-carousel');
  if (!root) return;
  const slides = Array.from(root.querySelectorAll('.h-slide'));
  if (!slides.length) return;
  let i=0;
  const show = idx => slides.forEach((s,k)=> s.classList.toggle('active', k===idx));
  show(0);
  setInterval(()=>{ i=(i+1)%slides.length; show(i); }, 4200);
}

export function initAssistive(){
  const b = document.getElementById('assistiveTouch');
  const m = document.getElementById('assistiveMenu');
  if (!b || !m) return;
  let ox=0, oy=0, sx=0, sy=0, drag=false;
  const down=e=>{drag=true; sx=(e.touches?e.touches[0].clientX:e.clientX); sy=(e.touches?e.touches[0].clientY:e.clientY);
    const r=b.getBoundingClientRect(); ox=sx-r.left; oy=sy-r.top;};
  const move=e=>{if(!drag)return; const x=(e.touches?e.touches[0].clientX:e.clientX)-ox; const y=(e.touches?e.touches[0].clientY:e.clientY)-oy;
    b.style.left=x+'px'; b.style.top=y+'px'; b.style.right='auto'; b.style.bottom='auto';};
  const up=()=>drag=false;
  b.addEventListener('mousedown',down); b.addEventListener('touchstart',down);
  window.addEventListener('mousemove',move); window.addEventListener('touchmove',move);
  window.addEventListener('mouseup',up); window.addEventListener('touchend',up);
  b.addEventListener('click',()=> m.classList.toggle('show'));
}
