<script type="module">
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js'
import { getAuth, GoogleAuthProvider } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js'
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js'


// Your provided config
const firebaseConfig = {
apiKey: "AIzaSyDYwHJou_9GqHZcf8XxtTByC51Z8un8rrM",
authDomain: "xplusy-760fa.firebaseapp.com",
projectId: "xplusy-760fa",
storageBucket: "xplusy-760fa.firebasestorage.app",
messagingSenderId: "992512966017",
appId: "1:992512966017:web:5e919dbc9b8d8abcb43c80",
measurementId: "G-459PLJ7P7L"
}


const app = initializeApp(firebaseConfig)
const auth = getAuth(app)
auth.languageCode = 'uz'
const provider = new GoogleAuthProvider()
const db = getFirestore(app)


// Expose singletons to window for other modules
window.__xplusy = { app, auth, provider, db }
</script>