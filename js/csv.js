
// js/csv.js — minimal CSV fetcher + parser (auto delimiter)
export async function fetchCSV(path){
  const res = await fetch(path, {cache:"no-store"});
  if (!res.ok) throw new Error(`CSV yuklab bo'lmadi: ${path} (${res.status})`);
  const text = await res.text();
  return parseCSV(text);
}

export function parseCSV(text){
  // Auto-detect delimiter: | ; , \t
  const firstLine = (text.split(/\r?\n/).find(l => l.trim().length) || "");
  const candidates = ["|",";","\t",","];
  let delim = ",";
  let maxCount = -1;
  for (const d of candidates){
    const c = (firstLine.match(new RegExp(`\\${d}`, "g"))||[]).length;
    if (c > maxCount){ maxCount = c; delim = d; }
  }
  return csvToObjects(text, delim);
}

function csvToObjects(text, delim=","){
  const lines = text.replace(/\r/g,"").split("\n").filter(l => l.trim().length);
  if (!lines.length) return [];
  const head = splitSmart(lines[0], delim).map(normKey);
  const rows = lines.slice(1).map(l => splitSmart(l, delim));
  return rows.map(r => Object.fromEntries(head.map((k,i)=>[k, (r[i]??"").trim()])));
}

// Quote-aware splitter
function splitSmart(line, delim){
  const out = []; let cur=""; let q=false;
  for (let i=0;i<line.length;i++){
    const ch = line[i];
    if (ch === '"'){ // handle escaped quotes
      if (q && line[i+1] === '"'){ cur+='"'; i++; }
      else { q = !q; }
      continue;
    }
    if (!q && ch === delim){ out.push(cur); cur=""; continue; }
    cur+=ch;
  }
  out.push(cur);
  return out;
}

function normKey(k){
  return (k||"").toString().trim().toLowerCase()
    .replace(/\s+/g,"_")
    .replace(/[^a-z0-9_]/g,"");
}
