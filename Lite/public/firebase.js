<script type="module">
  import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
  import {
    getAuth, GoogleAuthProvider, signInWithPopup,
    onAuthStateChanged, signOut, setPersistence, browserLocalPersistence
  } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
  import {
    getFirestore, doc, getDoc, setDoc, collection, addDoc, serverTimestamp,
    query, where, getDocs, onSnapshot, orderBy, limit, runTransaction
  } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

  // >>> Replace with your real Firebase config <<<
  const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
  };

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const provider = new GoogleAuthProvider();
  await setPersistence(auth, browserLocalPersistence);

  async function ensureUserDoc(user) {
    const uref = doc(db, 'users', user.uid);
    const snap = await getDoc(uref);
    if (!snap.exists()) {
      await setDoc(uref, {
        displayName: user.displayName || "",
        email: user.email || "",
        photoURL: user.photoURL || "",
        role: "user",
        createdAt: serverTimestamp()
      }, { merge: true });
    }
    return (await getDoc(uref)).data();
  }

  async function signIn() {
    const res = await signInWithPopup(auth, provider);
    const profile = await ensureUserDoc(res.user);
    return { user: res.user, profile };
  }
  async function logOut(){ await signOut(auth); }

  window.fb = { app, auth, db, provider, signIn, logOut, onAuthStateChanged, getDoc, doc, setDoc,
    collection, addDoc, serverTimestamp, query, where, getDocs, onSnapshot, orderBy, limit, runTransaction };
</script>
