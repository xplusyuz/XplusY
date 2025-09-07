
MathCenter v4 — Clean Rebuild (0 → 100%)
========================================
Sana: 2025-09-07

Asosiy sahifalar:
- index.html — Bosh sahifa
- tests.html (+ js/tests.js) — Oson/O‘rta/Qiyin testlar (10 savol)
- live.html (+ js/live.js) — Live: pre-join, start lock, scoreboard
- leaderboard.html (+ js/leaderboard.js) — Top-100 olmos
- settings.html (+ js/settings.js) — Profil, Natijalar, Balans (demo), Yutuqlar, Promo, Admin panel

UI/UX:
- **Header/Footer** — har bir sahifada INLINE, JS ga bog‘liq emas.
- **Desktop**: yuqori top nav; **mobile/planshet**: pastda yopishqoq bottom bar (Android uslubida).
- **Kun/Tun** rejim (localStorage bilan saqlanadi).
- Modallar — profil/adm/va boshqalar; light theme’da to‘g‘ri kontrast.

Admin:
- Faqat `numericId ∈ {1000001, 1000002}` + UI kodi `Math@1999`.
- Admin panelda: **numericId**, **balance**, **gems** va boshqa maydonlar tahriri.
- Firestore rules: admin tekshiruvi son **yoki** matn ko‘rinishida.

Deploy:
- Statik hosting (Netlify/Vercel). Barcha yo‘llar nisbiy (`./js/...`) qilib qo‘yilgan.
- `firestore.rules` faylini Firestore’ga deploy qiling.
