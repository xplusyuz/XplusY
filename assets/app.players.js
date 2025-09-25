/* Modals injected for Test and Course players */
const $__ = (s,r=document)=>r.querySelector(s);
const $$_ = (s,r=document)=>Array.from(r.querySelectorAll(s));

(function ensureModals(){
  if ($__('#test-modal')) return;
  const div = document.createElement('div');
  div.innerHTML = `
  <div class="modal-backdrop" id="test-modal">
    <div class="modal" style="max-width: 720px; width:94%">
      <header>
        <b id="test-title">Test</b>
        <button class="close" id="test-close">×</button>
      </header>
      <div style="padding:16px">
        <div style="display:flex; gap:12px; align-items:center; margin-bottom:12px">
          <div class="badge"><span id="test-timer">00:00</span></div>
          <div class="badge" id="test-progress">1 / 1</div>
          <div class="badge" id="test-score">Ball: 0</div>
        </div>
        <div id="test-qwrap" class="granite-card" style="padding:12px"></div>
        <div style="display:flex; justify-content:space-between; gap:8px; margin-top:12px">
          <button class="tab-btn" id="test-prev">← Oldingi</button>
          <div style="display:flex; gap:8px">
            <button class="tab-btn" id="test-skip">O‘tkazib yubor</button>
            <button class="primary" id="test-next">Keyingi →</button>
          </div>
        </div>
        <div style="margin-top:10px; text-align:right">
          <button class="primary" id="test-submit">Testni topshirish</button>
        </div>
      </div>
    </div>
  </div>
  <div class="modal-backdrop" id="course-modal">
    <div class="modal" style="max-width: 920px; width:96%">
      <header>
        <b id="course-title">Kurs</b>
        <button class="close" id="course-close">×</button>
      </header>
      <div style="display:grid; grid-template-columns: 280px 1fr; gap:12px; padding:12px">
        <aside class="granite-card" style="padding:8px; max-height:60vh; overflow:auto" id="course-lessons"></aside>
        <section>
          <div class="granite-card" style="padding:8px">
            <div id="course-player" style="aspect-ratio:16/9; background:#000; border-radius:8px; overflow:hidden"></div>
          </div>
          <div class="granite-card" style="padding:12px; margin-top:10px" id="course-desc"></div>
        </section>
      </div>
    </div>
  </div>`;
  document.body.appendChild(div.firstElementChild);
  document.body.appendChild(div.lastElementChild);
})();

$__('#test-close')?.addEventListener('click', ()=> $__('#test-modal').style.display='none');
$__('#course-close')?.addEventListener('click', ()=> $__('#course-modal').style.display='none');
$__('#test-modal')?.addEventListener('click', e=>{ if(e.target.id==='test-modal') e.currentTarget.style.display='none'; });
$__('#course-modal')?.addEventListener('click', e=>{ if(e.target.id==='course-modal') e.currentTarget.style.display='none'; });

let TEST_STATE = null;
function secondsToMMSS(s){ s=Math.max(0,s|0); const m=Math.floor(s/60), ss=(s%60).toString().padStart(2,'0'); return `${m}:${ss}`; }
function calcScore(answers, questions){ let correct=0; questions.forEach((q,i)=>{ if (answers[i]==null) return; if (q.correctIndex===answers[i]) correct++; }); return {correct, total: questions.length, score: Math.round(100*correct/questions.length)}; }
function renderQuestion(idx){
  const st = TEST_STATE; if(!st) return;
  const q = st.questions[idx]; const wrap = $__('#test-qwrap');
  $__('#test-progress').textContent = `${idx+1} / ${st.questions.length}`;
  $__('#test-score').textContent = `Ball: ${calcScore(st.answers, st.questions).score}`;
  const opts = q.options || [q.A,q.B,q.C,q.D].filter(Boolean);
  wrap.innerHTML = `<div style="font-weight:700; margin-bottom:8px">${idx+1}. ${q.q||''}</div>
    <div style="display:grid; gap:8px">
      ${opts.map((op,oi)=>{
        const sel = (st.answers[idx]===oi) ? 'border-color:#4CAF50; box-shadow:0 0 0 3px rgba(76,175,80,.15)' : '';
        return `<label style="display:flex; gap:8px; align-items:flex-start; border:1px solid var(--border-color); padding:10px; border-radius:10px; cursor:pointer; ${sel}">
          <input type="radio" name="q${idx}" value="${oi}" ${st.answers[idx]===oi?'checked':''} style="margin-top:4px">
          <div>${op||''}</div></label>`;
      }).join('')}
    </div>`;
  $$_(`input[name="q${idx}"]`, wrap).forEach(r=> r.addEventListener('change', e=>{
    st.answers[idx] = parseInt(e.target.value,10);
    $__('#test-score').textContent = `Ball: ${calcScore(st.answers, st.questions).score}`;
  }));
}
async function openTestById(id){
  const snap = await db.collection('tests').doc(id).get();
  if (!snap.exists){ alert('Test topilmadi'); return; }
  const d = snap.data();
  const questions = Array.isArray(d.questions)? d.questions : (d.questions||[]);
  const timerSec = d.timerSec || (d.durationMin? d.durationMin*60 : 1800);
  TEST_STATE = { id, title: d.title||'Test', timerSec, startedAt: Date.now(), remaining: timerSec, questions, cur:0, answers: new Array(questions.length).fill(null), timerId:null, finished:false };
  $__('#test-title').textContent = TEST_STATE.title;
  $__('#test-modal').style.display='flex';
  renderQuestion(0);
  clearInterval(TEST_STATE.timerId);
  $__('#test-timer').textContent = secondsToMMSS(TEST_STATE.remaining);
  TEST_STATE.timerId = setInterval(()=>{
    TEST_STATE.remaining--; $__('#test-timer').textContent = secondsToMMSS(TEST_STATE.remaining);
    if (TEST_STATE.remaining<=0){ clearInterval(TEST_STATE.timerId); submitTest(true); }
  }, 1000);
}
async function submitTest(auto=false){
  const st = TEST_STATE; if(!st||st.finished) return;
  st.finished = true; clearInterval(st.timerId);
  const user = firebase.auth().currentUser; if (!user){ alert('Kirish talab qilinadi'); return; }
  const r = calcScore(st.answers, st.questions);
  const payload = { uid: user.uid, testId: st.id, title: st.title, score: r.score, correctCount: r.correct, wrongCount: r.total-r.correct, timeSpentSec: st.timerSec - Math.max(0, st.remaining), takenAt: firebase.firestore.FieldValue.serverTimestamp(), answers: st.answers };
  await db.collection('results').add(payload);
  alert((auto?'Vaqt tugadi. ':'') + `Natija: ${r.correct}/${r.total} (Ball: ${r.score}) saqlandi.`);
  $__('#test-modal').style.display='none';
}
$__('#test-next')?.addEventListener('click', ()=>{ if(!TEST_STATE) return; TEST_STATE.cur=Math.min(TEST_STATE.cur+1, TEST_STATE.questions.length-1); renderQuestion(TEST_STATE.cur); });
$__('#test-prev')?.addEventListener('click', ()=>{ if(!TEST_STATE) return; TEST_STATE.cur=Math.max(TEST_STATE.cur-1, 0); renderQuestion(TEST_STATE.cur); });
$__('#test-skip')?.addEventListener('click', ()=>{ if(!TEST_STATE) return; TEST_STATE.cur=Math.min(TEST_STATE.cur+1, TEST_STATE.questions.length-1); renderQuestion(TEST_STATE.cur); });
$__('#test-submit')?.addEventListener('click', ()=> submitTest(false));

document.addEventListener('click', (e)=>{
  const btn = e.target.closest('.cta'); if(!btn) return;
  const col = btn.getAttribute('data-col'), id = btn.getAttribute('data-id');
  if (col==='tests' && id) openTestById(id);
  if (col==='courses' && id) openCourseById(id);
});

function renderLessonItem(lesson, idx, activeIdx){
  const active = idx===activeIdx;
  return `<div class="card" data-lesson="${idx}" style="margin:6px 0; ${active?'outline:2px solid #4CAF50;':''}"><div class="content">
    <div class="title" style="margin:0 0 4px">${(idx+1)+'. '+ (lesson.title||'Dars')}</div>
    <div class="meta">${lesson.duration? (lesson.duration+' min • ') : ''}${lesson.source || ''}</div></div></div>`;
}
function renderPlayer(lesson){
  const el = $__('#course-player'); el.innerHTML = '';
  if (!lesson){ el.textContent='Dars topilmadi'; return; }
  if ((lesson.videoUrl||'').includes('youtube.com') || (lesson.videoUrl||'').includes('youtu.be')){
    const url = new URL(lesson.videoUrl); let id = url.searchParams.get('v');
    if (!id && lesson.videoUrl.includes('youtu.be/')) id = lesson.videoUrl.split('youtu.be/')[1].split(/[?&]/)[0];
    const iframe = document.createElement('iframe'); iframe.width='100%'; iframe.height='100%'; iframe.allowFullscreen = true; iframe.src=`https://www.youtube.com/embed/${id}`; iframe.style.border='0'; el.appendChild(iframe); return;
  }
  const v = document.createElement('video'); v.controls = true; v.style.width='100%'; v.style.height='100%';
  const src = document.createElement('source'); src.src = lesson.videoUrl || ''; src.type='video/mp4';
  v.appendChild(src); el.appendChild(v);
}
async function openCourseById(id){
  const snap = await db.collection('courses').doc(id).get();
  if (!snap.exists){ alert('Kurs topilmadi'); return; }
  const d = snap.data(); const lessons = Array.isArray(d.lessons)? d.lessons : [];
  let state = { idx:0, lessons };
  $__('#course-title').textContent = d.title || 'Kurs';
  $__('#course-desc').textContent = d.description || '';
  const list = $__('#course-lessons');
  function redrawList(){
    list.innerHTML = lessons.map((ls,i)=> renderLessonItem(ls,i,state.idx)).join('');
    $$_('#course-lessons .card').forEach(card=>{
      card.addEventListener('click', ()=>{ state.idx = parseInt(card.getAttribute('data-lesson'),10); redrawList(); renderPlayer(lessons[state.idx]); });
    });
  }
  redrawList(); renderPlayer(lessons[state.idx]);
  $__('#course-modal').style.display='flex';
}
