// === Sozlamalar ===
// ?file=algebra1.json orqali fayl tanlash, bo'lmasa test.json yuklaydi
const DEFAULT_TEST_FILE = 'test.json';
const SAVE_TO_FIRESTORE = true; // Firestore'ga result yozishni xohlamasangiz false qiling

// === Firebase (ixtiyoriy, bor loyihangdagi konfiguratsiya) ===
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey:"AIzaSyDYwHJou_9GqHZcf8XxtTByC51Z8un8rrM",
  authDomain:"xplusy-760fa.firebaseapp.com",
  projectId:"xplusy-760fa",
  storageBucket:"xplusy-760fa.firebasestorage.app",
  messagingSenderId:"992512966017",
  appId:"1:992512966017:web:5e919dbc9b8d8abcb43c80",
  measurementId:"G-459PLJ7P7L"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// === UI elementlar ===
const testTitleEl = document.getElementById('testTitle');
const counterEl   = document.getElementById('counter');
const timerEl     = document.getElementById('timer');
const barEl       = document.getElementById('bar');
const qwrap       = document.getElementById('qwrap');
const btnPrev     = document.getElementById('btnPrev');
const btnNext     = document.getElementById('btnNext');
const btnFinish   = document.getElementById('btnFinish');
const scoreHint   = document.getElementById('scoreHint');
const qnav         = document.getElementById('qnav');
const qnavGrid     = document.getElementById('qnavGrid');
const btnQnavToggle= document.getElementById('btnQnavToggle');
const btnQnavClose = document.getElementById('btnQnavClose');
const qnavOverlay  = document.getElementById('qnavOverlay');

const qnav         = document.getElementById('qnav');
const qnavGrid     = document.getElementById('qnavGrid');
const btnQnavToggle= document.getElementById('btnQnavToggle');


// === Holat ===
let TEST = null;
let idx = 0;
let answers = []; // foydalanuvchi tanlovi: option index yoki null
let timerId = null;
let remain = 0; // soniya
let initialRemain = 0;

// === Yordamchi ===
function qs(name, url = window.location.href) {
  const u = new URL(url);
  return u.searchParams.get(name);
}
function fmtTime(s) {
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
}
function sumMaxPoints() {
  return TEST.questions.reduce((acc,q)=> acc + (q.points||1), 0);
}
function progress() {
  const answered = answers.filter(a => a !== null && a !== undefined).length;
  barEl.style.width = `${Math.round(100 * answered / TEST.questions.length)}%`;
}
async function typeset() {
  if (window.MathJax && window.MathJax.typesetPromise) {
    await MathJax.typesetPromise();
  }
}


// === Savollar navigatori ===
function renderQNav(){
  if (!TEST) return;
  const total = TEST.questions.length;
  let html = '';
  for (let i=0;i<total;i++){
    const answered = (answers[i] !== null && answers[i] !== undefined);
    const classes = ['qnav__btn'];
    if (answered) classes.push('answered');
    if (i === idx) classes.push('active');
    html += `<button class="${classes.join(' ')}" data-go="${i}" role="listitem" aria-label="Savol ${i+1}">${i+1}</button>`;
  }
  qnavGrid.innerHTML = html;
  // click handler (delegate)
  qnavGrid.querySelectorAll('button[data-go]').forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      const to = parseInt(e.currentTarget.dataset.go,10);
      if (!isNaN(to)){
        idx = to;
        renderQuestion();
        renderQNav();
      }
    });
  });
}


// === Savol renderi ===
function renderQuestion() {
  const q = TEST.questions[idx];
  const total = TEST.questions.length;
  counterEl.textContent = `Savol: ${idx+1}/${total}`;

  let html = `
    <div class="muted">Ball: ${q.points || 1}</div>
    <div class="q-text" style="font-size:18px;line-height:1.5;margin-top:6px">${q.text}</div>
  `;

  if (q.image) {
    html += `
      <div class="q-media"><img src="${q.image}" alt="savol rasmi" loading="lazy"/></div>
    `;
  }

  html += `<div class="options">`;
  q.options.forEach((opt, i) => {
    const checked = answers[idx] === i ? 'checked' : '';
    html += `
      <label class="opt">
        <input type="radio" name="opt" value="${i}" ${checked}/>
        <div>
          <div><strong>${opt.id || String.fromCharCode(65+i)}</strong></div>
          <div>${opt.text}</div>
        </div>
      </label>
    `;
  });
  html += `</div>`;

  qwrap.innerHTML = html;

  // radio change
  qwrap.querySelectorAll('input[name="opt"]').forEach(r => {
    r.addEventListener('change', (e) => {
      answers[idx] = parseInt(e.target.value,10);
      progress();
      renderQNav();
      typeset();
      renderQNav();
      typeset();
    });
  });

  // tugmalar holati
  btnPrev.disabled = (idx === 0);
  btnNext.disabled = (idx === total-1);

  // MathJax re-typeset
  typeset();
}

// === Yakun va baholash ===
function calcScore() {
  let score = 0;
  TEST.questions.forEach((q, i) => {
    if (answers[i] === q.correctIndex) score += (q.points || 1);
  });
  return score;
}


async function finishTest(auto=false) {
  const max = sumMaxPoints();
  const score = calcScore();
  const percent = Math.round(100 * score / max);
  const totalQ = TEST.questions.length;
  let correctCount = 0;
  TEST.questions.forEach((q, i) => { if (answers[i] === q.correctIndex) correctCount++; });
  const durationSeconds = Number(TEST.durationSeconds || 0);
  const timeTakenSeconds = durationSeconds ? Math.max(0, durationSeconds - remain) : null;

  // Natija ekrani
  qwrap.innerHTML = `
    <div class="center" style="flex-direction:column;gap:10px">
      <div style="font-family:Montserrat;font-size:22px">Test yakunlandi</div>
      <div class="pill">Ball: <strong>${score}</strong> / ${max} — ${percent}%</div>
      <div class="muted">${auto ? "Vaqt tugadi — test avtomatik yakunlandi." : "Tabriklaymiz!"}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center">
        <a class="btn" href="natijalar.html"><i class="fa-solid fa-chart-line"></i> Natijalar</a>
        <button class="btn" id="btnReview"><i class="fa-regular fa-eye"></i> Javoblarni ko‘rish</button>
      </div>
    </div>
  `;
  typeset();

  btnPrev.style.display = 'none';
  btnNext.style.display = 'none';
  btnFinish.style.display = 'none';
  document.getElementById('btnReview').addEventListener('click', showReview);

  // Firestore (ixtiyoriy)
  if (SAVE_TO_FIRESTORE) {
    const u = auth.currentUser;
    if (!u) {
      try { await signInWithPopup(auth, provider); } catch {}
    }
    const user = auth.currentUser;
    try {
      await addDoc(collection(db,'results'), {
        uid: user ? user.uid : null,
        title: TEST.title || 'Test',
        testId: TEST.id || null,
        score, max, percent,
        totalQuestions: totalQ,
        correctCount: correctCount,
        durationSeconds: durationSeconds || null,
        timeTakenSeconds: timeTakenSeconds,
        createdAt: serverTimestamp()
      });
    } catch (e) {
      console.warn('Natijani saqlashda xatolik:', e);
    }
  }
}
</strong> / ${max} — ${percent}%</div>
      <div class="muted">${auto ? "Vaqt tugadi — test avtomatik yakunlandi." : "Tabriklaymiz!"}</div>
      <button class="btn" id="btnReview"><i class="fa-regular fa-eye"></i> Javoblarni ko‘rish</button>
    </div>
  `;
  typeset();

  btnPrev.style.display = 'none';
  btnNext.style.display = 'none';
  btnFinish.style.display = 'none';
  document.getElementById('btnReview').addEventListener('click', showReview);

  // Firestore (ixtiyoriy)
  if (SAVE_TO_FIRESTORE) {
    const u = auth.currentUser;
    if (!u) {
      try { await signInWithPopup(auth, provider); }
      catch { /* foydalanuvchi bekor qildi */ }
    }
    const user = auth.currentUser;
    try {
      await addDoc(collection(db,'results'), {
        uid: user ? user.uid : null,
        title: TEST.title || 'Test',
        testId: TEST.id || null,
        questionsCount: Array.isArray(TEST.questions) ? TEST.questions.length : null,
        durationSeconds: TEST.durationSeconds || null,
        score, max, percent,
        createdAt: serverTimestamp()
      });
} catch (e) {
      console.warn('Natijani saqlashda xatolik:', e);
    }
  }
}

// === Review rejimi ===
function showReview() {
  let html = '';
  TEST.questions.forEach((q, i) => {
    const user = answers[i];
    const ok = user === q.correctIndex;
    html += `
      <div class="card" style="margin-top:12px"><div class="card__body">
        <div class="muted">Savol ${i+1} • Ball: ${q.points||1} — ${ok ? '✅ To‘g‘ri' : '❌ Noto‘g‘ri'}</div>
        <div style="margin-top:6px">${q.text}</div>
        ${q.image ? `<div class="q-media"><img src="${q.image}" alt="review img"/></div>` : ''}
        <div class="options" style="margin-top:10px">
          ${q.options.map((opt, j) => {
            const mark =
              (j === q.correctIndex) ? ' <span class="pill">To‘g‘ri</span>' :
              (j === user) ? ' <span class="pill" style="background:#FEE2E2;border-color:#fecaca">Sizning tanlov</span>' : '';
            return `<div class="opt" style="cursor:default">${opt.id || String.fromCharCode(65+j)}. ${opt.text}${mark}</div>`;
          }).join('')}
        </div>
      </div></div>
    `;
  });
  qwrap.innerHTML = html;
  typeset();
}

// === Timer ===
function startTimer() {
  remain = Number(TEST.durationSeconds || 0);
  initialRemain = remain;
  timerEl.textContent = fmtTime(remain);
  if (timerId) clearInterval(timerId);
  if (!remain) return;

  timerId = setInterval(() => {
    remain--;
    timerEl.textContent = fmtTime(remain);
    if (remain <= 0) {
      clearInterval(timerId);
      finishTest(true);
    }
  }, 1000);
}

// === Boshlash ===
async function bootstrap() {
  const file = qs('file') || DEFAULT_TEST_FILE;
  const res = await fetch(file, {cache: 'no-store'});
  TEST = await res.json();

  testTitleEl.textContent = TEST.title || 'Test';
  answers = Array(TEST.questions.length).fill(null);
  scoreHint.textContent = `Ball: 0 / ${sumMaxPoints()}`;
  renderQuestion();
  progress();
  startTimer();

  onAuthStateChanged(auth, () => { /* noop */ });

  btnPrev.addEventListener('click', () => {
    if (idx>0) { idx--; renderQuestion(); renderQNav(); }
  });
  btnNext.addEventListener('click', () => {
    if (idx < TEST.questions.length-1) { idx++; renderQuestion(); renderQNav(); }
  });
  btnFinish.addEventListener('click', () => {
    finishTest(false);
  });

  qwrap.addEventListener('change', () => {
    const score = calcScore();
    scoreHint.textContent = `Ball: ${score} / ${sumMaxPoints()}`;
  });
}

bootstrap();
