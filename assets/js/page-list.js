import{bootFirebase}from'./firebase-init.js';const $=(s,c=document)=>c.querySelector(s);const PAGE_SIZE=12;const typeMap={courses:'course',simulators:'sim',tests:'test'};
function uniq(l,k){return Array.from(new Set(l.map(c=>(c[k]||'').trim()).filter(Boolean))).sort((a,b)=>a.localeCompare(b))}
function price(v){v=+v||0;return v<=0?'<span class="price free">FREE</span>':`<span class="price">${v.toLocaleString('uz-UZ')} so'm</span>`}
function el(h){const t=document.createElement('template');t.innerHTML=h.trim();return t.content.firstChild}
function cardCourse(c){return `<article class="card3d">${c.image?`<img class="media" src="${c.image}" alt="cover">`:''}
<div class="body"><h3 class="ctitle">${c.title} ${c.tag?`<span class="tag">${String(c.tag).toUpperCase()}</span>`:''} ${c.cat?`<span class="tag">${c.cat}</span>`:''} ${c.cat2?`<span class="tag">${c.cat2}</span>`:''} ${c.cat3?`<span class="tag">${c.cat3}</span>`:''}</h3>
${c.desc?`<p class="desc">${c.desc}</p>`:''}<div class="foot">${price(c.price)} ${c.link?`<a class="pill" href="${c.link}">${c.button||'Boshlash'}</a>`:''}</div></div></article>`}