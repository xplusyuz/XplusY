const firebaseConfig = {
  apiKey: "AIzaSyDYwHJou_9GqHZcf8XxtTByC51Z8un8rrM",
  authDomain: "xplusy-760fa.firebaseapp.com",
  projectId: "xplusy-760fa",
  storageBucket: "xplusy-760fa.firebasestorage.app",
  messagingSenderId: "992512966017",
  appId: "1:992512966017:web:5e919dbc9b8d8abcb43c80",
  measurementId: "G-459PLJ7P7L"
};
// 2) Firebase-ni ishga tushiramiz (faqat BIR MARTA)
firebase.initializeApp(firebaseConfig);

// 3) Boshqa skriptlar ishlatishi uchun GLOBAL qilib beramiz
window.auth = firebase.auth();
window.db   = firebase.firestore();