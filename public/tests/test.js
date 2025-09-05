const TEST_ID='demo-test-1'; const TEST_TITLE='DTM Demo'; const TEST_DURATION_MIN=20;
const TELEGRAM_BOT_TOKEN=''; const TELEGRAM_CHAT_ID='';
const QUESTIONS=[
  {n:1,text:'2 + 3 = ?',options:['4','5','6','7'],correct:1},
  {n:2,text:'9 − 4 = ?',options:['3','4','5','6'],correct:2},
  {n:3,text:'5 × 6 = ?',options:['25','30','35','36'],correct:1},
  {n:4,text:'12 ÷ 3 = ?',options:['3','4','6','9'],correct:1},
  {n:5,text:'√81 = ?',options:['7','8','9','10'],correct:2},
  {n:6,text:'10% of 200 = ?',options:['10','15','20','25'],correct:2},
  {n:7,text:'If x=2 then 3x+1 = ?',options:['5','6','7','8'],correct:2},
  {n:8,text:'15 mod 4 = ?',options:['1','2','3','4'],correct:0},
  {n:9,text:'Chet tili: “apple” so‘zi nima?',options:['Olma','Anor','Uzum','Shaftoli'],correct:0},
  {n:10,text:'Qaysi son tub?',options:['21','27','29','33'],correct:2},
];
const SCORE_CORRECT=3, SCORE_WRONG=-0.75;
firebase.initializeApp(firebase.app().options); const auth=firebase.auth(); const db=firebase.firestore();
const qCount=document.getElementById('qCount'), scoreEl=document.getElementById('score'), correctEl=document.getElementById('correct'), wrongEl=document.getElementById('wrong'), timerEl=document.getElementById('timer'), qTitle=document.getElementById('qTitle'), qImage=document.getElementById('qImage'), optionsEl=document.getElementById('options'), gridEl=document.getElementById('grid'), progressBar=document.getElementById('progressBar');
const prevBtn=document.getElementById('prevBtn'), nextBtn=document.getElementById('nextBtn'), finishBtn=document.getElementById('finishBtn');
const testView=document.getElementById('testView'), resultView=document.getElementById('resultView'); const rCorrect=document.getElementById('rCorrect'), rWrong=document.getElementById('rWrong'), rBlank=document.getElementById('rBlank'), rPct=document.getElementById('rPct'), rScore=document.getElementById('rScore'), rTime=document.getElementById('rTime'), rCount=document.getElementById('rCount'), rTestId=document.getElementById('rTestId'), backHome=document.getElementById('backHome');
let uid=null,current=0,selected=Array(QUESTIONS.length).fill(null),durationSec=TEST_DURATION_MIN*60,remainingSec=durationSec,timerInt=null;
auth.onAuthStateChanged(async (user)=>{ if(!user){alert('Kirish talab qilinadi.');location.href='../index.html';return;} uid=user.uid; init(); });
function init(){ qCount.textContent=QUESTIONS.length; buildGrid(); renderQuestion(0); startTimer(); attachEvents(); }
function buildGrid(){ gridEl.innerHTML=''; QUESTIONS.forEach((q,idx)=>{ const b=document.createElement('button'); b.className='cell'; b.textContent=idx+1; b.addEventListener('click',()=>goto(idx)); gridEl.appendChild(b); }); }
function renderQuestion(idx){ current=idx; const q=QUESTIONS[idx]; qTitle.textContent=`${idx+1}. ${q.text}`; const trySrcs=[`../img/${q.n}.jpg`,`../img/${q.n}.png`]; qImage.hidden=true; (async()=>{ for(const s of trySrcs){ const ok=await imgExists(s); if(ok){ qImage.src=s; qImage.hidden=false; break; } }})(); optionsEl.innerHTML=''; q.options.forEach((opt,i)=>{ const label=document.createElement('label'); label.className='opt'+(selected[idx]===i?' selected':''); const radio=document.createElement('input'); radio.type='radio'; radio.name='q'+idx; radio.checked=selected[idx]===i; radio.addEventListener('change',()=>choose(idx,i)); const span=document.createElement('span'); span.textContent=opt; label.appendChild(radio); label.appendChild(span); optionsEl.appendChild(label); }); updateGrid(); updateProgress(); }
async function imgExists(url){ try{ const res=await fetch(url,{method:'HEAD'}); return res.ok; } catch{ return false; } }
function choose(idx,i){ selected[idx]=i; updateGrid(); }
function updateGrid(){ const cells=gridEl.querySelectorAll('.cell'); cells.forEach((c,i)=>{ c.classList.toggle('current',i===current); c.classList.toggle('answered',selected[i]!==null); }); }
function updateProgress(){ const answered=selected.filter(v=>v!==null).length; const pct=Math.round(answered/QUESTIONS.length*100); progressBar.style.width=pct+'%'; }
function goto(i){ if(i<0||i>=QUESTIONS.length) return; renderQuestion(i); }
prevBtn.addEventListener('click',()=>goto(current-1)); nextBtn.addEventListener('click',()=>goto(current+1)); finishBtn.addEventListener('click',onFinish); backHome.addEventListener('click',()=>location.href='../index.html');
function startTimer(){ renderTimer(); timerInt=setInterval(()=>{ remainingSec--; renderTimer(); if(remainingSec<=0){ clearInterval(timerInt); onFinish(); } },1000); }
function renderTimer(){ const m=Math.floor(remainingSec/60), s=remainingSec%60; timerEl.textContent=`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`; }
function computeScore(){ let correct=0,wrong=0,blank=0; QUESTIONS.forEach((q,i)=>{ const ans=selected[i]; if(ans===null) blank++; else if(ans===q.correct) correct++; else wrong++; }); const score=correct*SCORE_CORRECT+wrong*SCORE_WRONG; const pct=Math.round((correct/QUESTIONS.length)*100); return {correct,wrong,blank,score,pct}; }
async function onFinish(){ if(timerInt) clearInterval(timerInt); prevBtn.disabled=nextBtn.disabled=finishBtn.disabled=true; const spent=(TEST_DURATION_MIN*60)-remainingSec; const {correct,wrong,blank,score,pct}=computeScore();
  testView.hidden=true; resultView.hidden=false; rCorrect.textContent=correct; rWrong.textContent=wrong; rBlank.textContent=blank; rPct.textContent=pct+'%'; rScore.textContent=score.toFixed(2); rTime.textContent=fmtMMSS(spent); rCount.textContent=QUESTIONS.length; rTestId.textContent=TEST_ID;
  scoreEl.textContent=score.toFixed(2); correctEl.textContent=String(correct); wrongEl.textContent=String(wrong);
  try{ await db.collection('attempts').add({ userId:uid, testId:TEST_ID, title:TEST_TITLE, answers:selected, correctCount:correct, wrongCount:wrong, blankCount:blank, score, percentage:pct, durationSec:spent, createdAt:firebase.firestore.FieldValue.serverTimestamp() }); } catch(e){ console.warn('Attempt save error:', e); }
  try{ if(TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID){ const msg=`MathCenter natija:\nID: ${uid}\nTest: ${TEST_ID}\nTo‘g‘ri: ${correct}\nNoto‘g‘ri: ${wrong}\nJami: ${QUESTIONS.length}\nBall: ${score.toFixed(2)}\nVaqt: ${fmtMMSS(spent)}`; await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:TELEGRAM_CHAT_ID,text:msg})}); } } catch(e){ console.warn('Telegram send failed:', e.message); }
}
function fmtMMSS(sec){ const m=Math.floor(sec/60), s=sec%60; return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`; }
