import { mountChrome, attachAuthUI, db } from '/js/common.js';
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

await mountChrome();
attachAuthUI({ requireSignIn: true });

const wrap = document.querySelector('#testWrap');
const rules = {
  easy: { plus:1, minus:0.25, title:'Oson' },
  medium: { plus:2, minus:0.5, title:'O‘rta' },
  hard: { plus:3, minus:1, title:'Qiyin' }
};

const sampleQs = (level)=>{
  // generate 10 simple arithmetic questions per level
  const arr=[];
  for(let i=1;i<=10;i++){
    const a = Math.floor(Math.random()*20+1) * (level==='hard'?3:1);
    const b = Math.floor(Math.random()*15+1) * (level!=='easy'?2:1);
    const op = ['+','-','×','÷'][Math.floor(Math.random()*4)];
    let ans=0;
    if(op==='+') ans=a+b;
    if(op==='-') ans=a-b;
    if(op==='×') ans=a*b;
    if(op==='÷') ans=Number((a/b).toFixed(2));
    const options=[ans];
    while(options.length<4){
      const d = ans + Math.floor(Math.random()*9-4);
      if(!options.includes(d)) options.push(d);
    }
    options.sort(()=>Math.random()-0.5);
    arr.push({ i, text: `${a} ${op} ${b} = ?`, options, ans });
  }
  return arr;
};

let current = null;
let startAt = null;
let exitCount = Number(localStorage.getItem('mc_exitCount')||0);

document.addEventListener('visibilitychange', ()=>{
  if(document.visibilityState === 'hidden' && startAt){
    exitCount++;
    localStorage.setItem('mc_exitCount', String(exitCount));
  }
});

document.addEventListener('click', (e)=>{
  const level = e.target.getAttribute('data-start');
  if(level) startTest(level);
});

function renderTest(level, qs){
  wrap.classList.remove('hidden');
  wrap.innerHTML = `<h2>${rules[level].title} test</h2>
    <div class="sub">Ball: +${rules[level].plus} / −${rules[level].minus}</div>
    <div class="sub">Taymer: <span id="tm">10:00</span></div>
    <div id="qs"></div>
    <div style="display:flex; gap:10px; margin-top:10px">
      <button id="submit" class="btn primary">Yakunlash</button>
    </div>`;
  const qsEl = document.querySelector('#qs');
  qs.forEach(q=>{
    const div=document.createElement('div');
    div.className='card';
    div.innerHTML = `<div><b>${q.i}.</b> ${q.text}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px">
        ${q.options.map(o=>`<label class="pill"><input type="radio" name="q${q.i}" value="${o}"> ${o}</label>`).join('')}
      </div>`;
    qsEl.appendChild(div);
  });

  let seconds=600;
  const timer = setInterval(()=>{
    seconds--;
    if(seconds<=0){ clearInterval(timer); grade(level, qs); }
    const m = String(Math.floor(seconds/60)).padStart(2,'0');
    const s = String(seconds%60).padStart(2,'0');
    document.querySelector('#tm').textContent = `${m}:${s}`;
  },1000);

  document.querySelector('#submit').addEventListener('click', ()=>{
    clearInterval(timer);
    grade(level, qs);
  });
}

async function grade(level, qs){
  let score=0, correct=0, wrong=0, blank=0;
  qs.forEach(q=>{
    const chosen = document.querySelector(`input[name="q${q.i}"]:checked`)?.value;
    if(chosen==null){ blank++; return; }
    const ok = Number(chosen)===q.ans;
    if(ok){ score += rules[level].plus; correct++; }
    else { score -= rules[level].minus; wrong++; }
  });

  // frequent exit penalty
  let penalty=0;
  if(exitCount>2){ penalty = (exitCount-2)*1; score -= penalty; }

  const detail = { score, correct, wrong, blank, penalty, level, createdAt: new Date().toISOString() };
  wrap.innerHTML = `<h2>N natija</h2>
    <div class="sub">To‘g‘ri: ${correct}, Noto‘g‘ri: ${wrong}, Bo‘sh: ${blank}, Jarima: ${penalty}</div>
    <div class="card"><b>Umumiy ball:</b> ${score.toFixed(2)}</div>
    <div class="hint">Natija profilingizga saqlandi.</div>`;

  try{
    const uid = window.__mcUser?.user?.uid;
    if(uid){
      const id = 't'+Date.now();
      await setDoc(doc(db, 'users', uid, 'results', id), {
        ...detail, examName: `Test (${rules[level].title})`, createdAtFS: serverTimestamp()
      });
    }
  }catch(e){ console.error(e); }
}

function startTest(level){
  // reset start time
  startAt = Date.now();
  const qs = sampleQs(level);
  renderTest(level, qs);
}
