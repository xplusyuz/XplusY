// Firebase init (CDN ESM)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, onSnapshot, serverTimestamp, increment, runTransaction, collection, query, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Provided Firebase config
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

// Allocate numericId sequentially (100001..). Requires meta/counters.nextUserId initialized in Firestore.
export const ensureUserDoc = async (user) => {
  const userRef = doc(db, "users", user.uid);
  await runTransaction(db, async (tx) => {
    const uSnap = await tx.get(userRef);
    if(uSnap.exists() && uSnap.data().numericId){ return; }
    const ctrRef = doc(db, "meta", "counters");
    const ctrSnap = await tx.get(ctrRef);
    const start = 100001;
    let next = start;
    if(ctrSnap.exists() && Number.isInteger(ctrSnap.data().nextUserId)){ next = ctrSnap.data().nextUserId; }
    if(!uSnap.exists()){
      tx.set(userRef, {
        uid: user.uid,
        displayName: user.displayName || (user.email ? user.email.split("@")[0] : "User"),
        balance: 0, points: 0, numericId: next, createdAt: serverTimestamp()
      });
    }else{
      tx.update(userRef, { numericId: next });
    }
    tx.set(ctrRef, { nextUserId: next + 1 }, { merge: true });
  });
  return userRef;
};

export {
  onAuthStateChanged, signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, updateProfile, doc, getDoc, setDoc, updateDoc, onSnapshot, serverTimestamp, increment,
  collection, query, orderBy, limit, getDocs
};
