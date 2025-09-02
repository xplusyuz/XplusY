// Firebase init — fill with your real config
// 1) Firebase Console -> Web app -> SDK snippet (Compat)
// 2) Replace the EXAMHOUSE_*** placeholders below
const firebaseConfig = {
  apiKey: "EXAMHOUSE_API_KEY",
  authDomain: "EXAMHOUSE_PROJECT.firebaseapp.com",
  projectId: "EXAMHOUSE_PROJECT",
  storageBucket: "EXAMHOUSE_PROJECT.appspot.com",
  messagingSenderId: "EXAMHOUSE_SENDER_ID",
  appId: "EXAMHOUSE_APP_ID",
};

// Initialize
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Helpers exported globally
window.EXH = { auth, db };
