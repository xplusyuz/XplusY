# LeaderMath.uz — Netlify + Firebase (Admin SDK) API

## 1) Firebase tayyorlash
1. Firebase Console → Project yarating.
2. Firestore Database → (Production mode) yoqing.
3. Storage → Enable qiling.
4. Project settings → Service accounts → **Generate new private key** → JSON fayl.

## 2) Netlify Environment Variables
Netlify → Site settings → Environment variables:
- FIREBASE_SERVICE_ACCOUNT_JSON = (service account JSON ni to'liq string ko'rinishida)
- FIREBASE_STORAGE_BUCKET = your-project-id.appspot.com   (ixtiyoriy, bo'lmasa avtomatik)
- JWT_SECRET = (random uzun secret)

## 3) Local ishlatish (ixtiyoriy)
- `npm i`
- `netlify dev`

## 4) DB kolleksiyalar
- users (doc id = LM-XXXXXX)
- content_cards (admin panel qo'shganda to'ldirasiz)

## 5) Frontend
Frontend `index.html` -> `/.netlify/functions/api` orqali ishlaydi:
- POST /auth/register
- POST /auth/login
- GET /content/cards
- PUT /me/profile

Eslatma: Avatar upload funksiyada base64 orqali Storage'ga saqlanadi.
