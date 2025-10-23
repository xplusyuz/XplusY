// ===== JSON Content Management =====
let appContent = {
  banners: [],
  sections: []
};

// Modal for content
const contentModal = document.createElement('div');
contentModal.className = 'modal-mask';
contentModal.style.display = 'none';
contentModal.innerHTML = `
  <div class="modal" style="max-width: 90%; max-height: 80vh; overflow-y: auto;">
    <div style="display: flex; justify-content: between; align-items: center; margin-bottom: 15px;">
      <h3 style="margin: 0;">Test ma'lumotlari</h3>
      <button id="closeModal" class="iconbtn danger" style="margin-left: auto;">✕</button>
    </div>
    <div id="modalContent"></div>
  </div>
`;
document.body.appendChild(contentModal);

document.getElementById('closeModal').onclick = () => {
  contentModal.style.display = 'none';
};

// Function to handle different button types
function createActionButton(item) {
  const now = new Date();
  const startTime = new Date(item.startTime);
  const endTime = new Date(item.endTime);
  
  switch(item.type) {
    case 'timed':
      if (now >= startTime && now <= endTime) {
        return `<a class="btn" href="${item.link}" target="_blank" rel="noopener">Boshlash</a>`;
      } else {
        const status = now < startTime ? 
          `Boshlanishi: ${startTime.toLocaleDateString('uz-UZ')}` : 
          `Yakunlangan`;
        return `<button class="btn" disabled>${status}</button>`;
      }
    
    case 'modal':
      return `<button class="btn modal-trigger" data-content='${JSON.stringify(item.modalContent).replace(/'/g, "&#39;")}'>Boshlash</button>`;
    
    case 'link':
    default:
      return `<a class="btn" href="${item.link}" target="_blank" rel="noopener">Boshlash</a>`;
  }
}

// Modified renderSections function
function renderSections(root, filtered = false) {
  const wrap = document.getElementById('sections');
  wrap.innerHTML = '';
  
  (root.sections || []).forEach((sec, si) => {
    if (filtered && active.size) {
      const sTitle = sec.title.toLowerCase();
      const ok = [...active].every(f => 
        sTitle.includes(f.toLowerCase()) || 
        (f === 'BSB' && sTitle.includes('bsb')) || 
        (f === 'CHSB' && sTitle.includes('chsb'))
      );
      if (!ok) return;
    }
    
    let items = sec.items || [];
    if (filtered && active.size) {
      items = items.filter(it => 
        (it.tags || []).some(tag => 
          [...active].some(f => tag.toLowerCase().includes(f.toLowerCase()))
        )
      );
    }
    if (!items.length) return;

    const section = document.createElement('section');
    section.className = 'sect';
    section.innerHTML = `
      <div class="frame">
        <div class="framehead">
          <div class="dotcap"></div>
          <h2>${sec.title}</h2>
        </div>
        <div class="grid" id="grid-${si}"></div>
        <div class="pager" id="pager-${si}" style="display:none">
          <button data-prev="${si}">Oldingi</button>
          <div class="info" id="info-${si}"></div>
          <button data-next="${si}">Keyingi</button>
        </div>
      </div>
    `;
    wrap.appendChild(section);

    const curPage = pageState.get(si) ?? 0;
    const totalPages = Math.ceil(items.length / PAGESIZE);
    const start = curPage * PAGESIZE;
    const visible = items.slice(start, start + PAGESIZE);

    const grid = section.querySelector('#grid-' + si);
    visible.forEach(it => {
      const el = document.createElement('article');
      el.className = 'card';
      
      const actionButton = createActionButton(it);
      
      el.innerHTML = `
        <div class="thumb ${!it.image ? 'noimg' : ''}">
          ${it.image ? `<img src="${it.image}" alt="" loading="lazy" decoding="async"
             onerror="this.onerror=null; this.parentElement.classList.add('noimg'); this.remove();">` : ''}
          <div class="ov" aria-label="${it.name}">
            <span class="label">${it.name}</span>
          </div>
          ${it.best ? '<div class="badge">BEST</div>' : ''}
        </div>
        <div class="body">
          <h3 class="name">${it.name}</h3>
          ${it.description ? `<p class="desc">${it.description}</p>` : ''}
          <div class="tags">
            ${(it.tags || []).map(t => `<span class="tag">${t}</span>`).join('')}
          </div>
          <div class="actions">
            ${actionButton}
            ${it.more ? `<a class="btn ghost" href="${it.more}" target="_blank" rel="noopener">Batafsil</a>` : ''}
          </div>
        </div>
      `;
      grid.appendChild(el);
    });

    // Add modal trigger event listeners
    grid.querySelectorAll('.modal-trigger').forEach(btn => {
      btn.onclick = () => {
        const content = JSON.parse(btn.dataset.content.replace(/&#39;/g, "'"));
        document.getElementById('modalContent').innerHTML = content;
        contentModal.style.display = 'flex';
      };
    });

    // Pager logic remains the same...
    const pager = section.querySelector('#pager-' + si);
    if (totalPages > 1) {
      pager.style.display = 'flex';
      section.querySelector('#info-' + si).textContent = `Sahifa ${curPage + 1} / ${totalPages}`;
      pager.querySelector(`[data-prev="${si}"]`).onclick = () => { 
        pageState.set(si, Math.max(0, curPage - 1)); 
        renderSections(root, filtered); 
      };
      pager.querySelector(`[data-next="${si}"]`).onclick = () => { 
        pageState.set(si, Math.min(totalPages - 1, curPage + 1)); 
        renderSections(root, filtered); 
      };
    } else {
      pager.style.display = 'none';
    }
  });
}

// Modified carousel for HTML banners
function initCarousel(banners) {
  const track = document.getElementById('track');
  const dots = document.getElementById('dots');
  const prev = document.getElementById('prev');
  const next = document.getElementById('next');
  
  if (!banners?.length) {
    document.getElementById('carousel').style.display = 'none';
    return;
  }

  track.innerHTML = banners.map(b => {
    if (b.type === 'html') {
      return `<div class="slide">${b.content}</div>`;
    } else {
      return `<a class="slide" href="${b.link || '#'}" target="_blank" rel="noopener">
                <img src="${b.image}" alt="${b.title || 'Banner'}"/>
              </a>`;
    }
  }).join('');

  // Rest of carousel logic remains the same...
  dots.innerHTML = banners.map((_, i) => 
    `<div class="dot${i === 0 ? ' active' : ''}"></div>`
  ).join('');
  
  let i = 0, n = banners.length, x = 0, sx = 0, drag = false, auto;
  const set = idx => {
    i = (idx + n) % n;
    track.style.transform = `translateX(-${i * 100}%)`;
    [...dots.children].forEach((d, k) => d.classList.toggle('active', k === i));
  };
  
  const play = () => { clearInterval(auto); auto = setInterval(() => set(i + 1), 3500); };
  const stop = () => clearInterval(auto);
  
  next.onclick = () => { set(i + 1); play(); };
  prev.onclick = () => { set(i - 1); play(); };
  
  // Touch and mouse events remain the same...
  const onDown = e => { drag = true; sx = e.touches ? e.touches[0].clientX : e.clientX; stop(); };
  const onMove = e => { 
    if (!drag) return; 
    x = (e.touches ? e.touches[0].clientX : e.clientX) - sx; 
    track.style.transform = `translateX(calc(${-i * 100}% + ${x}px))`; 
  };
  const onUp = () => { 
    if (!drag) return; 
    drag = false; 
    if (Math.abs(x) > 50) { set(i + (x < 0 ? 1 : -1)); } 
    else set(i); 
    x = 0; 
    play(); 
  };
  
  track.addEventListener('touchstart', onDown, { passive: true });
  track.addEventListener('touchmove', onMove, { passive: true });
  track.addEventListener('touchend', onUp);
  track.addEventListener('mousedown', onDown);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
  
  set(0);
  play();
}

// Load content from JSON
async function fetchContent() {
  try {
    const response = await fetch('./index.json');
    if (!response.ok) throw new Error('JSON fayl topilmadi');
    return await response.json();
  } catch (error) {
    console.warn('JSON yuklanmadi, standart ma\'lumotlar ishlatiladi:', error);
    return {
      banners: [],
      sections: []
    };
  }
}

async function init() {
  const data = await fetchContent();
  window.__data__ = data;
  buildChipsFromData(data);
  initCarousel(data.banners || []);
  renderSections(data);
}

init();