
// Online musobaqalar — CSV grid + real-time button states per time window.
// CSV columns (with header row):
// Img url, Title, Sana, Boshlash vaqti, Tugash vaqti, Bosh sovrin, Tugma linki, Natija linki, Test narxi

const grid = document.querySelector('#liveGrid');
const source = grid?.dataset?.csv || './live.csv';

// Single interval to update all countdowns
let TICK = null;
const cards = new Map(); // id -> {el, start, end, startHref, resultHref}

(async function init(){
  const text = await fetchCSV(source);
  if(!text){ grid.innerHTML = `<div class="card">live.csv topilmadi.</div>`; return; }
  const rows = parseCSV(text);
  const data = normalize(rows);
  if(!data.length){ grid.innerHTML = `<div class="card">CSV bo‘sh.</div>`; return; }
  render(data);
  startTick();
})();

function render(items){
  grid.innerHTML = '';
  items.forEach((it, idx)=>{
    const id = `match_${idx}`;
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = cardHTML(id, it);
    grid.appendChild(card);

    const state = {
      el: card,
      start: it.start,
      end: it.end,
      startHref: it.startHref,
      resultHref: it.resultHref
    };
    cards.set(id, state);

    // Attach actions
    const startBtn = card.querySelector(`[data-act="start"][data-id="${id}"]`);
    const resBtn = card.querySelector(`[data-act="result"][data-id="${id}"]`);
    startBtn?.addEventListener('click', (e)=>{
      e.preventDefault();
      if(!state.startHref){
        alert('Boshlash linki biriktirilmagan.');
        return;
      }
      window.location.href = state.startHref;
    });
    resBtn?.addEventListener('click', (e)=>{
      e.preventDefault();
      if(state.resultHref){
        window.location.href = state.resultHref;
      }else{
        alert('Natijalar hali chiqmadi, iltimos kuting.');
      }
    });
  });
  // initial paint
  tickAll();
}

function cardHTML(id, it){
  const price = it.price ? `<span class="pill">💵 ${esc(it.price)}</span>` : '';
  const prize = it.prize ? `<span class="pill">🏆 ${esc(it.prize)}</span>` : '';
  const metaTop = [esc(it.dateStr), `${esc(it.startStr)} → ${esc(it.endStr)}`].filter(Boolean).join(' • ');

  // Action area renders by time; we print a placeholder container updated in tick()
  return `
    ${it.img ? `<img src="${esc(it.img)}" alt="${esc(it.title)}" loading="lazy" style="width:100%;border-radius:14px;border:1px solid rgba(255,255,255,.08);margin-bottom:8px;aspect-ratio:16/9;object-fit:cover">` : ''}
    <h3 style="margin:.3rem 0">${esc(it.title)}</h3>
    <div class="sub">${metaTop}</div>
    <div style="margin:6px 0">${prize} ${price}</div>
    <div id="act_${id}" class="actrow" style="margin-top:8px"></div>
  `;
}

function startTick(){
  clearInterval(TICK);
  TICK = setInterval(tickAll, 1000);
}
function tickAll(){
  const now = new Date();
  for(const [id, st] of cards){
    const holder = st.el.querySelector(`#act_${id}`);
    if(!holder) continue;
    if(now < st.start){
      const left = fmtDHMS(st.start - now);
      holder.innerHTML = `<div class="pill">⏳ Startgacha: ${left}</div>`;
    }else if(now >= st.start && now < st.end){
      holder.innerHTML = `<a href="${st.startHref||'#'}" data-id="${id}" data-act="start" class="btn primary">Boshlash</a>`;
    }else{
      holder.innerHTML = `<a href="${st.resultHref||'#'}" data-id="${id}" data-act="result" class="btn">Natijani bilish</a>`;
    }
  }
}

/* Helpers */
function fmtDHMS(ms){
  if(ms<0) ms=0;
  let s = Math.floor(ms/1000);
  const d = Math.floor(s/86400); s%=86400;
  const h = Math.floor(s/3600); s%=3600;
  const m = Math.floor(s/60); s%=60;
  const parts = [];
  if(d>0) parts.push(String(d).padStart(2,'0'));
  parts.push(String(h).padStart(2,'0'));
  parts.push(String(m).padStart(2,'0'));
  parts.push(String(s).padStart(2,'0'));
  return parts.join(':');
}

async function fetchCSV(path){
  const tries=[path,'./live.csv','/live.csv'];
  for(const p of tries){
    try{ const r = await fetch(p,{cache:'no-cache'}); if(r.ok) return await r.text(); }catch(_){}
  }
  return null;
}

function detectDelim(line){
  const cand=['|',',',';','\t']; const counts=cand.map(d=>(line.split(d).length-1));
  const max=Math.max(...counts); return max>0? cand[counts.indexOf(max)] : ',';
}

function parseCSV(text){
  const lines=text.replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n');
  let first=''; for(const ln of lines){ const t=ln.trim(); if(t){ first=ln; break; } }
  const delim=detectDelim(first || "Img url,Title,Sana,Boshlash vaqti,Tugash vaqti,Bosh sovrin,Tugma linki,Natija linki,Test narxi");
  const rows=[]; let row=[], field='', q=false;
  function push(){ let v=field; if(v.startsWith('"')&&v.endsWith('"')) v=v.slice(1,-1).replace(/""/g,'"'); row.push(v.trim()); field=''; }
  for(let i=0;i<text.length;i++){
    const ch=text[i], nx=text[i+1];
    if(ch=='"'){ if(q&&nx=='"'){ field+='"'; i++; } else { q=!q; } continue; }
    if(ch=='\n'&&!q){ push(); if(row.some(x=>x!=='') && !String(row[0]||'').trim().startsWith('#')) rows.push(row); row=[]; continue; }
    if(ch==delim&&!q){ push(); continue; }
    field+=ch;
  }
  push(); if(row.some(x=>x!=='') && !String(row[0]||'').trim().startsWith('#')) rows.push(row);
  return rows;
}

function normalize(rows){
  if(!rows.length) return [];
  const hdr = rows[0].map(s=>s.toLowerCase());
  const hasHdr = hdr[0]?.includes('img') && hdr[1]?.includes('title');
  const start = hasHdr ? 1 : 0;
  const out=[];
  for(let i=start;i<rows.length;i++){
    const r = rows[i];
    if(r.length<9) continue;
    const [img,title,dateStr,startStr,endStr,prize,startHref,resultHref,price] = r;
    const startDt = parseLocalDateTime(dateStr, startStr);
    const endDt   = parseLocalDateTime(dateStr, endStr);
    out.push({
      img: img||'', title: title||'—',
      dateStr: dateStr||'', startStr: startStr||'', endStr: endStr||'',
      prize: prize||'', startHref: startHref||'', resultHref: resultHref||'',
      price: price||'', start: startDt, end: endDt
    });
  }
  return out;
}

// Parse "Sana" + time in local TZ (supports YYYY-MM-DD or DD.MM.YYYY; time HH:MM[:SS])
function parseLocalDateTime(dateStr, timeStr){
  const d = (dateStr||'').trim();
  const t = (timeStr||'00:00').trim();
  let y,m,day;
  if(/^\d{4}-\d{2}-\d{2}$/.test(d)){
    const [Y,M,D]=d.split('-').map(Number); y=Y; m=M-1; day=D;
  }else if(/^\d{2}\.\d{2}\.\d{4}$/.test(d)){
    const [D,M,Y]=d.split('.').map(Number); y=Y; m=M-1; day=D;
  }else{
    // fallback: today
    const now = new Date(); y=now.getFullYear(); m=now.getMonth(); day=now.getDate();
  }
  let hh=0, mm=0, ss=0;
  const mt = t.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if(mt){ hh=Number(mt[1]); mm=Number(mt[2]); ss=Number(mt[3]||0); }
  return new Date(y, m, day, hh, mm, ss);
}

function esc(s){ return String(s||'').replace(/[&<>\"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c])); }
