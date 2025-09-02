// Category page renderer
async function includePartialsCategory(){
  const header = await fetch("partials/header.html").then(r=>r.text());
  const footer = await fetch("partials/footer.html").then(r=>r.text());
  document.getElementById("header-container").innerHTML = header;
  document.getElementById("footer-container").innerHTML = footer;
  if(window.wireHeader) wireHeader();
  renderAfterAuth();
  if(window.ensureAuthGate) ensureAuthGate();
  renderCategory();
}
function iconFor(item){
  const map = {
    math: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none"><path d="M6 12h12M12 6v12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    physics: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="2" fill="currentColor"/></svg>',
    chem: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none"><path d="M7 4v6l-3 6h16l-3-6V4" stroke="currentColor" stroke-width="2"/></svg>',
    lang: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none"><path d="M4 6h16M4 12h9M4 18h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    general: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none"><rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" stroke-width="2"/><path d="M7 9h10M7 13h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
  };
  return map[item.icon||"general"];
}
async function renderCategory(){
  const cat = document.body.dataset.category;
  const grid = document.getElementById("cat-grid");
  let data = [];
  try{ data = await fetch(`assets/data/${cat}.json`).then(r=>r.json()); }
  catch(e){ data = [
      { id: `${cat}-1`, title: "Namuna 1", desc: "Namuna ta’lim birligi", icon:"general" },
      { id: `${cat}-2`, title: "Namuna 2", desc: "Namuna ta’lim birligi", icon:"general" },
      { id: `${cat}-3`, title: "Namuna 3", desc: "Namuna ta’lim birligi", icon:"general" },
    ]; }
  grid.innerHTML = data.map(item => `
    <article class="card">
      <span class="badge" style="display:flex;gap:8px;align-items:center">
        ${iconFor(item)} <span>${(item.tag || cat).toUpperCase()}</span>
      </span>
      <h3>${item.title}</h3>
      <p class="muted">${item.desc||""}</p>
      <div class="row"><a class="btn" href="${item.href||'#'}">Kirish</a><button class="btn ghost">Batafsil</button></div>
    </article>`).join("");
}
document.addEventListener("DOMContentLoaded", includePartialsCategory);
