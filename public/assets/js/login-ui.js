function showLoginError(msg){const el=document.getElementById('loginErr'); if(el){el.textContent=msg||'Xatolik'; el.classList.add('show');}}
function clearLoginError(){const el=document.getElementById('loginErr'); if(el){el.textContent=''; el.classList.remove('show');}}
