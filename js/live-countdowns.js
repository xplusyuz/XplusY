
// Simple countdown binder: looks for .live-card[data-start][data-duration-min]
export function bindLiveCountdowns(root){
  const cards = root.querySelectorAll('.live-card[data-start][data-duration-min]');
  cards.forEach(card=>{
    const start = new Date(card.dataset.start).getTime();
    const dur = Number(card.dataset.durationMin||0)*60*1000;
    const span = card.querySelector('.when');
    function tick(){
      const now = Date.now();
      if(now < start){
        const d = start - now;
        const h=Math.floor(d/3600000), m=Math.floor((d%3600000)/60000), s=Math.floor((d%60000)/1000);
        span.textContent = `Boshlanishigacha: ${h} soat ${m} daqiqa ${s} s`;
      }else if(now < start + dur){
        const d = start + dur - now;
        const h=Math.floor(d/3600000), m=Math.floor((d%3600000)/60000), s=Math.floor((d%60000)/1000);
        span.textContent = `Jarayonda: ${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
      }else{
        span.textContent = "Yakunlandi";
      }
      requestAnimationFrame(()=>setTimeout(tick,1000));
    }
    tick();
  });
}
