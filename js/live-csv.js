// Live — CSV → grid (responsive cards + timer)
const host = document.querySelector('#liveGrid');
const path = host?.dataset?.csv || './csv/live.csv';
let timers = [];

(async function init(){
  const text = await fetchCSV(path);
  if(!text){ host.innerHTML = '<div class="card">live.csv topilmadi.</div>'; return; }
  const rows = parseCSV(text);
  const data = normalize(rows);
  host.innerHTML = '';
  data.forEach(r => host.appendChild(card(r)));
  startTick();
})();

function card(r){
  const el = document.createElement('div'); el.className = 'card live-card';

  const dateStr = fmtDate(r.date);
  const timesStr = `${r.startTime} — ${r.endTime}`;

  const tags = `
    ${r.prize ? `<span class="tag prize">🏆 ${esc(r.prize)}</span>` : ''}
    ${r.price ? `<span class="tag price">💳 ${esc(r.price)}</span>` : ''}
  `;

  // CTA blok: holatga qarab o‘zgaradi
  const cta = document.createElement('div'); cta.className = 'lc-cta';
  const btn = document.createElement(r.link ? 'a' : 'button');
  btn.className = 'btn primary';
  if (r.link) btn.href = r.link;

  // Timer element
  const pill = document.createElement('span');
  pill.className = 'pill timer';
  pill.innerHTML = '⏳ Yopilmoqda...'; // init text

  // holatni hisoblaymiz (millis)
  const tStart = toTs(r.date, r.startTime);
  const tEnd   = toTs(r.date, r.endTime);
  updateCTA();

  cta.appendChild(btn);
  cta.appendChild(pill);

  el.innerHTML = `
    ${r.img ? `<img src="${r.img}" alt="${esc(r.title)}" loading="lazy">` : ''}
    <div class="lc-body">
      <h3 class="lc-title">${esc(r.title)}</h3>
      <div class="lc-meta">
        <span class="kv">📅 ${dateStr}</span>
        <span class="kv">🕒 ${timesStr}</span>
      </div>
      <div class="lc-tags">${tags}</div>
    </div>
  `;
  el.querySelector('.lc-body').appendChild(cta);

  // timer ro'yxatiga qo'shamiz
  timers.push(()=> tick(pill, btn, r, tStart, tEnd));
  return el;

  function updateCTA(){
    const now = Date.now();
    if (now < tStart){
      btn.textContent = 'Boshlanmadi';
      btn.disabled = true;
      if (btn.tagName === 'A') btn.removeAttribute('href');
    } else if (now >= tStart && now <= tEnd){
      btn.textContent = 'Boshlash';
      btn.disabled = !r.link;
      if (!r.link) btn.classList.remove('primary');
      if (btn.tagName === 'A' && r.link) btn.href = r.link;
    } else {
      // tugagan
      if (r.result && r.result.trim()){
        if (btn.tagName !== 'A'){ const a = document.createElement('a'); a.className = btn.className; a.textContent = 'Natijani bilish'; a.href = r.result; btn.replaceWith(a); btn = a; }
        else { btn.textContent = 'Natijani bilish'; btn.href = r.result; }
        btn.disabled = false;
      } else {
        btn.textContent = 'Natijalar hali chiqmadi';
        btn.disabled = true; if (btn.tagName === 'A') btn.removeAttribute('href');
      }
    }
  }
}

function tick(pill, btn, r, tStart, tEnd){
  const now = Date.now();
  if (now < tStart){
    pill.textContent = `⏳ Startgacha: ${fmtDur(tStart - now)}`;
    btn.disabled = true;
    btn.textContent = 'Boshlanmadi';
  } else if (now >= tStart && now <= tEnd){
    pill.textContent = `⏳ Tugashgacha: ${fmtDur(tEnd - now)}`;
    btn.disabled = false;
    if (btn.tagName === 'A') btn.href = r.link || '#';
    btn.textContent = 'Boshlash';
  } else {
    // yakun
    if (r.result && r.result.trim()){
      pill.textContent = '✅ Yakunlandi';
      if (btn.tagName === 'A'){ btn.textContent = 'Natijani bilish'; btn.href = r.result; btn.disabled = false; }
      else { btn.textContent = 'Natijani bilish'; btn.disabled = true; }
    } else {
      pill.textContent = '⏳ Natijalar tayyorlanmoqda';
      btn.textContent = 'Natijalar hali chiqmadi'; btn.disabled = true;
    }
  }
}

function startTick(){
  // har 1s da barcha pill/btn larni yangilaymiz
  setInterval(()=>{ timers.forEach(fn => fn()); }, 1000);
}

/* ====== CSV helpers ====== */
async function fetchCSV(p){ try{ const r=await fetch(p,{cache:'no-cache'}); if(r.ok) return await r.text(); }catch{} return null; }
function detectDelim(line){ const cand=['|',',',';','\t']; const cnt=cand.map(d=>line.split(d).length-1); const m=Math.max(...cnt); return m>0?cand[cnt.indexOf(m)]:',';}
function parseCSV(text){
  const L=text.replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n');
  let first=''; for(const ln of L){ const t=ln.trim(); if(t){ first=ln; break; } }
  const d=detectDelim(first || 'Img url,Title,Sana,Boshlash vaqti,Tugash vaqti,Bosh sovrin,Tugma linki,Natija linki,Test narxi');
  const rows=[]; let row=[],f='',q=false;
  const push=()=>{ let v=f; if(v.startsWith('"')&&v.endsWith('"')) v=v.slice(1,-1).replace(/""/g,'"'); row.push(v.trim()); f=''; };
  for(let i=0;i<text.length;i++){
    const ch=text[i], nx=text[i+1];
    if(ch=='"'){ if(q&&nx=='"'){f+='"'; i++;} else q=!q; continue; }
    if(ch=='\n'&&!q){ push(); if(row.some(x=>x!=='') && !String(row[0]||'').trim().startsWith('#')) rows.push(row); row=[]; continue; }
    if(ch==d&&!q){ push(); continue; }
    f+=ch;
  }
  push(); if(row.some(x=>x!=='') && !String(row[0]||'').trim().startsWith('#')) rows.push(row);
  return rows;
}
function normalize(rows){
  if(!rows.length) return [];
  const hdr=rows[0].map(s=>s.toLowerCase());
  const hasHdr = hdr[0]?.includes('img') && hdr[1]?.includes('title');
  const start = hasHdr ? 1 : 0;
  const out=[];
  for(let i=start;i<rows.length;i++){
    const r=rows[i];
    const [img,title,date,startTime,endTime,prize,href,result,price] = r;
    out.push({
      img:img||'', title:title||'', date:(date||'').trim(),
      startTime:(startTime||'').trim(), endTime:(endTime||'').trim(),
      prize:prize||'', link:href||'', result:result||'', price:price||''
    });
  }
  return out;
}

/* ====== time helpers ====== */
function toTs(dateStr, timeStr){
  // date: YYYY-MM-DD, time: HH:MM[:SS]  (mahalliy vaqt)
  if(!dateStr) return 0;
  const [Y,M,D] = dateStr.split('-').map(n=>parseInt(n,10));
  let [hh='00',mm='00',ss='00'] = (timeStr||'00:00').split(':');
  const d = new Date(Y, (M-1), D, parseInt(hh,10)||0, parseInt(mm,10)||0, parseInt(ss,10)||0);
  return d.getTime();
}
function fmtDate(s){
  if(!s) return '—';
  const [Y,M,D]=s.split('-'); return `${Y}-${M}-${D}`;
}
function fmtDur(ms){
  if(ms<0) ms=0; let s=Math.floor(ms/1000);
  const h=Math.floor(s/3600); s%=3600;
  const m=Math.floor(s/60); s%=60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}
const pad=n=>String(n).padStart(2,'0');
function esc(s){ return String(s||'').replace(/[&<>\"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c])); }
