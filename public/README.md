# OrzuMall Admin Panel (Firestore)

Siz yuborgan admin HTML g'oyasini real Firebase Firestore bilan ishlaydigan admin panelga aylantirdim:
- products kolleksiyasi CRUD
- products.json import (Upsert / ReplaceAll)
- JSON export
- PopularScore ham JSON dan Firestore ga o'tadi (import yoki edit orqali)
- Admin: Google login + email allowlist + Firestore rules

## Tez sozlash
1) Firebase Console -> Project settings -> Web app -> SDK config
2) `admin/firebase-config.js` ichidagi `FIREBASE_CONFIG` ni to'ldiring
3) Firestore Database + Google Auth yoqing
4) Firestore Rules: `sample/firestore.rules` ni qo'ying
5) Host qiling (Netlify yoki Firebase Hosting)

## Kolleksiya
- `products/{id}`
- `meta/adminSettings` (adminEmails: [])

## Import
Admin panelda **Import JSON**:
- Upsert: mavjudini yangilaydi, yo'q bo'lsa yaratadi
- ReplaceAll: products kolleksiyasini tozalab qayta yozadi (admin bo'lish shart)

