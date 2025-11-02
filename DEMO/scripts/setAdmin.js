// scripts/setAdmin.js
// Usage: GOOGLE_APPLICATION_CREDENTIALS=serviceAccount.json node scripts/setAdmin.js user@example.com
const admin = require('firebase-admin');
const email = process.argv[2];
if(!email){ console.error('Pass user email'); process.exit(1); }
admin.initializeApp({ credential: admin.credential.applicationDefault() });
(async ()=>{
  const list = await admin.auth().getUserByEmail(email);
  await admin.auth().setCustomUserClaims(list.uid, { admin: true });
  console.log('Admin claim set for', email, 'uid=', list.uid);
})();