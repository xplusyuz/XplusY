export function parseCSV(text){
  const rows = [];
  let cur = '', row = [], insideQuote = false;
  for (let i=0;i<text.length;i++){
    const c = text[i], n = text[i+1];
    if (c === '"'){
      if (insideQuote && n === '"'){ cur += '"'; i++; }
      else insideQuote = !insideQuote;
    } else if (c === ',' && !insideQuote){
      row.push(cur); cur = '';
    } else if ((c === '\n' || c === '\r') && !insideQuote){
      if (cur.length || row.length){ row.push(cur); rows.push(row); row = []; cur=''; }
    } else {
      cur += c;
    }
  }
  if (cur.length || row.length){ row.push(cur); rows.push(row); }
  const header = rows.shift() || [];
  return rows.map(r => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i]||'').trim()])));
}

export async function loadCSV(url){
  const res = await fetch(url, {cache:'no-store'});
  if (!res.ok) throw new Error('CSV yuklab bo‘lmadi: '+url);
  const text = await res.text();
  return parseCSV(text);
}
