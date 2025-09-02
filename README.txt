
ExamHouse.uz — v2
-----------------
• **ID ko'rinmayapdi** muammosi hal: skriptlar endi **sahifalarning o'zida** yuklanadi (header ichidagi script ishlamasligi muammosi yo'q).
• **SVG logo** va **favicon** qo'shildi.
• Har bir menyu bo'limi uchun alohida sahifalar tayyor.
• Google kirish va Email/Parol modallari oq matnli.

Ishga tushirish:
1) Statik hostingga qo'ying (Netlify/Vercel yoki `npx serve`).
2) Firebase Auth ➜ Authorized domains ga domeningizni qo'shing.
3) Firestore Rules: `firestore.rules` faylini qo'ying.
4) (Ixtiyoriy) `meta/counters` hujjatiga `lastUserId: 100000` qo'ying.

Fayllar:
- /assets/svg/examhouse-logo.svg — brend logotip
- /assets/favicon.svg — favicon
- /components/header.html, /components/menu.html, /components/footer.html
- /assets/js/firebase.js, /assets/js/auth.js, /assets/js/app.js
- /pages/* — barcha bo'lim sahifalari
