// Firebase init (clean)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signInWithRedirect, getRedirectResult, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, serverTimestamp, runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export const firebaseConfig = {
  apiKey: "AIzaSyDYwHJou_9GqHZcf8XxtTByC51Z8un8rrM",
  authDomain: "xplusy-760fa.firebaseapp.com",
  projectId: "xplusy-760fa",
  storageBucket: "xplusy-760fa.appspot.com",
  messagingSenderId: "992512966017",
  appId: "1:992512966017:web:5e919dbc9b8d8abcb43c80",
  measurementId: "G-459PLJ7P7L"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

export async function ensureNumericIdAndProfile(user) {
  const userRef = doc(db, "users", user.uid);
  const countersRef = doc(db, "counters", "users");
  await runTransaction(db, async (tx) => {
    const uSnap = await tx.get(userRef);
    if (!uSnap.exists()) {
      const cSnap = await tx.get(countersRef);
      let nextId = 1000001;
      if (cSnap.exists()) nextId = (cSnap.data().lastAssigned || 1000000) + 1;
      tx.set(countersRef, { lastAssigned: nextId, updatedAt: serverTimestamp() }, { merge: true });
      tx.set(userRef, {
        uid: user.uid,
        email: user.email || "",
        displayName: user.displayName || "",
        numericId: nextId,
        balance: 0,
        gems: 0,
        profileComplete: false,
        firstName: "", lastName: "", middleName: "",
        birthDate: "", address: "", phone: "",
        isTeacher: false, isAdmin: false,
        createdAt: serverTimestamp(), updatedAt: serverTimestamp()
      }, { merge: true });
    }
  });
  return (await getDoc(userRef)).data();
}

export async function updateProfileLocked(uid, data) {
  const userRef = doc(db, "users", uid);
  await updateDoc(userRef, { ...data, updatedAt: serverTimestamp() });
}

export {
  signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signInWithRedirect, getRedirectResult, signOut
};
