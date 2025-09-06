const TEST_DURATION_MIN=20;
const QUESTIONS=[
  {text:'2 + 2 = ?', options:['3','4','5','6'], correct:1},
  {text:'9 − 3 = ?', options:['3','5','6','7'], correct:2},
];
const SCORE_CORRECT=3, SCORE_WRONG=-0.75;
firebase.initializeApp(firebase.app().options); const auth=firebase.auth(); const db=firebase.firestore();
let uid=null,current=0,selected=Array(QUESTIONS.length).fill(null),remaining=TEST_DURATION_MIN*60,timerInt=null;
const qTitle=document.getElementById('qTitle'), optionsEl=document.getElementById('options'), gridEl=document.getElementById('grid'), progressBar=document.getElementById('progressBar'), scoreEl=document.getElementById('score'), timerEl=document.getElementById('timer'), sumEl=document.getElementById('sum');
auth.onAuthStateChanged(u=>{ if(!u){alert('Kirish talab qilinadi'); location.href='../index.html'; return;} uid=u.uid; init(); });
function init(){ buildGrid(); renderQ(0); startTimer(); document.getElementById('prevBtn').onclick=()=>goto(current-1); document.getElementById('nextBtn').onclick=()=>goto(current+1); document.getElementById('finishBtn').onclick=finish; }
function buildGrid(){ gridEl.innerHTML=''; for(let i=0;i<QUESTIONS.length;i++){ const b=document.createElement('button'); b.className='cell'; b.textContent=i+1; b.onclick=()=>goto(i); gridEl.appendChild(b);} }
function renderQ(i){ current=i; const q=QUESTIONS[i]; qTitle.textContent=(i+1)+'. '+q.text; optionsEl.innerHTML=''; q.options.forEach((t,idx)=>{ const lbl=document.createElement('label'); lbl.className='opt'+(selected[i]===idx?' selected':''); const r=document.createElement('input'); r.type='radio'; r.name='q'+i; r.checked=selected[i]===idx; r.onchange=()=>{ selected[i]=idx; updateGrid(); updateProgress(); }; lbl.appendChild(r); const s=document.createElement('span'); s.textContent=t; lbl.appendChild(s); optionsEl.appendChild(lbl); }); updateGrid(); }
function updateGrid(){ const cells=gridEl.querySelectorAll('.cell'); cells.forEach((c,j)=>{ c.classList.toggle('answered', selected[j]!==null); }); }
function updateProgress(){ const ans=selected.filter(v=>v!==null).length; progressBar.style.width=Math.round(ans/QUESTIONS.length*100)+'%'; }
function goto(i){ if(i<0||i>=QUESTIONS.length) return; renderQ(i); }
function startTimer(){ timerInt=setInterval(()=>{ remaining--; const m=String(Math.floor(remaining/60)).padStart(2,'0'), s=String(remaining%60).padStart(2,'0'); timerEl.textContent=`${m}:${s}`; if(remaining<=0){ clearInterval(timerInt); finish(); } },1000); }
function compute(){ let c=0,w=0,b=0; QUESTIONS.forEach((q,i)=>{ const a=selected[i]; if(a===null) b++; else if(a===q.correct) c++; else w++; }); const score=c*SCORE_CORRECT+w*SCORE_WRONG; return {c,w,b,score}; }
async function finish(){ if(timerInt) clearInterval(timerInt); const {c,w,b,score}=compute(); scoreEl.textContent=score.toFixed(2); document.getElementById('testView').hidden=true; document.getElementById('resultView').hidden=false; sumEl.textContent=`To‘g‘ri: ${c}, Noto‘g‘ri: ${w}, Bo‘sh: ${b}, Ball: ${score.toFixed(2)}`;
  try{ await db.collection('attempts').add({userId:uid,score,answers:selected,createdAt:firebase.firestore.FieldValue.serverTimestamp()}); }catch(e){ console.warn(e); }
}
