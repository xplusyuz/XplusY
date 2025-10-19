// runner.js with MathJax typeset and Firestore persistence
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
const { db, auth, signIn, logOut, collection, query, where, getDocs, orderBy, addDoc, serverTimestamp, doc, getDoc } = window.fb;

const testCardsContainer = document.getElementById('testCardsContainer');
const testCount = document.getElementById('testCount');
const authBtn = document.getElementById('authBtn');
const userBox = document.getElementById('userBox');
const uAvatar = document.getElementById('uAvatar');
const uName = document.getElementById('uName');

const testInterface = document.getElementById('testInterface');
const testTitle = document.getElementById('testTitle');
const questionText = document.getElementById('questionText');
const optionsContainer = document.getElementById('optionsContainer');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const timerEl = document.getElementById('timer');
const qGrid = document.getElementById('qGrid');

let currentUser = null;
let currentTest = null;
let currentQuestionIndex = 0;
let userAnswers = [];
let timeLeft = 0;
let timerInterval = null;

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  if (user) {
    authBtn.textContent = 'Chiqish';
    authBtn.classList.remove('btn-light'); authBtn.classList.add('btn-outline-light');
    uAvatar.src = user.photoURL || ''; uName.textContent = user.displayName || user.email; userBox.classList.remove('d-none');
  } else {
    authBtn.textContent = 'Google bilan kirish';
    authBtn.classList.add('btn-light'); authBtn.classList.remove('btn-outline-light');
    userBox.classList.add('d-none');
  }
});

authBtn.addEventListener('click', async () => { if (currentUser) await logOut(); else await signIn(); });

async function loadTests() {
  const qs = query(collection(db, 'tests'), where('isActive', '==', true), orderBy('createdAt', 'desc'));
  const snap = await getDocs(qs);
  const tests = [];
  for (const d of snap.docs) {
    const t = { id: d.id, ...d.data() };
    const qSnap = await getDocs(collection(db, `tests/${d.id}/questions`));
    t.questionCount = qSnap.size;
    tests.push(t);
  }
  renderTestCards(tests);
}
function renderTestCards(tests){
  testCardsContainer.innerHTML=''; testCount.textContent = `${tests.length} ta test`;
  tests.forEach(test => {
    const col = document.createElement('div'); col.className='col-md-4';
    col.innerHTML = `
      <div class="card test-card">
        <div class="card-header d-flex justify-content-between align-items-center">
          <span>${test.title}</span>
          <span class="badge bg-${difficultyColor(test.difficulty)}">${test.difficulty || "O'rta"}</span>
        </div>
        <div class="card-body">
          <p class="card-text">${test.description || ''}</p>
          <div class="d-flex justify-content-between text-muted">
            <span><i class="fas fa-question-circle me-1"></i>${test.questionCount} savol</span>
            <span><i class="fas fa-clock me-1"></i>${test.duration || 20} daqiqa</span>
          </div>
          <div class="d-grid gap-2 mt-3">
            <button class="btn btn-primary start-test" data-id="${test.id}">Boshlash</button>
            <a class="btn btn-outline-secondary" href="./test-rating.html?testId=${test.id}">Test reytingi</a>
          </div>
        </div>
      </div>`;
    testCardsContainer.appendChild(col);
  });
  document.querySelectorAll('.start-test').forEach(btn => btn.addEventListener('click', () => startTest(btn.dataset.id)));
}
function difficultyColor(d){ if(d==='Oson')return'success'; if(d==='Murakkab')return'danger'; return'warning'; }

async function startTest(testId){
  const tDoc = await getDoc(doc(db, 'tests', testId)); if (!tDoc.exists()) return alert('Test topilmadi');
  const tData = { id: tDoc.id, ...tDoc.data() };
  const qSnap = await getDocs(collection(db, `tests/${testId}/questions`));
  const questions = qSnap.docs.map(d=>({ id:d.id, ...d.data()})).sort((a,b)=>(a.order??0)-(b.order??0));
  currentTest = { ...tData, questions };
  currentQuestionIndex = 0; userAnswers = new Array(questions.length).fill(null);
  timeLeft = (currentTest.duration || 20) * 60;
  testTitle.textContent = currentTest.title;
  testInterface.style.display='block'; testInterface.scrollIntoView({behavior:'smooth'});
  buildGrid(); startTimer(); showQuestion(0);
}
function buildGrid(){
  qGrid.innerHTML='';
  currentTest.questions.forEach((_,i)=>{
    const b=document.createElement('button'); b.textContent=i+1;
    b.addEventListener('click', ()=>{ currentQuestionIndex=i; showQuestion(i); });
    qGrid.appendChild(b);
  });
}
function startTimer(){ if(timerInterval) clearInterval(timerInterval); tick();
  timerInterval=setInterval(()=>{ timeLeft--; tick(); if(timeLeft<=0){ clearInterval(timerInterval); finishTest(); }},1000); }
function tick(){ const m=String(Math.floor(timeLeft/60)).padStart(2,'0'); const s=String(timeLeft%60).padStart(2,'0'); timerEl.textContent=`${m}:${s}`; timerEl.style.color = timeLeft<300?'#dc3545':'var(--primary-color)'; }

function typeset(){ if (window.MathJax?.typesetPromise) window.MathJax.typesetPromise(); }

function showQuestion(i){
  const q=currentTest.questions[i];
  // Allow LaTeX in question and options
  questionText.innerHTML = q.text;
  optionsContainer.innerHTML='';
  q.options.forEach((opt,idx)=>{
    const el=document.createElement('div');
    el.className=`option ${userAnswers[i]===idx?'selected':''}`;
    el.innerHTML = opt;
    el.addEventListener('click', ()=> selectOption(idx));
    optionsContainer.appendChild(el);
  });
  const pct=((i+1)/currentTest.questions.length)*100; progressBar.style.width=`${pct}%`; progressText.textContent=`${i+1}/${currentTest.questions.length}`;
  prevBtn.disabled = i===0; nextBtn.textContent = i===currentTest.questions.length-1 ? 'Yakunlash' : 'Keyingi';
  [...qGrid.children].forEach((b,idx)=>{ b.classList.toggle('active', idx===i); b.classList.toggle('answered', userAnswers[idx]!==null); });
  typeset();
}
function selectOption(idx){ userAnswers[currentQuestionIndex]=idx; showQuestion(currentQuestionIndex); }
prevBtn.addEventListener('click', ()=>{ if(currentQuestionIndex>0){ currentQuestionIndex--; showQuestion(currentQuestionIndex); }});
nextBtn.addEventListener('click', ()=>{ if(currentQuestionIndex<currentTest.questions.length-1){ currentQuestionIndex++; showQuestion(currentQuestionIndex); } else { finishTest(); }});

async function finishTest(){
  if(!currentTest) return; clearInterval(timerInterval);
  let correct=0, earned=0, total=0;
  currentTest.questions.forEach((q,i)=>{ const ok = userAnswers[i]===q.correctIndex; const pts=q.points??1; total+=pts; if(ok){ correct++; earned+=pts; } });
  const scorePercent = Math.round((earned/total)*100);
  try{
    await addDoc(collection(db, 'attempts'),{
      userId: auth.currentUser?.uid || null,
      userName: auth.currentUser?.displayName || auth.currentUser?.email || 'Anon',
      testId: currentTest.id, testTitle: currentTest.title,
      answers: userAnswers, correctCount: correct, earnedPoints: earned, totalPoints: total, scorePercent,
      startedAt: serverTimestamp(), finishedAt: serverTimestamp()
    });
  }catch(e){ console.error(e); }
  testInterface.innerHTML = `
    <div class="text-center">
      <h3 class="mb-3">Test yakunlandi!</h3>
      <div class="display-4 fw-bold text-${scorePercent>=70?'success':'danger'} mb-2">${scorePercent}%</div>
      <p class="mb-4">${currentTest.questions.length} savoldan ${correct} tasi to'g'ri. Ball: ${earned}/${total}</p>
      <div class="d-grid gap-2 d-sm-flex justify-content-sm-center">
        <button id="retryBtn" class="btn btn-primary">Qayta urinish</button>
        <a class="btn btn-outline-secondary" href="#tests">Testlar ro'yxati</a>
        <a class="btn btn-outline-primary" href="./test-rating.html?testId=${currentTest.id}">Test reytingi</a>
      </div>
    </div>`;
  document.getElementById('retryBtn').addEventListener('click', ()=> startTest(currentTest.id));
}

loadTests();
