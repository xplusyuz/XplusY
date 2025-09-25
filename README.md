# XplusY — To'liq statik sayt (Firebase compat)

## Ishga tushirish
1) Papkani hostingga joylang (Firebase Hosting, Netlify, Vercel static, nginx va h.k.).
2) `index.html` ichida Firebase compat SDK'lar ulanadi — hech qanday build shart emas.

## Firebase sozlamalari
- **Auth**: Google provider ON.
- **Firestore**: `firestore.rules` ni deploy qiling.
- **Functions**: `functions/index.js` ni deploy qiling (Node 18).
  - Callable: `setAdmin`, `redeemPromo`
  - HTTP: `paymentWebhook`

## Admin huquqi
- `setAdmin` callable orqali admin claim beriladi:
  - Admin foydalanuvchi (allaqachon admin) `setAdmin({ uid: '<user-uid>' })`ni chaqiradi.
- Admin claim bo‘lsa, sayt past-o‘ngida **Admin** tugmasi ko‘rinadi.

## Kolleksiya sxemalari
- `users/{uid}`: idNum, name, balance, points, region, district, createdAt, updatedAt
- `tests/{id}`: title, description, status (free|pro|new), type (online|oddiy), timerSec, questions[]
- `courses/{id}`: title, description, status, price, lessons[] (title, videoUrl, duration, source)
- `simulators/{id}`: title, description, status, price
- `results/{id}`: uid, testId, title, score, correctCount, wrongCount, timeSpentSec, takenAt, answers[]
- `promocodes/{CODE}`: code, discountPct, maxUses, usedCount, perUserOnce, expiresAt, createdAt, updatedAt
  - sub: `redemptions/{uid}`: uid, amount, discountPct, discount, redeemedAt
- `transactions/{id}`: uid, method, amount, currency, status, proofUrl, createdAt, confirmedAt, externalRef

## Bo'limlar
- **Home**: banner + tez kirish bloklari
- **Testlar**: Firestore’dan yuklash, filter/tag/search; test oynasi (timer + navigatsiya + natija saqlash)
- **Kurslar**: darslar ro'yxati + video player (YouTube/embed yoki MP4)
- **Simulyatorlar**: ro'yxat (keyin integratsiya qilinadi)
- **Profil**: Ism/ID/Balans/Ball, region/tuman va saqlash
- **Admin**: Test editor (stepper), Promo CRUD + Redeem tarix

## Promo redeem front-end
`index.html`da Firebase Functions compat ulangan. Inputdan kodni olib, callable `redeemPromo`ni chaqiring.

Omad! 🎉
