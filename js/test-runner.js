
import { $, $$, showModal, renderMath, money } from './common.js';
import { loadCSV } from './csv-loader.js';
import { db, auth } from './app.js';
import { doc, runTransaction, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

function parseQuestions(rows){
  const hdr = rows[0].map(h=>h.toLowerCase());
  const f = (k)=> hdr.findIndex(h=>h.includes(k));
  const iImg=f('img'), iQ=f('savol'), iAns=f("to'g'ri"), j1=f('javob1'), j2=f('javob2'), j3=f('javob3'), iPlus=f('+olmos'), iMinus=f('-olmos');
  return rows.slice(1).map((r,idx)=>({
    n: idx+1,
    img: iImg>-1? r[iImg] : "",
    q: iQ>-1? r[iQ] : r[1],
    correct: iAns>-1? r[iAns] : r[2],
    options: [r[j1]||"", r[j2]||"", r[j3]||""].filter(Boolean),
    plus: Number(r[iPlus]||0),
    minus: Number(r[iMinus]||0)
  }));
}

export async function runTest(root, {src, price=0, title="Test", perQuestionSec=120}){
  // Payment confirm
  const ok = await showModal({title:"To'lov", body:`<p>Ushbu test narxi <b>${money(price)}</b>. Davom etasizmi?</p>`, okText:"Ha"});
  if(!ok){ root.innerHTML = "<div class='container'><div class='card'>Bekor qilindi.</div></div>"; return; }
  if(!auth.currentUser){ await showModal({title:"Kirish kerak", body:"Iltimos, Google orqali kiring."}); location.hash="#home"; return; }

  // Deduct via transaction
  await runTransaction(db, async (tx)=>{
    const ref = doc(db,'users',auth.currentUser.uid);
    const snap = await tx.get(ref);
    if(!snap.exists()) throw new Error("User doc topilmadi");
    const u = snap.data(); const bal = Number(u.balance||0);
    if(bal < price) throw new Error("Balans yetarli emas.");
    tx.update(ref, { balance: bal - Number(price||0), lastPurchase: serverTimestamp() });
  });

  const rows = await loadCSV(src);
  const qs = parseQuestions(rows);
  const total = qs.length * perQuestionSec;
  const state = {i:0, left: total, ans:new Map()};

  root.innerHTML = `<div class="container">
    <div class="banner"><h2>📝 ${title}</h2></div>
    <div class="card"><span class="timer" id="timer">--:--</span></div>
    <div class="card" id="panel"></div>
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

  // q buttons
  const qbar = $('#qbar');
  qs.forEach((_,k)=>{
    const b=document.createElement('button'); b.className='qbtn'; b.textContent=String(k+1);
    b.onclick=()=>{ state.i=k; render(); };
    qbar.appendChild(b);
  });

  $('#prev').onclick=()=>{ if(state.i>0){ state.i--; render(); } };
  $('#next').onclick=()=>{ if(state.i<qs.length-1){ state.i++; render(); } };
  $('#finish').onclick=finish;

  function render(){
    $$('.qbtn', qbar).forEach((e,k)=> e.classList.toggle('active', k===state.i));
    const q = qs[state.i];
    const el = $('#panel'); const sel = state.ans.get(q.n) || null;
    el.innerHTML = `
      <div class="meta">Savol ${q.n}/${qs.length}</div>
      ${q.img? `<img src="${q.img}" style="max-width:100%;border-radius:12px;margin:6px 0">` : ""}
      <h3>${q.q}</h3>
      <div id="choices"></div>
    `;
    const choices = $('#choices');
    const opts = [q.correct, ...q.options];
    opts.forEach(t=>{
      const d=document.createElement('div');
      d.className='choice'; d.textContent=t;
      if(sel===t) d.classList.add('selected');
      d.onclick=()=>{ state.ans.set(q.n,t); $$('.choice',choices).forEach(x=>x.classList.remove('selected')); d.classList.add('selected'); };
      choices.appendChild(d);
    });
    renderMath();
  }

  // timer
  function tick(){
    state.left--;
    if(state.left<=0){ finish(); return; }
    const m=String(Math.floor(state.left/60)).padStart(2,'0');
    const s=String(Math.floor(state.left%60)).padStart(2,'0');
    $('#timer').textContent=`${m}:${s}`;
    requestAnimationFrame(()=>setTimeout(tick,1000));
  }
  tick(); render();

  async function finish(){
    let plus=0, minus=0, good=0, bad=0;
    qs.forEach(q=>{
      const a=state.ans.get(q.n);
      if(!a) return;
      if(a===q.correct){ good++; plus+=q.plus||0; } else { bad++; minus+=q.minus||0; }
    });
    const delta = (plus - minus)|0;
    await showModal({title:"Natija", body:`<p>To'g'ri: <b>${good}</b> | Noto'g'ri: <b>${bad}</b></p><p>Olmos: <b>${delta>=0? '+'+delta: delta}</b></p>`, okText:"Saqlash"});
    // Save result + gems
    await runTransaction(db, async (tx)=>{
      const ref = doc(db,'users',auth.currentUser.uid);
      const snap = await tx.get(ref);
      const u = snap.data(); const gems = Number(u.gems||0)+delta;
      const attempts = Number(u.attempts||0)+1;
      tx.update(ref, { gems, attempts, lastResult: {title,src,good,bad,delta,ts: Date.now()}, updatedAt: new Date() });
    });
    location.hash="#leaderboard";
  }
}
