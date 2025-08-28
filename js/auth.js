<script type="module">
const prof = await (await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js')).getDoc(
(await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js')).doc(window.__xplusy.db,'users', auth.currentUser.uid)
)
profileModal(auth.currentUser, prof.data())
})
window.addEventListener('open-balance', ()=>{
if(!auth.currentUser){ loginModal(); return }
balanceModal()
})


// Events inside modals
document.addEventListener('click', async (e)=>{
if(e.target?.id === 'googleLogin'){
try{ await signInWithPopup(auth, provider) }catch(err){ alert(err.message) }
}
if(e.target?.id === 'emailLogin'){
const email = document.getElementById('email').value
const pass = document.getElementById('pass').value
try{ await signInWithEmailAndPassword(auth, email, pass) }catch(err){ alert(err.message) }
}
if(e.target?.id === 'emailSignup'){
const email = document.getElementById('email').value
const pass = document.getElementById('pass').value
try{ await createUserWithEmailAndPassword(auth, email, pass) }catch(err){ alert(err.message) }
}
if(e.target?.id === 'plusBalance'){
const amt = Number(document.getElementById('summa').value || 0)
if(amt <= 0) return alert('Iltimos, summani kiriting')
const { doc, updateDoc, increment } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js')
await updateDoc(doc(window.__xplusy.db, 'users', auth.currentUser.uid), { balance: increment(amt) })
close()
}
if(e.target?.id === 'logoutBtn'){
await signOut(auth); location.hash = '#home'
}
})


// Guarded routing: require auth for inner pages
function guard(route){
const open = ['home']
if(!auth.currentUser && !open.includes(route)){
loginModal(); return false
}
return true
}
window.addEventListener('route-change', (e)=>{
if(!guard(e.detail)) e.preventDefault()
})


// Auth state
onAuthStateChanged(auth, async (user)=>{
if(user){
const prof = await ensureProfile(user)
renderBalance(prof.balance)
} else {
renderBalance(0)
}
})
</script>