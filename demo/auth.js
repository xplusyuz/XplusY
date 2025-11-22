// ========== Firebase init ==========
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db   = firebase.firestore();

window.auth = auth;
window.db   = db;

// ====== Helperlar ======
function loginIdToEmail(id){
  return `${id}@imi-portal.local`; // texnik email
}

function generatePassword(len = 8){
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  return Array.from({length:len},()=>chars[Math.floor(Math.random()*chars.length)]).join("");
}

async function generateUniqueId(){
  while(true){
    const id = String(100000 + Math.floor(Math.random()*900000));
    const snap = await db.collection("users").where("loginId","==",id).get();
    if (snap.empty) return id;
  }
}

function showCred(id, pass){
  const box = document.getElementById("auth-generated-credentials");
  box.style.display="block";
  box.innerHTML = `
    <div class="auth-cred-title">ID va Parol yaratildi</div>
    <div>ID: <code>${id}</code></div>
    <div>Parol: <code>${pass}</code></div>
    <div class='auth-cred-note'>
      Ushbu ID + Parolni yozib oling yoki screenshot oling — keyin o‘zgarmaydi!
    </div>
  `;
  alert(`ID: ${id}\nParol: ${pass}\n\nAlbatta yozib oling — qayta ko‘rsatilmaydi!`);
}
