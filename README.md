# OrzuMall (Static + Firebase) — Variant A+ (Real structure)

Bu A+ patch OrzuMall real yondashuviga yaqinlashtirildi:
- Bottom bar: Home + Kategoriya + Yurak + Savat + Profil
- Products: `image / images / imagesByColor` ni qo‘llaydi
- Kategoriya: `category` yoki `tags[0]` (parent) + `tags[1]` (child) orqali
- User profile: `/users/{uid}` avtomatik yaratiladi, `OMXXXXXX` numericId transaction bilan
- Cart/Favorites realtime

## 1) Firebase config
`assets/firebase-config.js` ichiga Web configni qo‘ying.

## 2) Auth
A+ default: **Anonymous Auth**
Firebase Console → Authentication → Sign-in method → Anonymous ON

## 3) Firestore schema
### products (collection)
Minimal:
- title (string)
- price (number)
Ixtiyoriy:
- oldPrice (number)
- installmentText (string)
- rating (number 0..5)
- reviewsCount (number)
- category (string)  // masalan "Elektronika"
- tags (array<string>) // masalan ["Kiyim","Ayollar"]
- imagesByColor (map<string, array<string>>) // { "black": ["url1","url2"] }
- images (array<string>)
- image (string)
- createdAt (timestamp)

### users/{uid} (doc)
- numericId (number)  // counter orqali
- omId (string)       // "OM000123"
- createdAt (timestamp)
- name (string, optional)
- phone (string, optional)

### meta/counters (doc)
- userCounter (number)

### users/{uid}/cart/{productId}
- qty (number)
- addedAt (timestamp)

### users/{uid}/favorites/{productId}
- addedAt (timestamp)

## 4) Recommended Firestore Rules (sample)
`firestore.rules.sample` faylida bor — Firebase Rules’ga qo‘ying.

## 5) Deploy (Netlify)
Build yo‘q. Root papkani deploy qiling.



## Next stage (qilingan)
- login.html qo‘shildi: telefon+parol (Firebase Auth Email/Password)
- checkout: /orders ga buyurtma yaratadi va cartni tozalaydi
