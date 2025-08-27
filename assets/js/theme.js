<script>
(function(){
const root = document.documentElement;
const apply = (mode)=>{ root.classList.toggle('dark', mode==='dark'); localStorage.setItem('xpy-theme', mode); updateIcons(); };
const updateIcons = ()=>{
const sun = '☀️', moon = '🌙';
const isDark = root.classList.contains('dark');
const el = document.getElementById('themeIcon'); if(el) el.textContent = isDark ? sun : moon;
const elM = document.getElementById('themeToggleM'); if(elM) elM.textContent = isDark ? sun : moon;
};
const init = ()=>{
const saved = localStorage.getItem('xpy-theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark':'light');
apply(saved);
const t1 = document.getElementById('themeToggle'); if(t1) t1.addEventListener('click', ()=> apply(root.classList.contains('dark')?'light':'dark'));
const t2 = document.getElementById('themeToggleM'); if(t2) t2.addEventListener('click', ()=> apply(root.classList.contains('dark')?'light':'dark'));
};
if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
</script>