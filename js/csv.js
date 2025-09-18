export async function fetchCSV(url){
  const res = await fetch(url, {cache:'no-cache'});
  const txt = await res.text();
  const [head,*rows] = txt.trim().split(/\r?\n/);
  const cols = head.split(',').map(s=>s.trim());
  return rows.map(r=>{
    const parts = r.split(','); const obj={};
    cols.forEach((c,i)=> obj[c]=parts[i]?.trim() ?? '');
    return obj;
  });
}
