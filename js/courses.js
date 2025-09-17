export default {
  async init(){
    const box=document.getElementById('coursesGrid'); if(!box) return;
    try{
      const res = await fetch('csv/courses.csv?v='+Date.now(), {cache:'no-store'});
      if(!res.ok) throw 0; const t=await res.text();
      const lines=t.trim().split(/\r?\n/); const head=lines.shift().split(',');
      const idx=(k)=> head.findIndex(h=>h.trim().toLowerCase()===k);
      const items = lines.map(l=>{ const r=l.split(','); return { img:r[idx('img_url')], title:r[idx('title')], meta:r[idx('meta')], link:r[idx('link')], price:r[idx('price_som')] }; });
      box.innerHTML = items.map(it=>`<div class="card">
        ${it.img?`<img class="hero" src="${it.img}" alt="">`:''}
        <h3>${it.title||''}</h3>
        ${it.meta?`<p class="sub">${it.meta}</p>`:''}
        ${it.link?`<p style="margin-top:6px"><a class="btn" href="${it.link}">Ko‘rish</a></p>`:''}
        ${it.price?`<p class="sub">💰 ${it.price} so‘m</p>`:''}
      </div>`).join('') || '<div class="card">Kurslar yo‘q</div>';
    }catch{ box.innerHTML = '<div class="card">csv/courses.csv topilmadi</div>'; }
  },
  destroy(){}
};