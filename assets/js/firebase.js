// Firebase init — fill with your real config
// 1) Firebase Console -> Web app -> SDK snippet (Compat)
// 2) Replace the EXAMHOUSE_*** placeholders below
const firebaseConfig = {
  apiKey: "AIzaSyDYwHJou_9GqHZcf8XxtTByC51Z8un8rrM",
  authDomain: "xplusy-760fa.firebaseapp.com",
  projectId: "xplusy-760fa",
  storageBucket: "xplusy-760fa.appspot.com",
  messagingSenderId: "992512966017",
  appId: "1:992512966017:web:5e919dbc9b8d8abcb43c80",
  measurementId: "G-459PLJ7P7L"
};

// Initialize
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Helpers exported globally
window.EXH = { auth, db };
