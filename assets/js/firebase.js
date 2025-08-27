<script>
}


async function createUserIfMissing(user){
const uref = doc(db, 'users', user.uid);
const snap = await getDoc(uref);
if(!snap.exists()){
const metaRef = doc(db, 'meta', 'counters');
await ensureCounter();
const id = await runTransaction(db, async (t)=>{
const m = await t.get(metaRef);
let next = (m.exists()? m.data().nextUserId : 100001) || 100001;
t.update(metaRef, { nextUserId: next + 1 });
return next;
});
await setDoc(uref, {
uid: user.uid,
id: id,
email: user.email || '',
displayName: user.displayName || 'Foydalanuvchi',
photoURL: user.photoURL || '',
balance: 0,
score: 0,
created_at: serverTimestamp(),
last_login: serverTimestamp()
});
return { id, balance:0, score:0 };
} else {
await updateDoc(uref, { last_login: serverTimestamp() });
const d = snap.data();
return { id: d.id, balance: d.balance||0, score: d.score||0 };
}
}


async function signInGoogle(){
const res = await signInWithPopup(auth, gProvider);
return res.user;
}


async function signInEmail(email, password){
const { user } = await signInWithEmailAndPassword(auth, email, password);
return user;
}


async function registerEmail(name, email, password){
const { user } = await createUserWithEmailAndPassword(auth, email, password);
if(name) await updateProfile(user, { displayName:name });
return user;
}


async function signOutUser(){ await signOut(auth); }


// Balance / Score atomic adjust
async function adjustBalanceScore(uid, deltaBalance=0, deltaScore=0){
const uref = doc(db, 'users', uid);
await runTransaction(db, async (t)=>{
const snap = await t.get(uref);
if(!snap.exists()) throw new Error('User doc not found');
const d = snap.data();
const nb = (d.balance||0) + deltaBalance;
const ns = (d.score||0) + deltaScore;
if(nb < 0) throw new Error('Balans yetarli emas');
t.update(uref, { balance: nb, score: ns });
});
}


// Export to window for app.js
window.XPY = { app, auth, db, onAuthStateChanged, createUserIfMissing, signInGoogle, signInEmail, registerEmail, signOutUser, adjustBalanceScore };
</script>