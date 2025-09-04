
ExamHouse v8.0 (header/menu/footer components + cards)

Ishga tushirish:
1) Rootda host qiling — index.html ni oching. (Agar subpapkada bo‘lsa, index va sahifalardagi <base href="/"> ni masalan <base href="/examhouse/"> ga almashtiring.)
2) Testlar ro‘yxatini assets/js/tests.js ichida o‘zgartiring.
   - startAt Asia/Tashkent bo‘yicha ISO: 2025-10-04T20:00:00+05:00
   - Taymer 5 daqiqa oldin “Boshlash” tugmasini ko‘rsatadi.

Fayl tuzilmasi:
- components/header.html, menu.html, footer.html — sahifalarda slotlarga yuklanadi.
- assets/js/app.js — komponentlarni fetch qiladi va menyuni bog‘laydi.
- assets/js/ads.js + assets/js/tests.js — reklama grid cardlari va taymer.
- pages/* — bo‘sh sahifalar (keyin to‘ldirasiz).

© 2025 ExamHouse.uz
