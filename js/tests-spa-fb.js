/* tests-spa-fb.js — SPA-friendly + Firebase balance */
function esc(s){ return (s==null?'':String(s)).replace(/[&<>"']/g, m=>({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m])); }
function parseCSV(text){
  const rows=[]; let i=0, cur=[], f='', q=false;
  const pushF=()=>{cur.push(f); f=''}; const pushR=()=>{rows.push(cur); cur=[]};
  while(i<text.length){const c=text[i];
    if(q){ if(c=='"'){ if(text[i+1]=='"'){f+='"'; i+=2; continue;} q=false; i++; continue;} f+=c; i++; continue; }
    if(c=='"'){q=true; i++; continue;} if(c==','){pushF(); i++; continue;} if(c=='\r'){i++; continue;}
    if(c=='\n'){pushF(); pushR(); i++; continue;} f+=c; i++;
  } pushF(); if(cur.length>1||(cur.length===1&&cur[0]!=='')) pushR();
  if(!rows.length) return []; const h=rows[0].map(x=>x.trim());
  return rows.slice(1).filter(r=>r.some(v=>String(v).trim()!=='')).map(r=>{const o={}; h.forEach((k,j)=>o[k]=(r[j]??'').trim()); return o;});
}
async function fetchCSV(url){ const r=await fetch(url,{cache:"no-store"}); if(!r.ok) throw new Error(`CSV yuklanmadi: ${url} (${r.status})`); return parseCSV(await r.text()); }
function uniq(rows,key){ return Array.from(new Set(rows.map(r=>r[key]).filter(Boolean))).sort(); }

import {
  auth, db, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut,
  doc, getDoc, setDoc, runTransaction, serverTimestamp
} from "./firebase-init.js";

const App=(function(){
  let mounted=false, GRID, WRAP, baseCSVUrl=null;
  let MAN=[], BYID={};
  let CUR_USER=null, CUR_BAL=0;

  const balPill = ()=> document.getElementById("balancePill");
  const btnLogin = ()=> document.getElementById("btnLogin");
  const btnLogout = ()=> document.getElementById("btnLogout");
  const userName = ()=> document.getElementById("userName");

  function resolveURL(u){ try{ return new URL(u, baseCSVUrl||location.href).toString(); }catch(e){ return u; } }

  async function mount(){
    const root=document.getElementById("testsSections");
    if(!root){ mounted=false; return; }
    if(mounted) return; mounted=true;
    GRID=root; WRAP=document.getElementById("testWrap");

    btnLogin()?.addEventListener("click", async ()=>{ const p=new GoogleAuthProvider(); await signInWithPopup(auth,p); });
    btnLogout()?.addEventListener("click", async ()=>{ await signOut(auth); });

    onAuthStateChanged(auth, async (u)=>{
      CUR_USER=u;
      if(userName()) userName().textContent = u ? `👤 ${u.displayName||u.email}` : "👤 Mehmon";
      if(btnLogin()) btnLogin().classList.toggle("hidden", !!u);
      if(btnLogout()) btnLogout().classList.toggle("hidden", !u);
      await ensureUserDoc(u);
      await refreshBalance();
      render();
    });

    const csvUrl = GRID.dataset.csv || "/csv/tests.csv";
    baseCSVUrl = new URL(csvUrl, location.href);
    MAN = await fetchCSV(csvUrl);
    BYID={}; MAN.forEach(r=>BYID[r.id]=r);

    const map={fPlan:"plan", fSec:"section", f1:"f1", f2:"f2"};
    Object.entries(map).forEach(([selId,key])=>{
      const sel=document.getElementById(selId); if(!sel) return;
      sel.innerHTML = `<option value="">Hammasi</option>` + uniq(MAN,key).map(v=>`<option>${esc(v)}</option>`).join("");
      sel.onchange = render;
    });

    GRID.addEventListener("click", onGridClick);
    render();
  }

  async function ensureUserDoc(u){
    if(!u) return;
    const uref = doc(db, "users", u.uid);
    const snap = await getDoc(uref);
    if(!snap.exists()){
      await setDoc(uref, {
        name: u.displayName||null, email: u.email||null,
        balance: 50000, gems: 0, createdAt: serverTimestamp()
      }, { merge: true });
    }
  }
  async function refreshBalance(){
    if(!CUR_USER){ if(balPill()) balPill().textContent="💵 —"; return; }
    const s = await getDoc(doc(db, "users", CUR_USER.uid));
    CUR_BAL = s.exists()? Number(s.data().balance||0) : 0;
    if(balPill()) balPill().textContent = `💵 ${CUR_BAL.toLocaleString("ru-RU")} so‘m`;
  }

  function filters(){ return {
    plan: document.getElementById("fPlan")?.value||"",
    section: document.getElementById("fSec")?.value||"",
    f1: document.getElementById("f1")?.value||"",
    f2: document.getElementById("f2")?.value||""
  };}
  function applyFilters(rows,f){ return rows.filter(r => (!f.plan||r.plan===f.plan)&&(!f.section||r.section===f.section)&&(!f.f1||r.f1===f.f1)&&(!f.f2||r.f2===f.f2)); }

  async function hasTicket(id){
    if(!CUR_USER) return false;
    const s = await getDoc(doc(db,"users",CUR_USER.uid,"tickets",id));
    return s.exists();
  }

  async function render(){
    const list = applyFilters(MAN, filters());
    GRID.classList.add("grid","cards");
    if(!list.length){ GRID.innerHTML=`<div class="card"><b>Hech narsa topilmadi.</b></div>`; return; }
    const arr = await Promise.all(list.map(async r=>({r, paid: await hasTicket(r.id)})));
    GRID.innerHTML = arr.map(({r,paid})=>cardHTML(r, paid)).join("");
    WRAP?.classList.add("hidden");
  }
  function cardHTML(r,paid){
    const price=Number(r.price||0);
    const btn = (paid || price===0)
      ? `<button class="btn primary" data-cmd="start" data-test-id="${esc(r.id)}">Boshlash</button>`
      : `<button class="btn primary" data-cmd="buy" data-test-id="${esc(r.id)}">Sotib olish</button>`;
    return `<article class="card">
      ${r.image? `<img src="${esc(r.image)}" alt="" style="width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:14px;border:1px solid rgba(255,255,255,.08);margin-bottom:8px">` : ""}
      <h3 style="margin:6px 0 4px">${esc(r.title||'')}</h3>
      <p class="sub">${esc(r.desc||'')}</p>
      <div class="toolbar">
        ${btn}
        ${price>0? `<span class="pill">💵 ${price.toLocaleString("ru-RU")} so‘m</span>`:`<span class="pill">🆓 Bepul</span>`}
        ${r.duration_min? `<span class="pill">⏱ ${esc(r.duration_min)} daqiqa</span>`:""}
        ${r.plan? `<span class="pill">${esc(r.plan)}</span>`:""}
        ${r.section? `<span class="pill">${esc(r.section)}</span>`:""}
      </div>
    </article>`;
  }

  function onGridClick(e){
    const buy=e.target.closest('[data-cmd="buy"]');
    const start=e.target.closest('[data-cmd="start"]');
    if(buy) buyTest(buy.dataset.testId);
    if(start) startTestFlow(start.dataset.testId).catch(err=>{alert("Boshlashda xato: "+err.message); console.error(err);});
  }

  async function buyTest(id){
    if(!CUR_USER){ alert("Avval kirish qiling."); return; }
    const pack = BYID[id]; if(!pack){ alert("Topilmadi"); return; }
    const price = Number(pack.price||0);
    await refreshBalance();
    if(price<=0){ render(); return; }
    if(CUR_BAL < price){ alert("Balans yetarli emas."); return; }
    if(!confirm(`Balansdan ${price.toLocaleString("ru-RU")} so‘m yechiladi. Tasdiqlaysizmi?`)) return;

    const userRef = doc(db,"users",CUR_USER.uid);
    const ticketRef = doc(db,"users",CUR_USER.uid,"tickets",id);

    try{
      await runTransaction(db, async (tx)=>{
        const u = await tx.get(userRef);
        if(!u.exists()) throw new Error("USER_NOT_FOUND");
        const bal = Number(u.data().balance||0);
        const t = await tx.get(ticketRef);
        if(t.exists()) return; // already bought
        if(bal < price) throw new Error("INSUFFICIENT_FUNDS");
        tx.update(userRef, { balance: bal - price, lastPurchase: { testId:id, price, at: serverTimestamp() }});
        tx.set(ticketRef, { testId:id, price, at: serverTimestamp() });
      });
      await refreshBalance();
      alert("Xarid muvaffaqiyatli. Endi Boshlash mumkin.");
      render();
    }catch(e){ alert("Xaridda xato: "+e.message); console.error(e); }
  }

  async function startTestFlow(id){
    const pack = BYID[id]; if(!pack) throw new Error("Test topilmadi (manifest).");
    const price = Number(pack.price||0);
    if(price>0 && !(await hasTicket(id))) throw new Error("Avval sotib oling.");
    const rows = await fetchCSV(resolveURL(pack.file)).catch(e=>{ throw new Error(`Pack topilmadi: ${pack.file}`) });

    const meta = rows.find(r=>(r.type||'').toLowerCase()==='meta')||{};
    const neg={easy:+(meta.neg_easy||0.25), medium:+(meta.neg_med||0.5), hard:+(meta.neg_hard||1)};
    const marks={easy:+(meta.m_easy||1), medium:+(meta.m_med||2), hard:+(meta.m_hard||3)};
    const duration= +(meta.duration_min||pack.duration_min||10);
    let qs = rows.filter(r=>(r.type||'').toLowerCase()==='q').map((r,i)=>({
      id:r.qid||String(i+1), text:r.text, A:r.A,B:r.B,C:r.C,D:r.D,
      correct:(r.correct||'').split('|').map(s=>s.trim()).filter(Boolean),
      multi:(r.correct||'').includes('|'),
      difficulty:(r.difficulty||'easy').toLowerCase(), topic:r.topic||'', explain:r.explain||''
    }));
    if((meta.shuffle||'yes').toLowerCase()!=='no'){ qs = qs.map(q=>({...q,_r:Math.random()})).sort((a,b)=>a._r-b._r).map(({_r,...q})=>q); }
    runTest({ title: pack.title||id, duration, neg, marks, qs });
  }

  function runTest(cfg){
    const {title,duration,neg,marks,qs}=cfg;
    const st={i:0,ans:{},left:duration*60,mark:new Set()};
    WRAP.classList.remove("hidden");
    WRAP.innerHTML = `
      <div class="test-topbar">
        <div><b>${esc(title)}</b> <span class="badge">Savollar: ${qs.length}</span></div>
        <div><span class="badge" id="t">⏱ 00:00</span>
          <button class="btn" id="p">←</button>
          <button class="btn" id="n">→</button>
          <button class="btn primary" id="s">Yakunlash</button>
          <button class="btn ghost" id="b">← Ro‘yxat</button>
        </div>
      </div>
      <div class="qwrap" id="qw"></div>
      <div class="progress" id="pr"></div>`;

    const el={t:WRAP.querySelector("#t"), p:WRAP.querySelector("#p"), n:WRAP.querySelector("#n"), s:WRAP.querySelector("#s"), b:WRAP.querySelector("#b"), qw:WRAP.querySelector("#qw"), pr:WRAP.querySelector("#pr")};
    let timer=setInterval(()=>{ st.left--; if(st.left<=0){ clearInterval(timer); submit(); } tick(); },1000);
    el.p.onclick=()=>{ if(st.i>0){ st.i--; renderQ(); } };
    el.n.onclick=()=>{ if(st.i<qs.length-1){ st.i++; renderQ(); } };
    el.b.onclick=()=>{ clearInterval(timer); render(); window.scrollTo(0,0); };
    el.s.onclick=()=>{ if(confirm("Yakunlaysizmi?")){ clearInterval(timer); submit(); } };

    function tick(){ const m=Math.floor(st.left/60), s=st.left%60; el.t.textContent=`⏱ ${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`; }

    function renderQ(){
      const q=qs[st.i], sel=st.ans[q.id]||[]; const L=['A','B','C','D'].filter(k=>q[k]);
      el.qw.innerHTML = `<div class="qitem"><div class="qtitle">${st.i+1}. ${esc(q.text)}</div>
        <div>${q.topic?`<span class="pill">#${esc(q.topic)}</span>`:''} <span class="pill">${q.difficulty}</span> ${q.multi?'<span class="pill">⬜ Multiple</span>':''}</div>
      </div>` + L.map(v=>`<label class="opt"><input type="${q.multi?'checkbox':'radio'}" name="q${esc(q.id)}" value="${v}" ${sel.includes(v)?'checked':''}><div><b>${v})</b> ${esc(q[v])}</div></label>`).join('');
      el.qw.querySelectorAll('input').forEach(inp=>{
        inp.onchange=()=>{
          if(q.multi){ const a=new Set(st.ans[q.id]||[]); inp.checked?a.add(inp.value):a.delete(inp.value); st.ans[q.id]=Array.from(a); }
          else{ st.ans[q.id]=[inp.value]; }
          renderProg();
        };
      });
      renderProg();
    }
    function renderProg(){
      el.pr.innerHTML = qs.map((q,idx)=>{
        const a=st.ans[q.id]; const answered=Array.isArray(a)&&a.length>0;
        const cls=['dot', idx===st.i?'sel':'', answered?'answered':''].filter(Boolean).join(' ');
        return `<div class="${cls}" data-jump="${idx}">${idx+1}</div>`;
      }).join('');
      el.pr.querySelectorAll('[data-jump]').forEach(d=> d.onclick=()=>{ st.i=+d.dataset.jump; renderQ(); });
    }
    function submit(){
      const rows = qs.map(q=>{
        const sel=(st.ans[q.id]||[]).slice().sort().join('|')||'';
        const cor=q.correct.slice().sort().join('|');
        const ok = sel!=='' && sel===cor;
        const diff=q.difficulty in marks?q.difficulty:'easy';
        const sc = ok?marks[diff] : (sel==='' ? 0 : -neg[diff]);
        return {q,sel,cor,ok,sc};
      });
      const total = rows.reduce((s,x)=>s+x.sc,0);
      const max = qs.reduce((s,q)=> s + (marks[q.difficulty in marks?q.difficulty:'easy']||1), 0);
      WRAP.innerHTML = `
        <div class="test-topbar">
          <div><b>${esc(title)}</b> <span class="badge">Natija</span></div>
          <div><button class="btn" id="again">Qayta</button><button class="btn ghost" id="back">← Ro‘yxat</button></div>
        </div>
        <div class="result-grid">
          <div class="stat"><h4>Umumiy</h4><div>Ball: <b>${total.toFixed(2)}</b> / ${max}</div></div>
        </div>
        <div class="card" style="margin-top:12px"><h3>Analiz</h3>${
          rows.map((x,i)=>`<div class="qitem"><div class="qtitle">${i+1}. ${esc(x.q.text)} ${x.ok?'✅':'❌'}</div>
          <div>Tanlov: <span class="kbd">${x.sel||'—'}</span> • To‘g‘ri: <span class="kbd">${x.cor}</span> • Ball: ${x.sc>=0?'+':''}${x.sc.toFixed(2)}</div>
          ${x.q.explain? `<div class="sub" style="margin-top:6px">${esc(x.q.explain)}</div>`:''}
          </div>`).join('')
        }</div>`;
      WRAP.querySelector("#back").onclick=()=>{ render(); window.scrollTo(0,0); };
      WRAP.querySelector("#again").onclick=()=>{ runTest(cfg); window.scrollTo(0,0); };
    }
    renderQ(); tick();
  }

  function tryMount(){ setTimeout(mount, 0); }
  window.addEventListener("hashchange", tryMount);
  document.addEventListener("DOMContentLoaded", tryMount);
  tryMount();

  return { mount };
})();
