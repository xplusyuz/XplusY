// js/live-csv.js — Live katalog (no filters), super premium schedule
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const $ = (s)=>document.querySelector(s);
let el, auth, currentUser=null;

function parseCSV(t){
  const rows=[];let r=[],c='',q=false;
  for(let i=0;i<t.length;i++){
    const ch=t[i];
    if(q){ if(ch=='"'){ if(t[i+1]=='"'){c+='"';i++;} else q=false; } else c+=ch; }
    else { if(ch=='"') q=true; else if(ch==','){ r.push(c.trim()); c=''; }
      else if(ch=='\n'||ch=='\r'){ if(c!==''||r.length){ r.push(c.trim()); rows.push(r); r=[]; c=''; } }
      else c+=ch; }
  }
  if(c!==''||r.length){ r.push(c.trim()); rows.push(r); }
  return rows.filter(x=>x.length && x.some(v=>v!==''));
}

async function loadLive(){
  let res = await fetch("csv/live.csv", {cache:"no-cache"});
  if(!res.ok) res = await fetch("live.csv", {cache:"no-cache"});
  const rows = parseCSV(await res.text());
  const head = rows[0];
  const idx = (k)=> head.indexOf(k);
  return rows.slice(1).map(r=>{
    const start = Date.parse(r[idx("start_iso")]);
    let end = r[idx("end_iso")] ? Date.parse(r[idx("end_iso")]) : null;
    const durMin = parseInt(r[idx("duration_min")]||'0',10)||0;
    if(!end && start && durMin) end = start + durMin*60*1000;
    return {
      file: r[idx("file")], banner: r[idx("banner")], title: r[idx("title")], meta: r[idx("meta")],
      price_som: +(r[idx("price_som")]||0), start, end, durMin
    };
  }).filter(x=>x.file && x.start && x.end);
}

function human(ts){
  try{ return new Date(ts).toLocaleString('uz-UZ',{hour12:false}); }catch{ return '—'; }
}
function leftStr(ms){
  if(ms<=0) return "00:00";
  const s=Math.floor(ms/1000), m=String(Math.floor(s/60)).padStart(2,'0'), ss=String(s%60).padStart(2,'0');
  return `${m}:${ss}`;
}
function state(it, now){ if(now<it.start) return "upcoming"; if(now>=it.end) return "closed"; return "open"; }

function render(items){
  const box = el.cards; box.innerHTML = "";
  if(!items.length){ box.innerHTML = `<div class="eh-note">Hozircha live test yo'q.</div>`; return; }

  items.forEach((it, i)=>{
    const now = Date.now();
    const st = state(it, now);
    const div = document.createElement('div'); div.className='live-card';
    div.innerHTML = `
      <img src="${it.banner||''}" alt="">
      <div class="live-body">
        <div class="live-title">${it.title||'Nomsiz live test'}</div>
        <div class="live-meta">${it.meta||''}</div>
        <div class="live-row">
          <span class="badge gold">💎 ${new Intl.NumberFormat('uz-UZ').format(it.price_som)} so'm</span>
          <span class="badge time">🕒 ${it.durMin || Math.round((it.end-it.start)/60000)} daq</span>
        </div>
        <div class="live-row">
          <span class="badge ${st==='open'?'ok':st==='upcoming'?'soon':'closed'}">${st==='open'?'Ochiq':st==='upcoming'?'Kutilmoqda':'Yopilgan'}</span>
          <span class="countdown" id="cd_${i}"></span>
        </div>
        <div class="live-meta">⏩ Boshlash: ${human(it.start)} | ⏹ Tugash: ${human(it.end)}</div>
        <div class="live-actions">
          <button class="eh-btn ghost" id="v_${i}">Batafsil</button>
          <button class="eh-btn primary" id="s_${i}" ${st!=='open'?'disabled':''}>Boshlash</button>
        </div>
      </div>`;
    box.append(div);

    const cd = div.querySelector(`#cd_${i}`);
    const btn = div.querySelector(`#s_${i}`);

    const upd = ()=>{
      const now = Date.now();
      const stt = state(it, now);
      if(stt==='upcoming'){ cd.textContent="Startgacha: "+leftStr(it.start-now); btn.disabled=true; }
      else if(stt==='open'){ cd.textContent="Tugashgacha: "+leftStr(it.end-now); btn.disabled=false; }
      else { cd.textContent="Yopilgan"; btn.disabled=true; }
    };
    upd(); setInterval(upd, 1000);

    div.querySelector(`#v_${i}`).onclick = ()=>{
      alert(`${it.title}\n${it.meta}\nNarx: ${new Intl.NumberFormat('uz-UZ').format(it.price_som)} so'm\nBoshlash: ${human(it.start)}\nTugash: ${human(it.end)}`);
    };
    btn.onclick = ()=>{
      if(!currentUser){ alert("Kirish talab qilinadi."); return; }
      localStorage.setItem('liveLaunch', JSON.stringify({ file: it.file, start: it.start, end: it.end }));
      location.hash = "#/tests";
    };
  });
}

async function init(){
  el = { page: document.getElementById("live-page"), cards: document.getElementById("liveCards") };
  auth = getAuth(); onAuthStateChanged(auth, u=>{ currentUser = u||null; });
  const items = await loadLive();
  render(items);
}

export default { init };
