export async function fetchCSV(path){
  const res = await fetch(path, { cache: "no-cache" });
  if(!res.ok) throw new Error(`CSV yuklab bo'lmadi: ${path}`);
  const text = await res.text();
  return parseCSV(text);
}
export function parseCSV(str){
  const lines = str.replace(/\r/g,'').split('\n').filter(l=>l.trim().length>0);
  if(lines.length===0) return [];
  const header = splitCSVLine(lines[0]);
  return lines.slice(1).map(line=>{
    const cells = splitCSVLine(line);
    const row = {};
    header.forEach((h,i)=> row[h.trim()] = (cells[i] ?? '').trim());
    return row;
  });
}
function splitCSVLine(line){
  const out = []; let cur = '', inQ = false;
  for(let i=0;i<line.length;i++){
    const ch = line[i];
    if(ch === '"'){
      if(inQ && line[i+1] === '"'){ cur += '"'; i++; } else { inQ = !inQ; }
    } else if(ch === ',' && !inQ){
      out.push(cur); cur = '';
    } else { cur += ch; }
  }
  out.push(cur); return out;
}
export function uniqueValues(rows, key){
  const s = new Set(); rows.forEach(r=> s.add(r[key]||''));
  return Array.from(s).filter(Boolean).sort();
}
export function byDate(a,b, key='startISO'){
  const ta = Date.parse(a[key]||0) || 0;
  const tb = Date.parse(b[key]||0) || 0;
  return ta - tb;
}
