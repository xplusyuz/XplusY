import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-storage.js";

// ⚠️ Firebase Console → Project settings → Your apps → Web app config'dan OLIB qo'ying.
export const firebaseConfig = {
   apiKey: "AIzaSyDYwHJou_9GqHZcf8XxtTByC51Z8un8rrM",
  authDomain: "xplusy-760fa.firebaseapp.com",
  databaseURL: "https://xplusy-760fa-default-rtdb.firebaseio.com",
  projectId: "xplusy-760fa",
  storageBucket: "xplusy-760fa.firebasestorage.app",
  messagingSenderId: "992512966017",
  appId: "1:992512966017:web:5e919dbc9b8d8abcb43c80",
  measurementId: "G-459PLJ7P7L"
};

function looksPlaceholder(v){
  return !v || String(v).includes("YOUR_");
}
if (looksPlaceholder(firebaseConfig.apiKey) || looksPlaceholder(firebaseConfig.projectId)) {
  alert("Firebase Web config to'ldirilmagan! public/firebase-config.js ichidagi apiKey/authDomain/projectId/appId ni o'zingiznikiga almashtiring.");
}

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

await setPersistence(auth, browserLocalPersistence);

export const db = getFirestore(app);
export const storage = getStorage(app);
