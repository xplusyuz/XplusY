// Firebase konfiguratsiyasi
const firebaseConfig = {
    apiKey: "AIzaSyADOv69HBuAJkaYs2Ukgab-VgqkJIv1Cro",
  authDomain: "orzumall.firebaseapp.com",
  projectId: "orzumall",
  storageBucket: "orzumall.firebasestorage.app",
  messagingSenderId: "873732887270",
  appId: "1:873732887270:web:15b73dbb37f4fdabe8a127",
  measurementId: "G-2LEH8YWPLF"
};

// Firebase ni initialize qilish
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();