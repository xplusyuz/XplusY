
# ExamHouse.uz Starter

- Dark + to'q yashil tema
- Panel menyu (har bir sahifada ishlaydi): header, menu, footer `components/*.html` dan dinamik yuklanadi
- Firebase Auth (Email/Parol + Google), Firestore profil va ID (100001, 100002 ...)
- Kirish/ro'yxatdan o'tish modallaridagi matnlar oq rangda

## Ishga tushirish (Netlify/Vercel/static server)
1) Loyihani statik serverda servis qiling (masalan `npx serve` yoki Netlify).
2) Firebase Console ➜ Firestore ➜ `meta/counters` hujjatini yarating (ixtiyoriy), agar bo'lmasa kod 100000 dan boshlab yaratadi.
3) Firestore Rules: `firestore.rules` faylini konsolga qo'ying.
4) `pages/profil.html` va `pages/balans.html` sahifalari kirishni talab qiladi (auth modal ochiladi).

## Tuzilma
- `components/header.html` — brend, kirish/ro'yxatdan o'tish, Google tugmasi.
- `components/menu.html` — panel menyu (Salom!, name + ball + unvon, bo'limlar).
- `components/footer.html` — pastki qism.
- `assets/js/firebase.js` — Firebase init.
- `assets/js/auth.js` — Auth logika, ID va profil.
- `assets/js/app.js` — Layout yuklash, menyu toggle, active link.
- `assets/css/style.css` — Tema va UI.

