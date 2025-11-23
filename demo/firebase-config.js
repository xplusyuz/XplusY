// Firebase config - bu yerga o'zingizning project ma'lumotlaringizni qo'ying
// Konsoldan (Project settings -> General -> SDK snippet -> Config) olingan ma'lumotlar:
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Tizim bo'ylab ishlatilishi uchun global
window.db = db;
