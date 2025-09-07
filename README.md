# MathCenter.uz — v2 (Purchases, Leaderboard, Teacher Panel)
- **Xarid oqimi**: Test kartasidan narx ko'rinadi → "Sotib olish" → balansdan yechiladi, har 1 000 so'm uchun **1 olmos** bonus.
- **Top-100 Reyting**: 💎 bo'yicha tartiblangan (Settings yoki Uy sahifasidan).
- **O'qituvchi paneli**: `users/{uid}.isTeacher = true` bo'lsa, o'z itemlarini yaratishi mumkin (`/users/{uid}/teacher_items`).

## Ishga tushirish
1) Statik hostingga qo'ying. 2) `firestore.rules`ni Firebase'ga joylab, Publish qiling.
3) `isTeacher` bayrog'ini console orqali qo'shing (kerak bo'lsa).

*Yaratilgan sana:* 2025-09-07
