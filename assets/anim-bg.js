// assets/anim-bg.js — lightweight neon math particles
(function(){
  const canvas = document.createElement('canvas');
  canvas.id = 'lm-bg';
  canvas.style.position='fixed';
  canvas.style.inset='0';
  canvas.style.zIndex='0';
  canvas.style.pointerEvents='none';
  canvas.style.opacity='1';
  document.addEventListener('DOMContentLoaded', ()=>{
    document.body.prepend(canvas);
    const ctx = canvas.getContext('2d');
    let w=0,h=0,dpr=1;
    function resize(){
      dpr = Math.max(1, Math.min(2, window.devicePixelRatio||1));
      w = canvas.width = Math.floor(innerWidth*dpr);
      h = canvas.height = Math.floor(innerHeight*dpr);
      canvas.style.width = innerWidth+'px';
      canvas.style.height = innerHeight+'px';
      ctx.setTransform(1,0,0,1,0,0);
      ctx.scale(dpr,dpr);
    }
    resize(); addEventListener('resize', resize, {passive:true});

    const glyphs = ['π','∑','√','∞','∫','Δ','≈','≠','≤','≥','α','β','γ','θ','λ','μ','σ','φ','x','y','f','g','+','−','×','÷'];
    const N = Math.min(110, Math.max(55, Math.floor(innerWidth/10)));
    const p = [];
    const rand = (a,b)=>a+Math.random()*(b-a);
    for(let i=0;i<N;i++){
      p.push({
        x: rand(0,innerWidth),
        y: rand(0,innerHeight),
        r: rand(6,18),
        vx: rand(-0.15,0.15),
        vy: rand(-0.25,-0.05),
        g: glyphs[(Math.random()*glyphs.length)|0],
        a: rand(0.10,0.38),
        s: rand(10,22),
        t: rand(0,Math.PI*2),
      });
    }

    let last=performance.now();
    function tick(now){
      const dt = Math.min(32, now-last); last=now;
      ctx.clearRect(0,0,innerWidth,innerHeight);

      // subtle gradient wash
      const grd = ctx.createRadialGradient(innerWidth*0.2, innerHeight*0.05, 30, innerWidth*0.2, innerHeight*0.05, Math.max(innerWidth,innerHeight));
      grd.addColorStop(0,'rgba(46,139,87,0.25)');
      grd.addColorStop(0.55,'rgba(88,86,214,0.10)');
      grd.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle = grd;
      ctx.fillRect(0,0,innerWidth,innerHeight);

      for(const q of p){
        q.t += dt*0.0006;
        q.x += q.vx*dt;
        q.y += q.vy*dt;

        if(q.y < -30) { q.y = innerHeight+30; q.x = rand(0,innerWidth); }
        if(q.x < -30) q.x = innerWidth+30;
        if(q.x > innerWidth+30) q.x = -30;

        const wob = Math.sin(q.t)*2.2;
        ctx.save();
        ctx.translate(q.x, q.y+wob);

        // glow
        ctx.font = `700 ${q.s}px Inter, system-ui, sans-serif`;
        ctx.shadowColor = 'rgba(46,139,87,0.55)';
        ctx.shadowBlur = 12;
        ctx.fillStyle = `rgba(255,255,255,${q.a})`;
        ctx.fillText(q.g, 0, 0);
        ctx.restore();
      }

      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });
})();
