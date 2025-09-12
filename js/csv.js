export async function loadCSV(url){
  const res = await fetch(url, {cache:'no-store'});
  if(!res.ok) throw new Error('CSV yuklanmadi: ' + res.status);
  const text = await res.text();
  return parseCSV(text);
}

export function parseCSV(text){
  // simple CSV parser supporting quoted commas
  const rows = [];
  let row = [], cell = "", inQ = false;
  for(let i=0;i<text.length;i++){
    const ch = text[i], nxt = text[i+1];
    if(inQ){
      if(ch === '"' && nxt === '"'){ cell+='"'; i++; continue; }
      if(ch === '"'){ inQ=false; continue; }
      cell += ch;
    }else{
      if(ch === '"'){ inQ=true; continue; }
      if(ch === ','){ row.push(cell.trim()); cell=""; continue; }
      if(ch === '\n'){ row.push(cell.trim()); rows.push(row); row=[]; cell=""; continue; }
      cell += ch;
    }
  }
  if(cell.length>0 || row.length>0){ row.push(cell.trim()); rows.push(row); }
  return rows.filter(r=>r.some(c=>c!==''));
}
