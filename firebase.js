// firebase.js
// Firebase konfiguratsiya
const firebaseConfig = {
      apiKey: "AIzaSyDYwHJou_9GqHZcf8XxtTByC51Z8un8rrM",
      authDomain: "xplusy-760fa.firebaseapp.com",
      projectId: "xplusy-760fa",
      storageBucket: "xplusy-760fa.firebasestorage.app",
      messagingSenderId: "992512966017",
      appId: "1:992512966017:web:5e919dbc9b8d8abcb43c80",
      measurementId: "G-459PLJ7P7L"
    };

// Firebase init
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Auth guard
auth.onAuthStateChanged(user => {
  if (user) {
    console.log("Kirdi:", user.email);
    document.body.classList.remove("unauthorized");
    document.getElementById("authButtons").style.display = "none";
    document.getElementById("userProfile").style.display = "flex";
  } else {
    console.log("Kirmagan foydalanuvchi");
    document.body.classList.add("unauthorized");
    document.getElementById("authButtons").style.display = "flex";
    document.getElementById("userProfile").style.display = "none";

    // Barcha linklarni bloklash
    document.querySelectorAll("a").forEach(a => {
      if (!a.classList.contains("public-link")) {
        a.addEventListener("click", e => {
          e.preventDefault();
          alert("Avval tizimga kiring!");
        });
      }
    });
  }
});
