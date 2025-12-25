const quiz = [
  {q:'12 + 8 = ?', a:['18','19','20','21'], c:2},
  {q:'x=3 bo‘lsa, 2x+1 = ?', a:['5','7','8','9'], c:1},
  {q:'Uchburchak ichki burchaklar yig‘indisi?', a:['90°','180°','270°','360°'], c:1},
  {q:'(a+b)^2 = ?', a:['a^2+b^2','a^2+2ab+b^2','2a+2b','a^2-ab+b^2'], c:1},
  {q:'15·4 = ?', a:['45','50','55','60'], c:3},
];

let idx=0;
const ans = Array(quiz.length).fill(null);
let time = 180; // sec

const timerEl=document.getElementById('timer');
const scoreEl=document.getElementById('score');
const qnoEl=document.getElementById('qno');
const dots=document.getElementById('dots');
const qt=document.getElementById('qt');
const opts=document.getElementById('opts');
const prev=document.getElementById('prev');
const next=document.getElementById('next');

const result=document.getElementById('result');
const resBig=document.getElementById('resBig');
const resSub=document.getElementById('resSub');
const again=document.getElementById('again');

function fmt(t){
  const m=Math.floor(t/60).toString().padStart(2,'0');
  const s=Math.floor(t%60).toString().padStart(2,'0');
  return `${m}:${s}`;
}

function renderDots(){
  dots.innerHTML='';
  quiz.forEach((_,i)=>{
    const d=document.createElement('div');
    d.className='dot'+(i===idx?' active':'')+(ans[i]!==null?' ans':'');
    d.onclick=()=>{ idx=i; render(); };
    dots.appendChild(d);
  });
}

function calcScore(){
  let s=0;
  quiz.forEach((q,i)=>{ if(ans[i]===q.c) s++; });
  return s;
}

function render(){
  timerEl.textContent = '⏱ '+fmt(time);
  qnoEl.textContent = `${idx+1} / ${quiz.length}`;
  scoreEl.textContent = `Ball: ${calcScore()}`;

  renderDots();

  const q=quiz[idx];
  qt.textContent = q.q;
  opts.innerHTML='';
  q.a.forEach((txt,i)=>{
    const o=document.createElement('div');
    o.className='opt'+(ans[idx]===i?' on':'');
    o.innerHTML = `<b>${String.fromCharCode(65+i)}</b><div>${txt}</div>`;
    o.onclick=()=>{ ans[idx]=i; render(); };
    opts.appendChild(o);
  });

  prev.disabled = idx===0;
  next.textContent = (idx===quiz.length-1) ? 'Yakunlash ✅' : 'Keyingi ▶';
}

function finish(){
  const sc=calcScore();
  result.hidden=false;
  resBig.textContent = `${sc} / ${quiz.length}`;
  resSub.textContent = sc===quiz.length ? 'Ajoyib! Hammasi to‘g‘ri.' : 'Yaxshi! Yanada mashq qiling.';
}

prev.onclick=()=>{ if(idx>0){ idx--; render(); } };
next.onclick=()=>{
  if(idx===quiz.length-1){ finish(); }
  else { idx++; render(); }
};

again.onclick=()=>{ location.reload(); };

const tick=setInterval(()=>{
  if(result.hidden===false) return;
  time--;
  if(time<=0){
    time=0;
    render();
    finish();
    clearInterval(tick);
  }else render();
}, 1000);

render();
