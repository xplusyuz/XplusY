(function(){
const STORAGE_KEY = "xplusy-theme";
const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');


function applyTheme(theme){
document.documentElement.setAttribute('data-theme', theme);
try{ localStorage.setItem(STORAGE_KEY, theme); }catch{}
}


function getSaved(){
try{ return localStorage.getItem(STORAGE_KEY); }catch{ return null }
}


// init
const saved = getSaved();
if(saved){ applyTheme(saved); }
else if(prefersDark && prefersDark.matches){ applyTheme('dark'); }
else { applyTheme('light'); }


// react to OS change
if(prefersDark){
prefersDark.addEventListener('change', e => {
const saved = getSaved();
if(!saved){ applyTheme(e.matches ? 'dark' : 'light'); }
});
}


// expose toggle globally
window.toggleTheme = function(){
const now = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
applyTheme(now);
}
})();