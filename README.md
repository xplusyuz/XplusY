# LeaderMath demo (Netlify + Firebase Admin)

## 1) Local test (frontend only)
- Open index.html with a static server (VSCode Live Server recommended).
- API calls require Netlify functions, so login/signup works only after deploying / running netlify dev.

## 2) Netlify deploy
- Set environment variables:
  - JWT_SECRET
  - FIREBASE_SERVICE_ACCOUNT_BASE64 (base64 of serviceAccount.json)
- Firestore collections:
  - users (doc id = loginId)
  - meta/counters (doc id = 'counters' with field nextLoginId number)
