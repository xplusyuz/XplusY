// seasons.js — lightweight seasonal particles (no deps)
export function initSeasons(canvasId = "seasonCanvas"){
  const canvas = document.getElementById(canvasId);
  if(!canvas) return;
  const ctx = canvas.getContext("2d");
  let W=0,H=0, dpr=1;
  const resize=()=>{
    dpr = Math.min(2, window.devicePixelRatio||1);
    W = canvas.width = Math.floor(window.innerWidth*dpr);
    H = canvas.height = Math.floor(window.innerHeight*dpr);
    canvas.style.width = window.innerWidth+"px";
    canvas.style.height = window.innerHeight+"px";
  };
  resize(); window.addEventListener("resize", resize);

  const month = new Date().getMonth(); // 0-11
  let season = "spring";
  if([11,0,1].includes(month)) season="winter";
  else if([2,3,4].includes(month)) season="spring";
  else if([5,6,7].includes(month)) season="summer";
  else season="autumn";

  const N = season==="winter" ? 90 : season==="spring" ? 70 : season==="summer" ? 45 : 70;
  const parts = Array.from({length:N}, ()=>spawn(true));
  function spawn(init=false){
    const x = Math.random()*W;
    const y = init ? Math.random()*H : -Math.random()*H*0.2;
    const s = (season==="summer"? 0.7:1) * (0.6 + Math.random()*1.2) * dpr;
    const vy = (season==="winter"? 0.7 : season==="spring"? 0.9 : season==="summer"? 0.5 : 1.1) * (0.8+Math.random()*1.3) * dpr;
    const vx = (Math.random()*0.8-0.4) * dpr;
    const rot = Math.random()*Math.PI*2;
    return {x,y,s,vy,vx,rot,vr:(Math.random()*0.02-0.01),a:0.22+Math.random()*0.25};
  }
  function draw(p){
    ctx.save();
    ctx.globalAlpha = p.a;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    if(season==="winter"){
      ctx.strokeStyle="rgba(255,255,255,.9)";
      ctx.lineWidth=1.1*dpr;
      const r=6*p.s;
      ctx.beginPath();
      for(let i=0;i<6;i++){
        const ang=i*Math.PI/3;
        ctx.moveTo(0,0); ctx.lineTo(Math.cos(ang)*r, Math.sin(ang)*r);
      }
      ctx.stroke();
    }else if(season==="spring"){
      ctx.fillStyle="rgba(255, 153, 204, .9)";
      ctx.beginPath();
      ctx.ellipse(0,0, 6*p.s, 3.5*p.s, 0, 0, Math.PI*2);
      ctx.fill();
    }else if(season==="summer"){
      ctx.fillStyle="rgba(255, 223, 128, .9)";
      ctx.beginPath();
      ctx.arc(0,0, 3.5*p.s, 0, Math.PI*2);
      ctx.fill();
    }else{
      ctx.fillStyle="rgba(245, 158, 11, .9)";
      ctx.beginPath();
      ctx.ellipse(0,0, 7*p.s, 4*p.s, 0, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.restore();
  }
  let last=performance.now();
  function tick(now){
    const dt=(now-last)/16.67; last=now;
    ctx.clearRect(0,0,W,H);
    for(const p of parts){
      p.x += (p.vx + Math.sin((p.y/W)*6)*0.25*dpr) * dt;
      p.y += p.vy * dt;
      p.rot += p.vr*dt;
      if(p.x<-40*dpr) p.x=W+40*dpr;
      if(p.x>W+40*dpr) p.x=-40*dpr;
      if(p.y>H+60*dpr) Object.assign(p, spawn());
      draw(p);
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}