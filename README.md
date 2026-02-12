# OrzuMall (Static + Firebase) — Variant A

Bu loyiha static (Netlify) ishlaydi: **index.html + assets/**. Backend yo‘q (functions/CLI kerak emas).

## 1) Firebase sozlash
1. Firebase Console → Project Settings → Web app qo‘shing (yoki mavjudini oling)
2. `assets/firebase-config.js` faylini ochib, config qiymatlarini kiriting.

## 2) Firestore kolleksiyalar (minimum)
### products
`products` kolleksiyasiga quyidagi fieldlar bilan hujjatlar qo‘shing:

- title (string)
- price (number)
- oldPrice (number, ixtiyoriy)
- discountPercent (number, ixtiyoriy)
- rating (number, ixtiyoriy) — 0..5
- reviewsCount (number, ixtiyoriy)
- category (string, ixtiyoriy)
- tags (array<string>, ixtiyoriy)
- image (string URL) yoki images (array<string>) yoki imagesByColor (map)
- createdAt (timestamp, ixtiyoriy)

**Eslatma:** rasm bo‘lmasa, cardda placeholder chiqadi.

### users/{uid}/cart/{productId}
- qty (number)
- addedAt (timestamp)

### users/{uid}/favorites/{productId}
- addedAt (timestamp)

## 3) Auth (yengil)
Loyiha default **Anonymous Auth** ishlatadi (cart/favorites uchun). Firebase Console → Authentication → Sign-in method → **Anonymous** ni yoqing.

## 4) Netlify
- Project rootni deploy qiling (index.html shu yerda)
- Build command kerak emas.

## 5) Xavfsizlik (tavsiya)
Mahsulotlar read: true bo‘lsin, cart/favorites faqat owner yozsin.

Tayyor!