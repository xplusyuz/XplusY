<script type="module">
// Inject header/footer from partial files
async function inject(selector, url){
const el = document.querySelector(selector)
if(!el) return
const res = await fetch(url)
el.innerHTML = await res.text()
}
await inject('#site-header','/public/partials/header.html')
await inject('#site-footer','/public/partials/footer.html')


// Drawer behavior
const drawer = document.getElementById('drawer')
const backdrop = document.getElementById('drawerBackdrop')
function open(){ drawer.classList.remove('-translate-x-full'); backdrop.classList.remove('hidden') }
function close(){ drawer.classList.add('-translate-x-full'); backdrop.classList.add('hidden') }
document.addEventListener('click', (e)=>{
if(e.target.closest('#openDrawer')) open()
if(e.target.closest('#closeDrawer') || e.target === backdrop) close()
const routeLink = e.target.closest('a[data-route]')
if(routeLink){ e.preventDefault(); window.router.goto(routeLink.dataset.route); close() }
const openLogin = e.target.closest('[data-open-login]')
if(openLogin){ window.dispatchEvent(new CustomEvent('open-login')) }
})


// Buttons that depend on injected header
document.addEventListener('click', (e)=>{
if(e.target.closest('#balanceBtn')){
window.dispatchEvent(new CustomEvent('open-balance'))
}
if(e.target.closest('#profileBtn')){
window.dispatchEvent(new CustomEvent('open-profile'))
}
})
</script>