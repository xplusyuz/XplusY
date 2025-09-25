
let data = { meta:{}, home:{banners:[]}, tests:[], courses:[], simulators:[] };

function uid(prefix){ return prefix + Math.random().toString(36).slice(2,8); }
function h(html){ const t=document.createElement('template'); t.innerHTML=html.trim(); return t.content.firstElementChild; }
function mount(el, nodes){ el.innerHTML=''; nodes.forEach(n=>el.appendChild(n)); }

async function loadInitial(){
  try{
    const res = await fetch('admin.json', { cache:'no-store' });
    if(res.ok){ data = await res.json(); }
  }catch(e){ console.warn("admin.json topilmadi, blank bilan boshlanadi"); }
  renderAll();
}

function inputRow(label, value, id){
  return `<label>${label}</label><input id="${id}" type="text" value="${value??''}"/>`;
}
function areaRow(label, value, id){
  return `<label>${label}</label><textarea id="${id}" rows="2">${value??''}</textarea>`;
}
function selectRow(label, value, id, options){
  return `<label>${label}</label><select id="${id}">${options.map(o=>`<option ${o===value?'selected':''}>${o}</option>`).join('')}</select>`;
}

function bannerItem(b){
  const el = h(`<div class="item">
    <div class="row"><b>${b.title||'Banner'}</b>
      <div class="row">
        <button class="tab-btn danger del">O‘chirish</button>
      </div>
    </div>
    ${inputRow('ID', b.id, 'id')}
    ${inputRow('Sarlavha', b.title, 'title')}
    ${inputRow('Quyi sarlavha', b.subtitle, 'subtitle')}
    ${inputRow('Rasm URL', b.image, 'image')}
    ${inputRow('Link', b.link, 'link')}
    ${selectRow('Tag', b.tag||'new', 'tag', ['new','pro','free'])}
  </div>`);
  el.querySelector('.del').onclick = ()=>{
    data.home.banners = data.home.banners.filter(x=>x!==b);
    renderBanners();
  };
  ['id','title','subtitle','image','link'].forEach(k=>{
    el.querySelector('#'+k).oninput = e=>{ b[k]=e.target.value; el.querySelector('b').textContent=b.title||'Banner'; };
  });
  el.querySelector('#tag').onchange = e=>{ b.tag=e.target.value; };
  return el;
}

function testItem(t){
  const el = h(`<div class="item">
    <div class="row"><b>${t.title||'Test'}</b>
      <div class="row">
        <button class="tab-btn danger del">O‘chirish</button>
      </div>
    </div>
    ${inputRow('ID', t.id, 'id')}
    ${inputRow('Sarlavha', t.title, 'title')}
    ${areaRow('Tavsif', t.desc, 'desc')}
    ${selectRow('Turi', t.type||'oddiy', 'type', ['online','oddiy'])}
    ${selectRow('Tag', t.tag||'free', 'tag', ['free','pro','new'])}
    ${inputRow('Narx (so\'m)', t.price??0, 'price')}
    ${inputRow('Rasm URL', t.image, 'image')}
    ${inputRow('Link', t.link, 'link')}
  </div>`);
  el.querySelector('.del').onclick = ()=>{
    data.tests = data.tests.filter(x=>x!==t);
    renderTests();
  };
  ['id','title','desc','image','link'].forEach(k=>{
    el.querySelector('#'+k).oninput = e=>{ t[k]=e.target.value; el.querySelector('b').textContent=t.title||'Test'; };
  });
  el.querySelector('#type').onchange = e=>{ t.type=e.target.value; };
  el.querySelector('#tag').onchange = e=>{ t.tag=e.target.value; };
  el.querySelector('#price').oninput = e=>{ t.price= Number(e.target.value||0); };
  return el;
}

function courseItem(c){
  const el = h(`<div class="item">
    <div class="row"><b>${c.title||'Kurs'}</b>
      <div class="row">
        <button class="tab-btn danger del">O‘chirish</button>
      </div>
    </div>
    ${inputRow('ID', c.id, 'id')}
    ${inputRow('Sarlavha', c.title, 'title')}
    ${areaRow('Tavsif', c.desc, 'desc')}
    ${selectRow('Tag', c.tag||'pro', 'tag', ['free','pro','new'])}
    ${inputRow('Narx (so\'m)', c.price??0, 'price')}
    ${inputRow('Rasm URL', c.image, 'image')}
    ${inputRow('Link', c.link, 'link')}
  </div>`);
  el.querySelector('.del').onclick = ()=>{
    data.courses = data.courses.filter(x=>x!==c);
    renderCourses();
  };
  ['id','title','desc','image','link'].forEach(k=>{
    el.querySelector('#'+k).oninput = e=>{ c[k]=e.target.value; el.querySelector('b').textContent=c.title||'Kurs'; };
  });
  el.querySelector('#tag').onchange = e=>{ c.tag=e.target.value; };
  el.querySelector('#price').oninput = e=>{ c.price= Number(e.target.value||0); };
  return el;
}

function simItem(s){
  const el = h(`<div class="item">
    <div class="row"><b>${s.title||'Sim'}</b>
      <div class="row">
        <button class="tab-btn danger del">O‘chirish</button>
      </div>
    </div>
    ${inputRow('ID', s.id, 'id')}
    ${inputRow('Sarlavha', s.title, 'title')}
    ${areaRow('Tavsif', s.desc, 'desc')}
    ${selectRow('Tag', s.tag||'free', 'tag', ['free','pro','new'])}
    ${inputRow('Rasm URL', s.image, 'image')}
    ${inputRow('Link', s.link, 'link')}
  </div>`);
  el.querySelector('.del').onclick = ()=>{
    data.simulators = data.simulators.filter(x=>x!==s);
    renderSims();
  };
  ['id','title','desc','image','link'].forEach(k=>{
    el.querySelector('#'+k).oninput = e=>{ s[k]=e.target.value; el.querySelector('b').textContent=s.title||'Sim'; };
  });
  el.querySelector('#tag').onchange = e=>{ s.tag=e.target.value; };
  return el;
}

function renderBanners(){
  const list = document.getElementById('list-banners');
  mount(list, data.home.banners.map(bannerItem));
}
function renderTests(){
  const list = document.getElementById('list-tests');
  mount(list, data.tests.map(testItem));
}
function renderCourses(){
  const list = document.getElementById('list-courses');
  mount(list, data.courses.map(courseItem));
}
function renderSims(){
  const list = document.getElementById('list-sims');
  mount(list, data.simulators.map(simItem));
}
function renderAll(){ renderBanners(); renderTests(); renderCourses(); renderSims(); }

function setupActions(){
  document.getElementById('add-banner').onclick = ()=>{
    const b = { id: uid('bn'), title:"Yangi banner", subtitle:"", image:"", link:"#", tag:"new" };
    data.home.banners.unshift(b); renderBanners();
  };
  document.getElementById('add-test').onclick = ()=>{
    const t = { id: uid('t'), title:"Yangi test", desc:"", type:"oddiy", tag:"free", price:0, image:"", link:"#"};
    data.tests.unshift(t); renderTests();
  };
  document.getElementById('add-course').onclick = ()=>{
    const c = { id: uid('c'), title:"Yangi kurs", desc:"", tag:"pro", price:0, image:"", link:"#"};
    data.courses.unshift(c); renderCourses();
  };
  document.getElementById('add-sim').onclick = ()=>{
    const s = { id: uid('s'), title:"Yangi sim", desc:"", tag:"free", image:"", link:"#"};
    data.simulators.unshift(s); renderSims();
  };

  // Import / Export
  const fileInput = document.getElementById('file-import');
  document.getElementById('btn-import').onclick = ()=> fileInput.click();
  fileInput.onchange = async (e)=>{
    const f = e.target.files[0]; if(!f) return;
    const txt = await f.text();
    try{
      const j = JSON.parse(txt);
      data = j;
      renderAll();
      alert('Import OK');
    }catch(err){
      alert('JSON xatolik: ' + err.message);
    }
  };

  document.getElementById('btn-export').onclick = ()=>{
    const out = JSON.stringify({ 
      ...data, 
      meta: { ...(data.meta||{}), updatedAt: new Date().toISOString() } 
    }, null, 2);
    const blob = new Blob([out], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'admin.json';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // Tabs
  const ids = ['banners','tests','courses','sims'];
  ids.forEach(id=>{
    document.getElementById('tab-'+id).onclick = ()=>{
      ids.forEach(x=>{
        document.getElementById('tab-'+x).classList.toggle('active', x===id);
        document.getElementById('ad-'+x).classList.toggle('active', x===id);
      });
    };
  });
}

document.addEventListener('DOMContentLoaded', ()=>{
  loadInitial();
  setupActions();
});
