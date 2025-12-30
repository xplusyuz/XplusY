// seasons.js (repurposed) — math-themed ambient particles (no deps)
// NOTE: kept export name `initSeasons` for compatibility with existing pages.

export function initSeasons(canvasId = "seasonCanvas"){
  const canvas = document.getElementById(canvasId);
  if(!canvas) return;
  const ctx = canvas.getContext("2d");

  let W=0, H=0, dpr=1;
  const resize = ()=>{
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = canvas.width  = Math.floor(window.innerWidth  * dpr);
    H = canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width  = window.innerWidth+"px";
    canvas.style.height = window.innerHeight+"px";
  };
  resize();
  window.addEventListener("resize", resize);

  // Math glyph set
  const glyphs = ["π","∑","√","∫","∞","≈","≠","≤","≥","Δ","θ","λ","μ","∂","×","÷","+","−","=","x²","y²","aₙ","bₙ","log","sin","cos"];
  const fontStack = "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial";

  // More dense math ambient (user requested "to'ldirish")
  const N = 140;
  const parts = Array.from({length:N}, ()=>spawn(true));
  function spawn(init=false){
    const x = Math.random()*W;
    const y = init ? Math.random()*H : H + Math.random()*H*0.15;
    const s = (0.9 + Math.random()*1.7) * dpr;
    const vy = -(0.22 + Math.random()*0.75) * dpr; // drift upward
    const vx = (Math.random()*0.25-0.125) * dpr;
    const rot = (Math.random()*Math.PI*2);
    const vr  = (Math.random()*0.008-0.004);
    const a   = 0.06 + Math.random()*0.14;
    const g   = glyphs[(Math.random()*glyphs.length)|0];
    return {x,y,s,vy,vx,rot,vr,a,g};
  }

  function draw(p){
    ctx.save();
    ctx.globalAlpha = p.a;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    // soft neon-ish stroke + fill
    const fs = Math.round(14*p.s);
    ctx.font = `900 ${fs}px ${fontStack}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(46,139,87,.22)";
    ctx.shadowBlur = 10*dpr;
    ctx.fillStyle = "rgba(15,23,42,.48)";
    ctx.strokeStyle = "rgba(46,139,87,.18)";
    ctx.lineWidth = 2*dpr;
    ctx.strokeText(p.g, 0, 0);
    ctx.fillText(p.g, 0, 0);
    ctx.restore();
  }

  let last = performance.now();
  function tick(now){
    const dt = (now-last)/16.67; last = now;
    ctx.clearRect(0,0,W,H);
    for(const p of parts){
      p.x += (p.vx + Math.sin((p.y/W)*6) * 0.08*dpr) * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      if(p.x < -40*dpr) p.x = W + 40*dpr;
      if(p.x > W + 40*dpr) p.x = -40*dpr;
      if(p.y < -60*dpr) Object.assign(p, spawn());
      draw(p);
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
