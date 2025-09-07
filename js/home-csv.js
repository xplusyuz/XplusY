// Home CSV grid: Img url, Title, Meta, tugma nomi, tugma linki
const host = document.querySelector('#homeGrid');
const path = host?.dataset?.csv || './csv/home.csv';
(async()=>{
  const text = await fetchCSV(path);
  if(!text){ host.innerHTML = '<div class="card">home.csv topilmadi.</div>'; return; }
  const rows = parseCSV(text); const data = normalize(rows);
  host.innerHTML = ''; data.forEach(r => host.appendChild(card(r)));
})();
function card(r){
  const x = document.createElement('div'); x.className='card';
  const btn = r.href ? `<a class="btn primary" href="${r.href}">${esc(r.btn||'Ochish')}</a>` : '';
  x.innerHTML = `${r.img ? `<img src="${r.img}" alt="${esc(r.title)}" loading="lazy">` : ''}
    ${r.title ? `<h3 style="margin:.2rem 0">${esc(r.title)}</h3>` : ''}
    ${r.meta ? `<p class="sub">${esc(r.meta)}</p>` : ''}
    ${btn}`;
  return x;
}
async function fetchCSV(p){ try{ const r=await fetch(p,{cache:'no-cache'}); if(r.ok) return await r.text(); }catch{} return null; }
function detectDelim(line){ const cand=['|',',',';','\t']; const cnt=cand.map(d=>line.split(d).length-1); const m=Math.max(...cnt); return m>0?cand[cnt.indexOf(m)]:',';}
function parseCSV(text){
  const L=text.replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n');
  let first=''; for(const ln of L){const t=ln.trim(); if(t){first=ln; break;}}
  const d=detectDelim(first||'Img url|Title|Meta|tugma nomi|tugma linki');
  const rows=[]; let row=[],f='',q=false;
  const push=()=>{ let v=f; if(v.startsWith('"')&&v.endsWith('"')) v=v.slice(1,-1).replace(/""/g,'"'); row.push(v.trim()); f=''; };
  for(let i=0;i<text.length;i++){ const ch=text[i],nx=text[i+1];
    if(ch=='"'){ if(q&&nx=='"'){f+='"'; i++;} else q=!q; continue; }
    if(ch=='\n'&&!q){ push(); if(row.some(x=>x!=='')&&!String(row[0]||'').trim().startsWith('#')) rows.push(row); row=[]; continue; }
    if(ch==d&&!q){ push(); continue; }
    f+=ch;
  } push(); if(row.some(x=>x!=='')&&!String(row[0]||'').trim().startsWith('#')) rows.push(row);
  return rows;
}
function normalize(rows){
  if(!rows.length) return [];
  const hdr=rows[0].map(s=>s.toLowerCase());
  const hasHdr=hdr[0]?.includes('img') && hdr[1]?.includes('title');
  const start=hasHdr?1:0, out=[];
  for(let i=start;i<rows.length;i++){
    const [img,title,meta,btn,href]=rows[i];
    out.push({img:img||'',title:title||'',meta:meta||'',btn:btn||'Ochish',href:href||'#'});
  }
  return out;
}
function esc(s){ return String(s||'').replace(/[&<>\"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c])); }