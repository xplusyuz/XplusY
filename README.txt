MathCenter Full v3 (tests + live + real-time v2) — Starter
==================================================================
Sana: 2025-09-07

Struktura:
- /index.html — Bosh sahifa (grid kartalar).
- /tests.html + /js/tests.js — Oson/O‘rta/Qiyin testlar (10 savol, +/− ball, chiqish jarimasi).
- /live.html + /js/live.js — Live xonalar: pre-join, start lock, real-time scoreboard (admin boshqaruvi).
- /leaderboard.html + /js/leaderboard.js — Top-100 olmos reyting.
- /settings.html + /js/settings.js — Profil, Natijalar, Balans, Yutuqlar, Promo, Admin panel.
- /header.html, /footer.html — barcha sahifalarga dinamik yuklanadi.
- /css/base.css — umumiy dizayn: mobil-first, green theme.
- /assets/logo.svg — favicon/brand.
- /firestore.rules — xavfsizlik.

Firebase:
- `users/{uid}` — profil (numericId, balance, gems ...). numericId: admin (1000001/1000002).
- `users/{uid}/results` — test natijalari.
- `promoCodes/{code}` — promo (active, balance, gems, expiresAt).
- `liveRooms/{roomId}` — xona (status, startAt, duration, joinLocked, ...).
- `liveRooms/{roomId}/participants/{uid}` — ishtirokchi (score, joinedAt, ...).

Kirish talabi:
- Har sahifa `attachAuthUI({ requireSignIn: true })` bilan himoyalangan.
- Header’da ID, 💵 balans, 💎 olmos doim ko‘rinadi.

Admin (faqat numericId ∈ {1000001, 1000002}):
- Live xonalarni yaratish/start/end.
- Settings → Admin panel: foydalanuvchilarni qidirish/tahrirlash.
- Kirish kodi (front-end): Math@1999 (faqat UI gate). Haqiqiy ruxsat — Firestore rules.

To‘lov:
- Balans to‘ldirish hozircha “demo”. Haqiqiy to‘lov uchun backend/payments (Payme/Click/Xazna) kerak.

Deploy:
- Statik hosting (Netlify/Vercel). Katalogning ildiziga joylab, URLlar “/..” ishlaydi.
- Agar subpathda bo‘lsa, header/footer fetch yo‘llarini moslang.

Eslatma:
- Test savollari demo tarzda generatsiya qilinadi. Haqiqiy savollarni Firestore’dan o‘qish uchun `tests` kolleksiyasini qo‘shish mumkin.
- “Ko‘p marta chiqish jarimasi” localStorage orqali hisoblanadi (sodda demo mantiq).
- Xavfsizlik qoidalari balans/gems’ni faqat admin o‘zgartiradigan qilib yozilgan.

Yaxshilash mumkin:
- Cloud Functions orqali to‘lov/purchase tranzaksiyalari.
- Testlar uchun rasm/formula renderer (MathJax/KaTeX).
- Live uchun savol tarqatish va avtomatik ball berish.
