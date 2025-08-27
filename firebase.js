// Firebase config
const firebaseConfig = {
  apiKey: "API_KEY",
  authDomain: "PROJECT.firebaseapp.com",
  projectId: "PROJECT",
  storageBucket: "PROJECT.appspot.com",
  messagingSenderId: "SENDER_ID",
  appId: "APP_ID"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// 🔹 Yangi foydalanuvchi qo‘shish (ID tartib bilan)
async function addUser(userData) {
  const counterRef = db.collection("meta").doc("userCounter");
  const snap = await counterRef.get();

  let newId = 100001;
  if (snap.exists) {
    newId = snap.data().lastId + 1;
    await counterRef.update({ lastId: newId });
  } else {
    await counterRef.set({ lastId: newId });
  }

  await db.collection("users").doc(newId.toString()).set({
    id: newId,
    ...userData,
    balance: 0,
    points: 0,
    created_at: firebase.firestore.FieldValue.serverTimestamp()
  });

  return newId;
}

// 🔹 Foydalanuvchini olish
async function getUser(id) {
  const doc = await db.collection("users").doc(id.toString()).get();
  if (doc.exists) return doc.data();
  else return null;
}
