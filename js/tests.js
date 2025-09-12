import { $, $all, modal, renderMath } from './common.js';
import { loadCSV } from './csv.js';
import { db, auth } from './app.js';
import { doc, runTransaction, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

function parseQuestions(rows){
  // Expected header: img | Savol | To'g'ri | Javob1 | Javob2 | Javob3 | +Olmos | -Olmos
  const header = rows[0].map(h=>h.toLowerCase());
  const idx = (name)=> header.findIndex(h => h.includes(name));
  const im = idx('img'); const qs = idx('savol'); const ans = idx("to'g'ri");
  const j1 = idx('javob1'); const j2 = idx('javob2'); const j3 = idx('javob3');
  const plus = idx('+olmos'); const minus = idx('-olmos');
  const out = rows.slice(1).map((r,i)=> ({
    n:i+1,
    img: im>-1? r[im] : "",
    q: qs>-1? r[qs] : r[1],
    correct: ans>-1? r[ans] : r[2],
    options: [r[j1]||"", r[j2]||"", r[j3]||""].filter(Boolean),
    plus: Number(r[plus]||0), minus: Number(r[minus]||0),
  }));
  // Ensure correct is first option for your rule if desired; but we keep separate.
  return out;
}

export async function startTest(root, {src, price=0, title="Test", perQuestionSec=120}){
  root.innerHTML = `<div class="container test-wrap">
    <div class="banner"><h2>📝 ${title}</h2></div>
    <div class="kv"><span class="timer" id="timer">--:--</span><span class="badge">Narx: ${Number(price).toLocaleString()} so'm</span></div>
    <div class="card" id="qpanel"></div>
    <div class="card">
      <div class="qbar" id="qbar"></div>
      <div style="display:flex; gap:8px; margin-top:10px">
        <button class="btn ghost" id="prev">⬅️ Oldingi</button>
        <div class="spacer"></div>
        <button class="btn ghost" id="next">Keyingi ➡️</button>
        <button class="btn primary" id="finish">Yakunlash</button>
      </div>
    </div>
  </div>`;

  // Confirm payment
  const ok = await modal({title:"To'lov tasdiqlansin",
    body:`<p>Ushbu testni yechish uchun <b>${Number(price).toLocaleString()} so'm</b> yechiladi. Tasdiqlaysizmi?</p>`,
    okText:"Tasdiqlayman"});
  if(!ok){ root.innerHTML = "<div class='container'><div class='card'>Bekor qilindi.</div></div>"; return; }

  // Deduct balance atomically
  if(!auth.currentUser){ await modal({title:"Kirish talab qilinadi", body:"Iltimos, Google orqali kiring."}); location.hash="#home"; return; }
  await payOnce(price);

  const rows = await loadCSV(src);
  const questions = parseQuestions(rows);
  const totalSec = questions.length * perQuestionSec;
  const state = {i:0, answers:new Map(), good:0, bad:0, left:totalSec };

  // Build qbar
  const qbar = $('#qbar');
  questions.forEach((q, idx)=>{
    const b = document.createElement('button');
    b.className="qbtn"; b.textContent=String(idx+1);
    b.onclick=()=>{ state.i=idx; renderQuestion(); };
    qbar.appendChild(b);
  });

  $('#prev').onclick=()=>{ if(state.i>0){state.i--; renderQuestion();} };
  $('#next').onclick=()=>{ if(state.i<questions.length-1){state.i++; renderQuestion();} };
  $('#finish').onclick=finish;

  function renderQuestion(){
    $all('.qbtn', qbar).forEach((e,k)=> e.classList.toggle('active', k===state.i));
    const q = questions[state.i];
    const wrap = $('#qpanel');
    wrap.innerHTML = `
      <div class="meta">Savol ${q.n} / ${questions.length}</div>
      ${q.img? `<img src="${q.img}" alt="" style="max-width:100%;border-radius:12px;margin:6px 0">` : ""}
      <h3>${q.q}</h3>
      <div class="choices"></div>
    `;
    const ch = wrap.querySelector('.choices');
    const opts = [q.correct, ...q.options]; // rule: correct always first in CSV
    opts.forEach((t, idx)=>{
      const d = document.createElement('div');
      d.className = 'choice';
      d.textContent = t;
      const key = `${q.n}`;
      if(state.answers.get(key) === t) d.classList.add('selected');
      d.onclick = ()=>{
        state.answers.set(key, t);
        $all('.choice', ch).forEach(x=>x.classList.remove('selected'));
        d.classList.add('selected');
      };
      ch.appendChild(d);
    });
    renderMath();
  }

  // timer
  function tick(){
    state.left--;
    if(state.left<=0){ finish(); return; }
    const m = Math.floor(state.left/60).toString().padStart(2,'0');
    const s = Math.floor(state.left%60).toString().padStart(2,'0');
    $('#timer').textContent = `${m}:${s}`;
    requestAnimationFrame(()=>setTimeout(tick, 1000));
  }
  tick();
  renderQuestion();

  async function finish(){
    // compute score & gem change
    let plus=0, minus=0, correctCount=0, wrongCount=0;
    questions.forEach(q=>{
      const key = `${q.n}`;
      const a = state.answers.get(key);
      if(!a) return;
      if(a === q.correct){ correctCount++; plus += q.plus||0; }
      else { wrongCount++; minus += q.minus||0; }
    });
    const deltaGems = (plus - minus) | 0;
    const body = `<p>To'g'ri: <b class='result-good'>${correctCount}</b>, Noto'g'ri: <b class='result-bad'>${wrongCount}</b></p>
                  <p>Olmos o'zgarishi: <b>${deltaGems >= 0 ? '+'+deltaGems : deltaGems}</b></p>`;
    await modal({title:"Natija", body, okText:"Saqlash"});
    await saveResult({title, src, correctCount, wrongCount, deltaGems});
    location.hash = "#leaderboard";
  }

  async function payOnce(price){
    const { getFirestore } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    const ref = doc(db, 'users', auth.currentUser.uid);
    await runTransaction(db, async (tx)=>{
      const snap = await tx.get(ref);
      if(!snap.exists()) throw new Error("User doc topilmadi.");
      const u = snap.data();
      const bal = Number(u.balance||0);
      if(bal < price) throw new Error("Balans yetarli emas.");
      tx.update(ref, { balance: bal - Number(price||0), lastPurchase: serverTimestamp() });
    });
  }

  async function saveResult(res){
    const ref = doc(db, 'users', auth.currentUser.uid);
    await runTransaction(db, async (tx)=>{
      const snap = await tx.get(ref);
      if(!snap.exists()) throw new Error("User doc yo'q.");
      const u = snap.data();
      const gems = Number(u.gems||0) + Number(res.deltaGems||0);
      const attempts = Number(u.attempts||0) + 1;
      tx.update(ref, { gems, attempts, lastResult: res, updatedAt: serverTimestamp() });
    });
  }
}
