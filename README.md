# LeaderMath.uz — API-only (Netlify Functions + MongoDB)

Bu loyiha **SDKsiz** ishlaydi: frontend faqat `fetch()` bilan Netlify Function API ga murojaat qiladi.

## 1) Kerakli narsalar
- Node.js 18+
- Netlify CLI (`npm i -g netlify-cli`)
- MongoDB Atlas (yoki boshqa Mongo) URI

## 2) Sozlash
Netlify dashboard yoki `.env` orqali:
- `MONGODB_URI` = Mongo connection string
- (ixtiyoriy) `ADMIN_TOKEN` = admin endpointlar uchun token

Netlify local dev:
```bash
npm i
netlify dev
```

Sayt: `http://localhost:8888`

## 3) API
Base: `/.netlify/functions/api`

Auth:
- `POST /auth/register`  -> auto 6 xonali ID + random parol, session yaratadi
- `POST /auth/login`     -> ID+parol, session qaytaradi
- `GET  /auth/session/:sid` -> session tekshiradi, user qaytaradi
- `POST /auth/password`  -> session bilan parol yangilash

User:
- `GET  /user/:id`       -> session bilan o'z profilini ko'rish
- `PATCH /user/:id`      -> session bilan o'z profilini yangilash
- `POST /user/:id/avatar`-> base64 avatar saqlash

Public:
- `GET /content/home`    -> banner + cardlar (frontend dinamika)
- `GET /ranking`         -> reyting uchun public list

## 4) MongoDB indekslar (tavsiya)
Mongo shell yoki Atlas UI:
- `sessions.expiresAt` uchun TTL index: expireAfterSeconds=0
- `users.loginId` unique index

