# CSV Testlar — balansdan yechish (Firebase)

Bu paket CSV asosidagi test tizimi bo‘lib, pullik testni boshlashdan oldin **Firebase Firestore’dagi balans**dan yechadi.
Hech qanday Payme/CLICK kerak emas — faqat foydalanuvchi akkaunti va `users/{uid}.balance` maydoni.

## Tez start
1) ZIP’ni hostga joylang (Netlify yoki Firebase Hosting). `tests.html` ni oching.
2) Google orqali kiring (birinchi marta kirganda demo uchun `balance: 50000` yozib beriladi).
3) “DEMO 10 savol (balansdan)” kartasida **Sotib olish** → tranzaksiya → balansdan yechiladi → **Boshlash**.

## Firestore kolleksiyalar
- `users/{uid}`: `{ name, email, balance: number, gems, createdAt, lastPurchase }`
- `users/{uid}/tickets/{testId}`: `{ testId, price, at }` — xarid dalili

## Xavfsizlik (muhim)
Ushbu repo **demo** uchun yozilgan. Firestore rules faylida foydalanuvchiga faqat **balansni kamaytirish** ruxsat berilgan.
Ammo `tickets` hujjatini ham foydalanuvchi o‘zi yarata oladi — bu soddalashtirilgan rejim.
**Tavsiya etiladi**: balans yechimi va ticket chiqarishni **Cloud Function** orqali bajarish (rules’da to‘liq write’larni yopish).

Minimal tavsiya (prod):
- `match /users/{uid}` → `allow update: if false` (faqat Cloud Function o‘zgartiradi)
- `match /users/{uid}/tickets/{testId}` → `allow create: if false` (faqat Cloud Function yaratsin)

Keyin Frontend’da `buyTest()` o‘rniga Callable Function (`purchaseTest`) chaqirasiz.

## CSV formatlari
- `csv/tests.csv`: manifest
- `csv/packs/*.csv`: test paketlari
  - `type=meta` qatori: `neg_easy, neg_med, neg_hard, m_easy, m_med, m_hard, shuffle, duration_min`
  - `type=q` qatori: `qid, text, A, B, C, D, correct (A|B|...), difficulty (easy|medium|hard), topic, explain`

## Eslatma
- Demo balans: 50 000 so‘m (birinchi kirishda yaratib beradi). O‘chirib qo‘yish uchun `ensureUserDoc`dagi qiymatni o‘zgartiring.
