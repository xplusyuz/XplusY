# MathCenter Header (Firebase — Production)

**Oxirgi yangilanish:** 2025-09-27 10:20:41

Bu paket `header.html` faylini beradi — Google Auth orqali **real** kirish, Firestore'ga **real** saqlash/oqish, `numericId` ni **atomik** tarzda berish (transaction), va profil ma'lumotlarini tahrirlash modalini o'z ichiga oladi.

## Tez start
1) Firebase Console:
   - Authentication -> **Sign-in method**: Google'ni yoqing.
   - Firestore Database -> **Create database** (Production mode).
   - **Rules** bo'limiga `firestore.rules` faylini qo'ying.
   - (Ixtiyoriy) Storage yoqsangiz avatar yuklashni keyin qo'shamiz.

2) `meta/counters` hujjatini yarating (agar avtomatik yaratilmasa):
   - Collection: `meta`
   - Doc: `counters`
   - Field: `nextUserId` = `1001`

3) `header.html` faylini loyihangiz sahifalariga qo'shing:
   ```html
   <div id="header-slot"></div>
   <script>
     fetch('/header.html').then(r=>r.text()).then(h=>document.getElementById('header-slot').innerHTML=h);
   </script>
   ```

4) Admin sozlash:
   - `firestore.rules` ichida `isAdmin()` dagi email/UID ro'yxatini o'zingizniki bilan almashtiring.

## Ma'lumot modeli
- `users/{uid}`:
  ```json
  {
    "displayName": "string",
    "email": "string",
    "photoURL": "string",
    "phoneNumber": "string",
    "createdAt": "<serverTimestamp>",
    "updatedAt": "<serverTimestamp>",
    "numericId": 1001,
    "balance": 0,
    "points": 0,
    "firstName": "string",
    "lastName": "string",
    "middleName": "string",
    "birthDate": "YYYY-MM-DD",
    "region": "namangan",
    "district": "Chortoq tumani",
    "school": "123-maktab",
    "role": "user|student|teacher|..."
  }
  ```

- `meta/counters`:
  ```json
  {
    "nextUserId": 1001
  }
  ```

## Real-time
`onSnapshot(users/{uid})` orqali balans, ID va ism **real vaqtda** headerda yangilanadi.

## Eslatmalar
- Agar `meta/counters` mavjud bo'lmasa, birinchi login paytida avtomatik yaratishga urinamiz.
- Xavfsizlik: foydalanuvchi faqat **o'z** profilini o'qiydi/yozadi. Admin esa hammani. (Rules ichida sozlang.)
- Keyinroq: avatar yuklash, premium belgilari, to'lov integratsiyasi va h.k. ni qo'shish oson.