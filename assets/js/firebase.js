// Firebase init — REAL CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyDYwHJou_9GqHZcf8XxtTByC51Z8un8rrM",
  authDomain: "xplusy-760fa.firebaseapp.com",
  projectId: "xplusy-760fa",
  storageBucket: "xplusy-760fa.appspot.com",
  messagingSenderId: "992512966017",
  appId: "1:992512966017:web:5e919dbc9b8d8abcb43c80",
  measurementId: "G-459PLJ7P7L"
};

// Initialize (Compat)
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
try {
  // Analytics (if cookie consent & browser supports)
  firebase.analytics();
} catch (e) {
  console.warn('Analytics unavailable:', e?.message||e);
}

// Helpers exported globally
window.EXH = { auth, db };
