import { fmtUZDateTime, setText } from "./ui.js";

export function startClock(){
  const tick = ()=> setText("clock", fmtUZDateTime(new Date()));
  tick();
  setInterval(tick, 1000 * 15);
}

function seasonOf(d){
  const m = d.getMonth()+1;
  if([12,1,2].includes(m)) return "winter";
  if([3,4,5].includes(m)) return "spring";
  if([6,7,8].includes(m)) return "summer";
  return "autumn";
}

export function startSeasonParticles(){
  const canvas = document.getElementById("seasonCanvas");
  if(!canvas) return;
  const ctx = canvas.getContext("2d");
  const state = {w:0,h:0, parts:[], season: seasonOf(new Date())};

  function resize(){
    state.w = canvas.width = window.innerWidth;
    state.h = canvas.height = window.innerHeight;
  }
  window.addEventListener("resize", resize, {passive:true});
  resize();

  function spawn(){
    const s = state.season;
    const x = Math.random()*state.w;
    const y = -20 - Math.random()*100;
    const vx = (Math.random()-.5) * (s==="summer"? .3 : 1.2);
    const vy = (s==="summer"? 0.35 : 0.8) + Math.random()*(s==="winter"? 1.4 : 1.0);
    const r = (s==="winter"? 2.2 : s==="spring"? 3.2 : s==="autumn"? 3.5 : 2.0) + Math.random()*2.8;
    const rot = Math.random()*Math.PI*2;
    const vr = (Math.random()-.5)*0.06;
    state.parts.push({x,y,vx,vy,r,rot,vr,life:0});
    if(state.parts.length>220) state.parts.splice(0, state.parts.length-220);
  }

  function drawPart(p){
    const s = state.season;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);

    if(s==="winter"){
      // snowflake: simple 6-arm star
      ctx.strokeStyle = "rgba(255,255,255,.85)";
      ctx.lineWidth = 1.2;
      for(let i=0;i<6;i++){
        ctx.beginPath();
        ctx.moveTo(0,0);
        ctx.lineTo(p.r*2.2,0);
        ctx.stroke();
        ctx.rotate(Math.PI/3);
      }
    } else if(s==="spring"){
      // petal
      ctx.fillStyle = "rgba(255,120,180,.55)";
      ctx.beginPath();
      ctx.ellipse(0,0,p.r*1.2,p.r*0.8, 0, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.35)";
      ctx.beginPath();
      ctx.ellipse(-p.r*0.2,-p.r*0.2,p.r*0.5,p.r*0.25, 0, 0, Math.PI*2);
      ctx.fill();
    } else if(s==="autumn"){
      // leaf-ish blob
      ctx.fillStyle = "rgba(255,140,60,.45)";
      ctx.beginPath();
      ctx.moveTo(0,-p.r);
      ctx.quadraticCurveTo(p.r*1.3,0,0,p.r*1.2);
      ctx.quadraticCurveTo(-p.r*1.1,0,0,-p.r);
      ctx.fill();
    } else {
      // summer dust
      ctx.fillStyle = "rgba(46,139,87,.18)";
      ctx.beginPath();
      ctx.arc(0,0,p.r,0,Math.PI*2);
      ctx.fill();
    }
    ctx.restore();
  }

  function loop(){
    ctx.clearRect(0,0,state.w,state.h);
    // slow spawn
    for(let i=0;i<3;i++) if(Math.random()<0.65) spawn();

    for(const p of state.parts){
      p.x += p.vx + Math.sin((p.life+p.x)*0.002)*0.35;
      p.y += p.vy;
      p.rot += p.vr;
      p.life += 1;
      drawPart(p);
    }
    // drop off
    state.parts = state.parts.filter(p => p.y < state.h + 40);
    requestAnimationFrame(loop);
  }
  loop();
}
