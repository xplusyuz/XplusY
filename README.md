# OrzuMall — Keyingi bosqich (Auth + Orders) — Static + Firebase

Bu paket A+ ustiga quyidagilar qo‘shildi:

✅ **Telefon + Parol bilan kirish/ro‘yxatdan o‘tish** (Email/Password orqali):
- Email o‘rniga: `+998901234567@orzumall.uz` formatida ichki email ishlatiladi
- Telefon raqam +998 formatga avtomatik to‘g‘rilanadi
- Parol esdan chiqdi: botga murojaat (matn chiqadi)

✅ **Buyurtma berish (Orders)**
- Checkout bosilganda `/orders` ga buyurtma yoziladi
- Status: `new`
- `/users/{uid}` doc’da OM ID saqlanadi (oldingi kabi)

✅ **Admin: buyurtmalar ro‘yxati (oddiy)**
- Admin email ro‘yxati `assets/app.js` ichida `ADMIN_EMAILS`
- Admin bo‘lsa “Admin” sahifa chiqadi: buyurtmalar + status o‘zgartirish

## Firebase Console sozlash
1) Authentication → Sign-in method → **Email/Password ON**
2) (ixtiyoriy) Anonymous OFF qilishingiz mumkin

## Firestore schema
- products (oldingi kabi)
- orders (collection):
  - uid, omId, phone
  - items: [{productId,title,price,qty}]
  - total
  - status: "new" | "processing" | "shipped" | "done" | "canceled"
  - createdAt, updatedAt

## Firestore Rules
`firestore.rules.sample` yangilandi: products read public, orders read/write owner, admin update status.

Netlify: build yo‘q, shunchaki deploy.
