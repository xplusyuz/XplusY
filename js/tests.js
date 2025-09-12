(async function(){
  const grid = document.getElementById("testsGrid");
  if (!grid) return;
  try{
    const res = await fetch("/csv/tests.csv", {cache:"no-store"});
    const csv = await res.text();
    const rows = csv.split(/\r?\n/).filter(Boolean).map(l=>l.split("|"));
    rows.slice(1).forEach(r=>{
      const [img, title, link, price, cat, diff] = r;
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = \`
        <img class="cover" src="\${img||''}" alt=""/>
        <h3>\${title||'Nomsiz'}</h3>
        <p class="status">\${cat||''} • \${diff||''}</p>
        <div class="kv" style="justify-content:space-between">
          <div>💵 \${Number(price||0).toLocaleString('uz-UZ')} so'm</div>
          <a class="btn" href="#/test?src=\${encodeURIComponent(link||'')}&price=\${Number(price||0)}&title=\${encodeURIComponent(title||'Test')}">Boshlash</a>
        </div>
      \`;
      grid.appendChild(card);
    });
  }catch(e){
    grid.innerHTML = "<div class='status'>CSV o'qishda xatolik</div>";
    console.error(e);
  }
})();