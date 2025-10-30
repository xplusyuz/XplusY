(async function(){
  const hostJSON = '/home.json'; // kerak bo'lsa absolyut/relativ yo'lni o'zgartiring
  const container = document.getElementById('home');

  // utils
  const esc = s=>String(s||'').replace(/[&<>\"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));
  const inDate = iso => !iso || (new Date(iso).getTime() > Date.now());

  let data = {sections:[]};
  try{
    data = await fetch(hostJSON,{cache:'no-store'}).then(r=>r.json());
  }catch(e){
    container.innerHTML = `<div class="sec"><div class="sec-title">home.json topilmadi</div><div class="subtitle">Faylni joylang: ${esc(hostJSON)}</div></div>`;
    return;
  }

  const timers = [];

  data.sections.forEach((sec, si)=>{
    // wrapper
    const wrap = document.createElement('section');
    wrap.className = 'sec';
    wrap.innerHTML = `
      <div class="sec-head">
        <div class="sec-title">${esc(sec.title||'Bo\'lim')}</div>
        <div class="nav">
          <button aria-label="prev">◀</button>
          <button aria-label="next">▶</button>
        </div>
      </div>
      <div class="rail" id="rail-${si}"></div>
      <div class="dots" id="dots-${si}"></div>
    `;
    container.appendChild(wrap);

    const rail = wrap.querySelector(`#rail-${si}`);
    const dots = wrap.querySelector(`#dots-${si}`);

    const items = (sec.items||[]).filter(it=>inDate(it.until));
    if(items.length===0){
      rail.innerHTML = `<div class="subtitle" style="padding:6px 2px">Banner yo‘q</div>`;
      return;
    }

    // cards
    items.forEach((it, idx)=>{
      const a = document.createElement('a');
      a.className = 'card';
      a.dataset.ratio = sec.ratio || '16:9';
      a.href = it.link || '#';
      a.target = (it.link && it.link.startsWith('http'))? '_blank':'_self';
      a.rel = 'noopener';

      const img = document.createElement('div');
      img.className = 'img';
      img.style.backgroundImage = `url('${esc(it.img)}')`;
      a.appendChild(img);

      if(it.badge){
        const b = document.createElement('div');
        b.className = 'badge';
        b.style.background = it.badgeColor || '#ef4444';
        b.textContent = it.badge;
        a.appendChild(b);
      }

      const grad = document.createElement('div'); grad.className='grad'; a.appendChild(grad);
      const ttl = document.createElement('div'); ttl.className='ttl'; ttl.innerHTML = esc(it.title||'');
      if(it.subtitle) ttl.innerHTML += `<div style="font-weight:500;opacity:.9">${esc(it.subtitle)}</div>`;
      a.appendChild(ttl);

      rail.appendChild(a);

      const d = document.createElement('div'); d.className='dot'+(idx===0?' active':''); dots.appendChild(d);
    });

    // navigation
    const prevBtn = wrap.querySelector('.nav button[aria-label="prev"]');
    const nextBtn = wrap.querySelector('.nav button[aria-label="next"]');
    const cards = Array.from(rail.children);
    const dotsList = Array.from(dots.children);

    function goTo(index){
      const i = Math.max(0, Math.min(index, cards.length-1));
      cards[i].scrollIntoView({behavior:'smooth', inline:'center', block:'nearest'});
      dotsList.forEach((d,k)=>d.classList.toggle('active', k===i));
      rail.dataset.idx = i;
    }
    function curr(){ return Number(rail.dataset.idx||0); }
    prevBtn.onclick = ()=> goTo(curr()-1);
    nextBtn.onclick = ()=> goTo(curr()+1);

    // autoplay (stories)
    const interval = Number(sec.autoplayMs||0);
    if(interval>0 && cards.length>1){
      const t = setInterval(()=>{
        let i = curr()+1;
        if(i>=cards.length) i=0;
        goTo(i);
      }, interval);
      timers.push(t);
      // pause on hover/touch
      rail.addEventListener('mouseenter', ()=>clearInterval(t));
      rail.addEventListener('touchstart', ()=>clearInterval(t), {passive:true});
    }

    // sync dots on manual scroll
    rail.addEventListener('scroll', ()=>{
      // find nearest card to the center
      const c = cards.map((el, i)=>{
        const r = el.getBoundingClientRect();
        const center = window.innerWidth/2;
        const dist = Math.abs((r.left+r.right)/2 - center);
        return {i, dist};
      }).sort((a,b)=>a.dist-b.dist)[0];
      if(c) { dotsList.forEach((d,k)=>d.classList.toggle('active', k===c.i)); rail.dataset.idx = c.i; }
    }, {passive:true});
  });

  // cleanup if chip o'chsa (ihtiyoriy)
  window.addEventListener('beforeunload', ()=> timers.forEach(t=>clearInterval(t)));
})();
<div id="home" class="home-wrap"></div>