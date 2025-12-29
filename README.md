# LeaderMath.UZ — Netlify API + Firebase Admin (NO firebase-config.js)

## Netlify Environment Variables
- FIREBASE_SERVICE_ACCOUNT_BASE64 = base64(JSON service account)
- JWT_SECRET = uzun random secret

## Firestore
Collections:
- users/{loginId}
- meta/counters (doc)

## Local dev
npm i -g netlify-cli
npm install
netlify dev


## Admin (Google) — sohibjonmath@gmail.com
Admin panel: /admin.html

1) Firebase Console -> Project Settings -> General -> Web app config
2) Paste config into: public/assets/js/firebase-web-config.js
3) Enable Firebase Authentication -> Sign-in method -> Google
4) Deploy to Netlify. Open /admin.html and login with sohibjonmath@gmail.com

### Admin verification (server)
Netlify function accepts either:
- LeaderMath custom JWT token with admin role/loginId
- OR Firebase Auth ID token (Google). Only sohibjonmath@gmail.com is allowed.

## Firestore Security Rules
See firestore.rules (admin-only).
