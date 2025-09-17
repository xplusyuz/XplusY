export default {
  async init(){
    const box = document.getElementById('homeHeroes'); if(!box) return;
    try{
      const res = await fetch('csv/home.csv?v='+Date.now(), {cache:'no-store'});
      if(!res.ok) throw 0; const text = await res.text();
      const rows = text.trim().split(/\r?\n/).slice(1).map(l=>l.split(','));
      const cards = rows.map(r=>{
        const [img_url,title,meta,link,primary] = r;
        return `<div class="card">
          ${img_url?`<img class="hero" src="${img_url}" alt="">`:''}
          <h3>${title||''}</h3>
          ${meta?`<p class="sub">${meta}</p>`:''}
          ${link?`<p style="margin-top:6px"><a class="btn ${primary==='1'?'primary':''}" href="${link}">Ochish</a></p>`:''}
        </div>`;
      }).join('');
      box.innerHTML = cards || '<div class="card">Hozircha yo‘q</div>';
    }catch{ box.innerHTML = '<div class="card">CSV topilmadi</div>'; }
  },
  destroy(){}
};