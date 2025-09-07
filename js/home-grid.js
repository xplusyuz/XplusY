// CSV-driven home grid: expects pipe-delimited "Img url|Title|Meta|tugma nomi|tugma linki"
const grid = document.querySelector('#homeGrid');
if (grid) {
  const src = grid.dataset.csv || './home.csv';
  const tryPaths = [src, './home.csv', './data/home.csv'];
  (async () => {
    let text = null;
    for (const p of tryPaths) {
      try {
        const r = await fetch(p, { cache: 'no-cache' });
        if (r.ok) { text = await r.text(); break; }
      } catch (_) {}
    }
    if (!text) { renderFallback(); return; }
    const rows = parsePipeCSV(text);
    if (!rows.length) { renderFallback(); return; }
    renderRows(rows);
  })();
}

function parsePipeCSV(txt){
  const lines = txt.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const rows = [];
  for (let i=0;i<lines.length;i++){
    const line = lines[i];
    if (line.startsWith('#')) continue; // comment
    const parts = line.split('|').map(s => s.trim());
    if (i===0 && parts[0].toLowerCase().includes('img') && parts[1].toLowerCase().includes('title')) continue; // header
    if (parts.length < 5) continue;
    const [img, title, meta, btn, href] = parts;
    rows.push({ img, title, meta, btn, href });
  }
  return rows;
}

function renderRows(rows){
  grid.innerHTML = '';
  for (const r of rows){
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      ${r.img ? `<img src="${r.img}" alt="${escapeHtml(r.title||'Card')}" loading="lazy" style="width:100%;border-radius:14px;border:1px solid rgba(255,255,255,.08);margin-bottom:8px;aspect-ratio:16/9;object-fit:cover" />` : ''}
      ${r.title ? `<h2>${escapeHtml(r.title)}</h2>` : ''}
      ${r.meta ? `<p class="sub">${escapeHtml(r.meta)}</p>` : ''}
      ${r.btn ? `<a class="btn primary" href="${r.href||'#'}">${escapeHtml(r.btn)}</a>` : ''}
    `;
    grid.appendChild(card);
  }
}

function renderFallback(){
  grid.innerHTML = `
    <div class="card"><h2>📝 Testlar</h2><p class="sub">Oson / O‘rta / Qiyin — 10 ta savol</p><a class="btn primary" href="./tests.html">Boshlash</a></div>
    <div class="card"><h2>🎮 Live</h2><p class="sub">Pre-join, start lock, jonli reyting</p><a class="btn primary" href="./live.html">Kirish</a></div>
    <div class="card"><h2>🏅 Reyting</h2><p class="sub">Top 100 olmos</p><a class="btn primary" href="./leaderboard.html">Ko‘rish</a></div>
    <div class="card"><h2>⚙️ Sozlamalar</h2><p class="sub">Profil, natijalar, balans, promo va admin</p><a class="btn primary" href="./settings.html">Ochish</a></div>
  `;
}

function escapeHtml(s){
  return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
