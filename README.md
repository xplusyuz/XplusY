# MathCenter.uz — SPA (partials-based)

- `index.html` — faqat shell; header/footer/menu fragmentlarini va `partials/*.html` sahifalarni ko'rsatadi.
- `css/style.css`, `css/menu.css` — global uslublar va drawer menyu.
- `js/app.js` — hash-router, fragmentlarni yuklash, header/footer/menu ni o'rnatish.
- `js/menu.js` — menyu havolalari, drawer ochish/yopish, active holat.
- `js/firebase.js` — Firebase init, Google auth, `users` hujjat, `numericId` avtomatik.
- `partials/*.html` — 10 ta sahifa namunasi.

## Ishga tushirish
1) `index.html` ni lokal serverda oching (VSCode Live Server, serve, http-server). Fayl protokoli bilan `fetch` ishlamaydi.
2) `js/firebase.js` ichidagi `firebaseConfig` ni o'zingizniki bilan almashtiring.
3) Firestore:
   - `users` kolleksiyasi
   - `meta/counters` hujjati (ixtiyoriy, `lastNumericId` avtomatik yaratiladi)
4) Auth tugmasi orqali Google bilan kirish — headerdagi ID/Balans/Olmos ko'rsatiladi (yangi foydalanuvchida 0,0).
