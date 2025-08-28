<script type="module">
  import { doc, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js'
  const { auth, db } = window.__xplusy

  // Live sync of balance & points to header and any elements with data-user-* attributes
  let unsub = null
  function subscribe(){
    if(unsub) unsub()
    if(!auth.currentUser) return
    const ref = doc(db, 'users', auth.currentUser.uid)
    unsub = onSnapshot(ref, (snap)=>{
      const data = snap.data() || {}
      const balEl = document.getElementById('balanceValue'); if(balEl) balEl.textContent = (data.balance||0).toLocaleString('uz-UZ')
      document.querySelectorAll('[data-user-points]').forEach(el=> el.textContent = data.points || 0)
      document.querySelectorAll('[data-user-xid]').forEach(el=> el.textContent = data.xid || '-')
    })
  }

  window.addEventListener('load', subscribe)
  window.__xplusy_subscribeUser = subscribe
</script>