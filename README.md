# OrzuMall — Full Firebase Project (Front + Admin + Real Popularity)

Bu loyiha 3 qismdan iborat:

- **/public** — Premium storefront (mahsulotlar, sevimli, savatcha, buyurtma)
- **/public/admin** — Admin panel (products CRUD + JSON import/export)
- **/functions** — Real popularity (qiziqish + sotib olishga qarab) hisoblaydigan Cloud Functions

## 1) Firestore sxema

- `products/{id}` — mahsulotlar (admin yozadi, hamma o‘qiydi)
  - `popularScore` (auto)
  - `popularStats` (auto: views, favorites, carts, purchases, revenueUZS)
- `events/{eventId}` — qiziqish eventlari (user create qiladi)
  - `type`: `view | favorite | add_to_cart`
  - `productId`
  - `uid`
- `orders/{orderId}` — buyurtmalar (user create qiladi)
  - `items[]` (productId, qty, priceUZS, variant)
  - `totalUZS`
  - `status: created`

## 2) Popularity qanday ishlaydi?

Cloud Functions exponential time-decay ishlatadi:

`score = score * exp(-lambda * dtHours) + weight`

Half-life: **7 kun**. Og‘irliklar:
- view: 0.2
- favorite: 1.5
- add_to_cart: 2.5
- purchase: 12

Shu bilan “popular” real bo‘ladi: ko‘rish + qiziqish + savat + sotib olish ta’sir qiladi.

## 3) Sozlash (majburiy)

### A) Firebase project yaratish
Firebase Console → yangi project → Firestore + Authentication (Google) yoqing.

### B) Web config
`public/firebase-config.js` ichidagi `firebaseConfig` ni o‘z project’ingizdagi config bilan almashtiring.

Admin ham shu configdan foydalanadi (admin ichida alohida config emas).

### C) Admin emails (custom claim)
Firestore rules write uchun `admin=true` claim kerak.

1) `ORZU_ADMIN_EMAILS` env ga email(lar) yozing:
- Firebase CLI (Functions v2): Firebase environment variables usuli.
Eng osoni: deploydan oldin lokal `.env`:
`functions/.env` ichida:
`ORZU_ADMIN_EMAILS=sohibjonmath@gmail.com,another@gmail.com`

2) Admin panelga Google bilan kiring → u avtomatik `claimAdmin` callable’ni chaqiradi.
Keyin qayta login qiling (claim token yangilanishi uchun).

### D) Deploy
```
npm i -g firebase-tools
firebase login
firebase use --add

# Deploy rules + hosting + functions
firebase deploy
```

## 4) Admin panel
Deploydan keyin:
- Storefront: `/`
- Admin: `/admin`

Admin’da:
- Import JSON: `public/products.json` ni yuklab “Import/Upsert”
- Keyin storefront Firestore’dan real-time o‘qiydi.

## 5) Eslatma
- Popularity serverda hisoblanadi — user tomonida “soxtalashtirish” qiyinroq.
- Xohlasangiz keyingi bosqichda: Payment (Payme/Click), order status flow, courier integratsiya qo‘shamiz.
