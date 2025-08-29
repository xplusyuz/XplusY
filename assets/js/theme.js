
export function initTheme(){
  const saved = localStorage.getItem('theme');
  if (saved==='light') document.body.classList.add('light');
  const btn = document.getElementById('themeToggle');
  if (btn) btn.addEventListener('click', ()=>{
    document.body.classList.toggle('light');
    localStorage.setItem('theme', document.body.classList.contains('light') ? 'light':'dark');
  });
}
