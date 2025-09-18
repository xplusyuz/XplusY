XplusY — To'liq Firebase SPA
--------------------------------
Sana: 2025-09-18

Ishga tushirish:
1) Hostingga (Netlify/Vercel/Nginx) qo'ying. SPA uchun `_redirects` bor.
2) Firebase Console:
   - Authentication → Google: ON
   - Firestore → Rules: `firebase.rules` faylini qo'ying
   - Storage → Rules: `storage.rules` faylini qo'ying
3) Admin:
   - `users/{uid}` hujjatda `numericId` ni 1000001 yoki 1000002 qiling (Admin uchun).

Funksiyalar: Google kirish, numericId auto, CSV kartalar, Live lobby, Reyting (Top-100),
Balans (chek upload + promo-kod), Admin (topup approve / +gems / +balance).

Fayl tuzilmasi: js/firebase-config.js siz bergan real config bilan.
