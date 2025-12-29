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
