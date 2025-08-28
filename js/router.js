<script type="module">
</div>
<div class="rounded-3xl p-6 border border-white/20 dark:border-white/5 bg-white/70 dark:bg-slate-900/60">
<div class="grid grid-cols-2 gap-3 text-center">
<div class="stat"><div class="stat-label">X-ID</div><div class="stat-value" data-user-xid>-</div></div>
<div class="stat"><div class="stat-label">Ball</div><div class="stat-value" data-user-points>0</div></div>
</div>
</div>
</section>
`,
tests: () => protectedPage('Testlar', `
<div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
${card('Algebra 1','Boshlang\'ich testlar','tests/algebra1')}
${card('Geometriya','Burchaklar va shakllar','tests/geometry')}
${card('Trigonometriya','Sin, Cos, Tan','tests/trig')}
</div>
`),
courses: () => protectedPage('Kurslar', gridList(['Asosiy arifmetika','Algebra 1','Algebra 2','Analiz kirish'])),
simulator: () => protectedPage('Simulyator', gridList(["Hisoblash mashqi","Grafik chizish","Matnli masalalar"])),
games: () => protectedPage("O'yinlar", gridList(['Math Rush','Factor Frenzy','Prime Hunter'])),
library: () => protectedPage('Kutubxona', gridList(['Formula to\'plami','Masalalar to\'plami','Nazariy ma\'lumotlar'])),
}


function card(title, desc, href){
return `<a class="block p-4 rounded-2xl border border-white/20 dark:border-white/5 hover:border-primary-400/60 hover:shadow-lg transition" href="#" onclick="event.preventDefault()">
<div class="font-bold">${title}</div>
<div class="opacity-70 text-sm">${desc}</div>
</a>`
}
function gridList(items){
return `<div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">${items.map(i=>`<div class='p-4 rounded-2xl border border-white/20 dark:border-white/5'>${i}</div>`).join('')}</div>`
}
function protectedPage(title, content){
// Guard: if not logged in, trigger login and keep home
if(!window.__xplusy?.auth?.currentUser){
window.dispatchEvent(new CustomEvent('open-login'))
return pages.home()
}
return `
<header class="mb-4">
<h2 class="text-2xl font-bold">${title}</h2>
</header>
${content}
`
}


function render(route){
app.innerHTML = pages[route]?.() || pages.home()
window.dispatchEvent(new CustomEvent('route-change', { detail: route }))
}
function goto(route){ location.hash = `#${route}` }
function parse(){ return (location.hash || '#home').replace('#','') }
window.addEventListener('hashchange', ()=> render(parse()))
window.router = { goto }
render(parse())
</script>