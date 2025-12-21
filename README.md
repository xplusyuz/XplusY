# LeaderMath — Firebase rulesiz (API-only) Platforma

Frontend Firebase SDK ishlatmaydi. Hamma narsa Netlify Function (Firebase Admin SDK) orqali ishlaydi.

## 1) Firestore rules
`firebase/firestore.rules` dagidek hammasini yopiq qiling: `allow read, write: if false;`

## 2) Service Account ENV
Firebase Console → Project settings → Service accounts → "Generate new private key"

Netlify → Site → Environment variables:
- FB_PROJECT_ID
- FB_CLIENT_EMAIL
- FB_PRIVATE_KEY (private_key ni qo'ying; kod `\n` ni `\n` ga aylantiradi)
Ixtiyoriy:
- SESSION_DAYS = 30
- ADMIN_TOKEN = (admin publish uchun)

## 3) Lokal
```bash
npm i
netlify dev
```
http://localhost:8888/login.html

## 4) API
Base: /.netlify/functions/api

Auth:
- POST /auth/register  -> auto 6 xonali ID + random parol + session
- POST /auth/login
- GET  /auth/me
- POST /auth/password
- POST /auth/logout

Content:
- GET  /content/home (public)
- POST /admin/content/home (admin; role=admin yoki X-Admin-Token)

User:
- GET/PATCH /user/me
- POST /user/me/avatar

Ranking:
- GET /ranking
