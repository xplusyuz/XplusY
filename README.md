# XplusY — SPA (MathCenter Full v3 baseline)

- Mobil‑first, oq + yashil gradient, 3D chiplar
- Hash‑router (`#/route`) — sahifalar `partials/*.html`
- Har sahifaning JS'i `js/views/*.js`
- CSV drayv: `csv/*.csv` (home va tests)
- Firebase v10 (Auth, Firestore, Storage) modul sintaksis
- NumericId avtomatik: `meta/app.nextNumericId` dan transaktsiya orqali
- Adminlar: `numericId ∈ {1000001, 1000002}` — Admin menyu ko‘rinadi
- Balans to‘ldirish: linklar + chekni Storage’ga yuklash, admin tasdiqlash
- Reyting: `users` ni `gems desc` bo‘yicha Top 100

## Tez start (mahalliy fayl server bilan)

1) `js/firebase-config.json` faylini haqiqiy konfiguratsiya bilan to‘ldiring.
2) Firestore’da `meta/app` hujjatiga `{ "nextNumericId": 1000001 }` qo‘ying (bir marta).
3) Firestore Rules sifatida `firestore.rules` dan foydalaning.
4) Oddiy server orqali ishga tushiring (masalan `npx serve .`).
5) Brauzerda `#/home`, `#/tests`, ... yo‘llarni tekshiring.

> Eslatma: Auth dialog faqat index.htmlga tegishli. Partials hech qachon Auth modalni o‘zgartirmaydi.

Yaratilgan: 2025-09-18T15:25:34.767431Z
