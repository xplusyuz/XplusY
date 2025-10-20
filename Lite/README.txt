LeaderMath — Firebase Admin + PWA (Full)
===============================================
Fayllar:
- index.html — PWA (Dark mode, dinamik chips, Firestore kontent o‘qish, Auth header, points helper)
- adminindex.html — Admin panel (Google Auth, role guard, Realtime listener, CRUD, Firestorega saqlash)
- index.json — Lokal fallback kontent
- manifest.webmanifest — PWA manifesti
- service-worker.js — oflayn kesh
- firestore.rules — Firestore xavfsizlik qoidalari
- icons/, img/ — ikonlar va bannerlar

O‘rnatish:
1) Firebase Console → Authentication → Google yoqing.
2) Firestore → `users` kolleksiyasi: admin bo‘ladigan foydalanuvchi uchun `role: "admin"` maydonini qo‘ying.
3) Firestore → Rules: shu repodagi `firestore.rules`ni qo‘ying (Publish).
4) Fayllarni HTTPS hostga yuklang (Netlify/GitHub Pages).

Ishlash tartibi:
- Foydalanuvchi Google bilan kiradi → `users/{uid}` avtomatik yaratiladi.
- `index.html` kontentni avval Firestoredan (`content/index` doc), bo‘lmasa lokal `index.json`dan o‘qiydi.
- Admin panel: real-time bilan `content/index`ni kuzatadi; CRUD qilib `Save` bosganda Firestorega yozadi (faqat `role="admin"`).
- Ball ++ misoli: brauzer konsolida `addPoints()` chaqirib ko‘rishingiz mumkin (prod uchun tugma qo‘shishingiz ham mumkin).

Eslatma: Firebase config siz bergan loyihaga moslab kiritilgan.
