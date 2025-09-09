
// CSV utils
function esc(s){ return (s==null?'':String(s)).replace(/[&<>"']/g, m=>({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m])); }
function parseCSV(text){
  const rows = []; let i=0, cur=[], f='', q=false;
  const pf=()=>{cur.push(f); f=''}; const pr=()=>{rows.push(cur); cur=[]};
  while(i<text.length){ const c=text[i];
    if(q){ if(c=='"'){ if(text[i+1]=='"'){f+='"'; i+=2; continue;} q=false; i++; continue;} f+=c; i++; continue; }
    if(c=='"'){q=true; i++; continue;} if(c==','){pf(); i++; continue;} if(c=='\r'){i++; continue;}
    if(c=='\n'){pf(); pr(); i++; continue;} f+=c; i++;
  } pf(); if(cur.length>1||(cur.length===1&&cur[0]!=='')) pr();
  if(rows.length===0) return []; const h = rows[0].map(x=>x.trim());
  return rows.slice(1).filter(r=>r.some(v=>String(v).trim()!=='')).map(r=>{const o={}; h.forEach((k,j)=>o[k]=(r[j]??'').trim()); return o;});
}
async function fetchCSV(url){ const r=await fetch(url,{cache:"no-store"}); if(!r.ok) throw new Error("CSV yuklanmadi: "+url); return parseCSV(await r.text()); }
function uniq(rows,key){ return Array.from(new Set(rows.map(r=>r[key]).filter(Boolean))).sort(); }

// Firebase imports
import {
  auth, db, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut,
  doc, getDoc, setDoc, runTransaction, serverTimestamp
} from "./firebase-init.js";

const grid = document.getElementById("testsSections");
const wrap = document.getElementById("testWrap");
const balPill = document.getElementById("balancePill");
const btnLogin = document.getElementById("btnLogin");
const btnLogout = document.getElementById("btnLogout");
const userName = document.getElementById("userName");

let MAN=[], BYID={}; let CUR_USER=null, CUR_BAL=0;

btnLogin?.addEventListener("click", async ()=>{
  const prov = new GoogleAuthProvider();
  await signInWithPopup(auth, prov);
});
btnLogout?.addEventListener("click", async ()=>{ await signOut(auth); });

onAuthStateChanged(auth, async (u)=>{
  CUR_USER = u;
  userName.textContent = u ? `👤 ${u.displayName||u.email}` : "👤 Mehmon";
  btnLogin.classList.toggle("hidden", !!u);
  btnLogout.classList.toggle("hidden", !u);
  await ensureUserDoc(u);
  await refreshBalance();
  render(); // re-render cards with correct buttons
});

async function ensureUserDoc(u){
  if(!u) return;
  const uref = doc(db, "users", u.uid);
  const snap = await getDoc(uref);
  if(!snap.exists()){
    await setDoc(uref, {
      name: u.displayName||null,
      email: u.email||null,
      balance: 50000, // DEMO: 50 000 so'm start balans
      gems: 0,
      createdAt: serverTimestamp()
    }, { merge: true });
  }
}

async function refreshBalance(){
  if(!CUR_USER){ balPill.textContent="💵 —"; return; }
  const snap = await getDoc(doc(db, "users", CUR_USER.uid));
  CUR_BAL = Number(snap.exists()? (snap.data().balance||0) : 0);
  balPill.textContent = `💵 ${CUR_BAL.toLocaleString("ru-RU")} so‘m`;
}

// Load manifest
if(grid){
  (async()=>{
    MAN = await fetchCSV(grid.dataset.csv || "./csv/tests.csv");
    MAN.forEach(r=>BYID[r.id]=r);
    const planSel = document.getElementById("fPlan");
    const secSel  = document.getElementById("fSec");
    const f1Sel   = document.getElementById("f1");
    const f2Sel   = document.getElementById("f2");
    [planSel,secSel,f1Sel,f2Sel].forEach(sel=>{
      if(!sel) return;
      const key = sel.id==="fPlan"?"plan": sel.id==="fSec"?"section": sel.id;
      sel.innerHTML = uniq(MAN,key).map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join("");
      const o=document.createElement("option"); o.value=""; o.textContent="Hammasi"; sel.insertBefore(o, sel.firstChild); sel.value="";
      sel.addEventListener("change", render);
    });
    grid.addEventListener("click", onGridClick);
    render();
  })();
}

function filters(){
  return {
    plan: document.getElementById("fPlan")?.value||"",
    section: document.getElementById("fSec")?.value||"",
    f1: document.getElementById("f1")?.value||"",
    f2: document.getElementById("f2")?.value||""
  };
}
function applyFilters(rows,f){
  return rows.filter(r => (!f.plan||r.plan===f.plan)&&(!f.section||r.section===f.section)&&(!f.f1||r.f1===f.f1)&&(!f.f2||r.f2===f.f2));
}
async function hasTicket(testId){
  if(!CUR_USER) return false;
  const s = await getDoc(doc(db, "users", CUR_USER.uid, "tickets", testId));
  return s.exists();
}
async function render(){
  const list = applyFilters(MAN, filters());
  grid.classList.add("grid","cards");
  if(list.length===0){ grid.innerHTML = `<div class="card"><b>Hech narsa topilmadi.</b></div>`; return; }
  // async render: check tickets
  const rows = await Promise.all(list.map(async r=> ({ r, paid: await hasTicket(r.id) })));
  grid.innerHTML = rows.map(({r,paid})=> cardHTML(r, paid)).join("");
  wrap.classList.add("hidden");
}
function cardHTML(r, paid){
  const price = Number(r.price||0);
  const btn = paid || price===0 ? `<button class="btn primary" data-cmd="start" data-id="${esc(r.id)}">Boshlash</button>`
                                 : `<button class="btn primary" data-cmd="buy" data-id="${esc(r.id)}">Sotib olish</button>`;
  return `<article class="card">
    ${r.image? `<img src="${esc(r.image)}" alt="" style="width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:14px;border:1px solid rgba(255,255,255,.08);margin-bottom:8px">` : ""}
    <h3 style="margin:6px 0 4px">${esc(r.title||"")}</h3>
    <p class="sub">${esc(r.desc||"")}</p>
    <div class="toolbar">
      ${btn}
      ${price>0? `<span class="pill">💵 ${price.toLocaleString("ru-RU")} so‘m</span>`:`<span class="pill">🆓 Bepul</span>`}
      ${r.duration_min? `<span class="pill">⏱ ${esc(r.duration_min)} daqiqa</span>`: ""}
      ${r.plan? `<span class="pill">${esc(r.plan)}</span>`: ""}
      ${r.section? `<span class="pill">${esc(r.section)}</span>`: ""}
    </div>
  </article>`;
}
function onGridClick(e){
  const buy = e.target.closest('[data-cmd="buy"]');
  const start = e.target.closest('[data-cmd="start"]');
  if(buy){ buyTest(buy.dataset.id); }
  if(start){ startTestFlow(start.dataset.id); }
}

async function buyTest(id){
  if(!CUR_USER){ alert("Avval kirish qiling."); return; }
  const pack = BYID[id]; if(!pack){ alert("Topilmadi"); return; }
  const price = Number(pack.price||0);
  await refreshBalance();
  if(price<=0){ alert("Bu test bepul."); render(); return; }
  if(CUR_BAL < price){ alert("Balans yetarli emas."); return; }
  if(!confirm(`Balansdan ${price.toLocaleString("ru-RU")} so‘m yechiladi. Tasdiqlaysizmi?`)) return;

  const userRef = doc(db, "users", CUR_USER.uid);
  const ticketRef = doc(db, "users", CUR_USER.uid, "tickets", id);

  try{
    await runTransaction(db, async (tx)=>{
      const uSnap = await tx.get(userRef);
      if(!uSnap.exists()) throw new Error("USER_NOT_FOUND");
      const bal = Number(uSnap.data().balance||0);
      const tSnap = await tx.get(ticketRef);
      if(tSnap.exists()) return; // already purchased
      if(bal < price) throw new Error("INSUFFICIENT_FUNDS");
      tx.update(userRef, {
        balance: bal - price,
        lastPurchase: { testId: id, price, at: serverTimestamp() }
      });
      tx.set(ticketRef, { testId: id, price, at: serverTimestamp() });
    });
    await refreshBalance();
    alert("Xarid muvaffaqiyatli. Endi testni boshlashingiz mumkin.");
    render();
  }catch(e){
    console.error(e);
    alert("Xaridni yakunlab bo‘lmadi: "+e.message);
  }
}

// ==== TEST ENGINE ====
async function fetchPack(url){ return await fetchCSV(url); }

async function startTestFlow(id){
  const pack = BYID[id]; if(!pack){ alert("Test topilmadi"); return; }
  const price = Number(pack.price||0);
  if(price>0 && !(await hasTicket(id))){ alert("Avval sotib oling."); return; }
  // load questions
  const rows = await fetchPack(pack.file);
  const meta = rows.find(r => (r.type||'').toLowerCase()==='meta') || {};
  const neg = {easy:Number(meta.neg_easy||'0.25'), medium:Number(meta.neg_med||'0.5'), hard:Number(meta.neg_hard||'1')};
  const marks = {easy:Number(meta.m_easy||'1'),   medium:Number(meta.m_med||'2'),   hard:Number(meta.m_hard||'3')};
  let duration = Number(meta.duration_min || pack.duration_min || 10);
  let qs = rows.filter(r=>(r.type||'').toLowerCase()==='q').map((r,i)=>({
    id: r.qid || String(i+1), text:r.text, A:r.A,B:r.B,C:r.C,D:r.D,
    correct:(r.correct||'').split('|').map(x=>x.trim()).filter(Boolean),
    multi:(r.correct||'').includes('|'), difficulty:(r.difficulty||'easy').toLowerCase(), topic:r.topic||'', explain:r.explain||''
  }));
  if((meta.shuffle||'yes').toLowerCase()!=='no'){ qs = qs.map(q=>({...q,_r:Math.random()})).sort((a,b)=>a._r-b._r).map(({_r,...q})=>q); }
  runTest({ id, title: pack.title, duration, neg, marks, qs });
}

function runTest(cfg){
  const {id,title,duration,neg,marks,qs}=cfg;
  const st={i:0,answers:{},marked:new Set(),leftSec:duration*60};
  if(st._t) clearInterval(st._t);
  st._t = setInterval(()=>{ st.leftSec--; if(st.leftSec<=0){ clearInterval(st._t); submit(); } updateTop(); },1000);

  wrap.classList.remove("hidden");
  wrap.innerHTML = `
  <div class="test-topbar">
    <div><b>${esc(title)}</b> <span class="badge">Savollar: ${qs.length}</span></div>
    <div><span class="badge" id="tmr">⏱ 00:00</span>
      <button class="btn ghost" id="m">⭐ Belgilash</button>
      <button class="btn" id="p">←</button>
      <button class="btn" id="n">→</button>
      <button class="btn primary" id="s">Yakunlash</button>
      <button class="btn ghost" id="b">← Ro‘yxat</button>
    </div>
  </div>
  <div class="qwrap" id="qw"></div>
  <div class="progress" id="pr"></div>`;

  const el={tmr:wrap.querySelector("#tmr"), m:wrap.querySelector("#m"), p:wrap.querySelector("#p"),
            n:wrap.querySelector("#n"), s:wrap.querySelector("#s"), b:wrap.querySelector("#b"),
            qw:wrap.querySelector("#qw"), pr:wrap.querySelector("#pr")};

  el.p.onclick=()=>{ if(st.i>0){ st.i--; renderQ(); } };
  el.n.onclick=()=>{ if(st.i<qs.length-1){ st.i++; renderQ(); } };
  el.b.onclick=()=>{ clearInterval(st._t); render(); window.scrollTo(0,0); };
  el.s.onclick=()=>{ if(confirm("Yakunlaysizmi?")){ clearInterval(st._t); submit(); } };
  el.m.onclick=()=>{ const q=qs[st.i]; st.marked.has(q.id)? st.marked.delete(q.id): st.marked.add(q.id); renderProg(); };

  function updateTop(){ const m=Math.floor(st.leftSec/60), s=st.leftSec%60; el.tmr.textContent=`⏱ ${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`; }

  function renderQ(){
    const q=qs[st.i], sel=st.answers[q.id]||[];
    const letters=['A','B','C','D'].filter(k=>q[k]!=null&&q[k]!=='');
    el.qw.innerHTML = `<div class="qitem"><div class="qtitle">${st.i+1}. ${esc(q.text)}</div>
      <div>${q.topic?`<span class="pill">#${esc(q.topic)}</span>`:''} <span class="pill">${q.difficulty}</span> ${q.multi?'<span class="pill">⬜ Multiple</span>':''}</div>
    </div>
    ${letters.map(L=>`<label class="opt"><input type="${q.multi?'checkbox':'radio'}" name="q${esc(q.id)}" value="${L}" ${sel.includes(L)?'checked':''}><div><b>${L})</b> ${esc(q[L])}</div></label>`).join('')}`;
    el.qw.querySelectorAll('input').forEach(inp=>{
      inp.onchange=()=>{
        if(q.multi){ const a=new Set(st.answers[q.id]||[]); inp.checked?a.add(inp.value):a.delete(inp.value); st.answers[q.id]=Array.from(a); }
        else{ st.answers[q.id]=[inp.value]; }
        renderProg();
      };
    });
    renderProg();
  }
  function renderProg(){
    el.pr.innerHTML = qs.map((q,idx)=>{
      const ans=st.answers[q.id]; const answered=Array.isArray(ans)&&ans.length>0;
      const cls=['dot', idx===st.i?'sel':'', answered?'answered':'', st.marked.has(q.id)?'marked':''].filter(Boolean).join(' ');
      return `<div class="${cls}" data-jump="${idx}">${idx+1}</div>`;
    }).join('');
    el.pr.querySelectorAll('[data-jump]').forEach(d=> d.onclick=()=>{ st.i=Number(d.dataset.jump); renderQ(); });
  }
  function score(){
    let total=0,max=0,right=0,wrong=0,blank=0; const byTopic={}, byDiff={easy:{r:0,w:0,b:0}, medium:{r:0,w:0,b:0}, hard:{r:0,w:0,b:0}};
    const rows = qs.map((q,idx)=>{
      const sel=(st.answers[q.id]||[]).slice().sort().join('|')||''; const cor=q.correct.slice().sort().join('|'); const blanked=sel==='';
      const ok=!blanked && sel===cor; const diff=(q.difficulty in marks)?q.difficulty:'easy';
      const mark=marks[diff], negv=neg[diff]; max+=mark; let d=0;
      if(ok){ right++; d=mark; byDiff[diff].r++; } else if(blanked){ blank++; byDiff[diff].b++; } else { wrong++; d=-negv; byDiff[diff].w++; }
      total+=d; if(q.topic){ byTopic[q.topic]=byTopic[q.topic]||{r:0,w:0,b:0}; ok?byTopic[q.topic].r++: blanked?byTopic[q.topic].b++:byTopic[q.topic].w++; }
      return {q,sel,cor,ok,blanked,delta:d};
    });
    return {total,max,right,wrong,blank,rows,byTopic,byDiff};
  }
  function submit(){
    const r=score();
    wrap.innerHTML = `<div class="test-topbar"><div><b>${esc(title)}</b> <span class="badge">Natija</span></div>
      <div><button class="btn" id="again">Qayta</button><button class="btn ghost" id="back">← Ro‘yxat</button></div></div>
      <div class="result-grid">
        <div class="stat"><h4>Umumiy</h4><div>Ball: <b>${r.total.toFixed(2)}</b> / ${r.max}</div>
          <div>✔️ ${r.right} • ❌ ${r.wrong} • ⏳ ${r.blank}</div></div>
        <div class="stat"><h4>Qiyinlik</h4><table><tbody>${
          Object.entries(r.byDiff).map(([k,v])=>`<tr><td>${k}</td><td>✔️ ${v.r}</td><td>❌ ${v.w}</td><td>⏳ ${v.b}</td></tr>`).join('')
        }</tbody></table></div>
        <div class="stat"><h4>Bo‘limlar</h4><table><tbody>${
          Object.entries(r.byTopic).map(([k,v])=>`<tr><td>${esc(k)}</td><td>✔️ ${v.r}</td><td>❌ ${v.w}</td><td>⏳ ${v.b}</td></tr>`).join('')||'<tr><td>—</td></tr>'
        }</tbody></table></div>
      </div>
      <div class="card" style="margin-top:12px"><h3>Analiz</h3>${
        r.rows.map((x,i)=>`<div class="qitem"><div class="qtitle">${i+1}. ${esc(x.q.text)} ${x.ok?'✅':'❌'}</div>
        <div>Tanlov: <span class="kbd">${x.sel||'—'}</span> • To‘g‘ri: <span class="kbd">${x.cor}</span> • Ball: ${x.delta>=0?'+':''}${x.delta.toFixed(2)}</div>
        ${x.q.explain? `<div class="sub" style="margin-top:6px">${esc(x.q.explain)}</div>`:''}</div>`).join('')
      }</div>`;
    wrap.querySelector("#back").onclick=()=>{ render(); window.scrollTo(0,0); };
    wrap.querySelector("#again").onclick=()=>{ runTest(cfg); window.scrollTo(0,0); };
  }

  renderQ(); updateTop();
}
