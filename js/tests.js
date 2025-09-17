export default {
  async init(){
    const box = document.getElementById('testsGrid'); if(!box) return;
    try{
      const res = await fetch('csv/tests.csv?v='+Date.now(), {cache:'no-store'});
      if(!res.ok) throw 0; const text = await res.text();
      const lines = text.trim().split(/\r?\n/); const head = lines.shift().split(',');
      const idx = (k)=> head.findIndex(h=>h.trim().toLowerCase()===k);
      const items = lines.map(l=>{ const r=l.split(','); return {
        img:r[idx('img_url')], title:r[idx('title')], time:r[idx('time_min')], price:r[idx('price')], link:r[idx('link')]
      };});
      box.innerHTML = items.map(it=>`
        <div class="card">
          ${it.img?`<img class="hero" src="${it.img}" alt="">`:''}
          <h3>${it.title||''}</h3>
          <p class="sub">${[it.time?`⏱ ${it.time} daqiqa`:'' , it.price?`💵 ${it.price}`:''].filter(Boolean).join(' • ')}</p>
          ${it.link?`<p style="margin-top:6px"><a class="btn primary" href="${it.link}">Boshlash</a></p>`:''}
        </div>`).join('') || '<div class="card">Hozircha yo‘q</div>';
    }catch{ box.innerHTML = '<div class="card">csv/tests.csv topilmadi</div>'; }
  },
  destroy(){}
};