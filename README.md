# MathCenter Full v3 — Starter

**Xususiyatlar**
- Modular header/footer + overlay menyu (hamma sahifada ishlaydi)
- Light/Dark (kun/tun) rejimi
- Google Auth — kirish majburiyligi
- Profil to‘ldirish majburiyati (ism, familiya, DOB)
- Balans & 💎 gems, headerda ko‘rinadi
- Admin sahifa (numericId==100 yoki role='admin')
- Live musobaqa: pre-join (balansdan yechish), boshlanish vaqti, CRUD (admin)
- Reyting: Top‑100 by gems
- Firestore rules shabloni (gems ±100 limit, numericId bir marta)

**O‘rnatish**
1) `/js/firebase.js` ichiga Firebase Config’ingizni joylang.
2) Firebase Console → Authentication → Authorized domains ichiga netlify domainingizni qo‘shing.
3) Firestore → Rules bo‘limiga `firebase.rules` ni qo‘ying va Deploy qiling.
4) `counters/users` hujjatini qo‘lda yarating: `{ next: 100000 }` (ixtiyoriy, tranzaksiya o‘zi ham yaratadi).
5) Admin uchun: `users/{uid}` ichida `role: "admin"` yoki `numericId: 100` qilib qo‘ying.

**Ishga tushirish**
- Netlify'ga butun papkani yuklang (root’da `index.html` bor).
- Barcha sahifalar root’da (`/live.html`, `/admin.html`, ...). Partials `/partials` dan fetch qilinadi.

**Eslatma**
Bu starter — ishlaydigan bazaviy loyiha. Test dvijok, to‘lov integratsiyasi va real-time ishtirokchilar ro‘yxati kabi chuqur qismlar keyingi bosqich.
