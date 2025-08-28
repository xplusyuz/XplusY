<script type="module">
const key = 'xplusy-theme'
const root = document.documentElement
function apply(theme){
if(theme === 'dark') root.classList.add('dark'); else root.classList.remove('dark')
localStorage.setItem(key, theme)
}
const saved = localStorage.getItem(key)
apply(saved || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark': 'light'))
document.addEventListener('click', (e)=>{
const btn = e.target.closest('#themeToggle')
if(!btn) return
apply(root.classList.contains('dark') ? 'light':'dark')
})
</script>