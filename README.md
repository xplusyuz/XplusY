# LeaderMath.uz — Starter (ZIP)

## 0) Nima bor?
- Oddiy foydalanuvchi: ID+maxfiy so'z login **faqat /api orqali** (Firebase SDK yo'q → tejamkor)
- Majburiy profil: ism, familiya, tug'ilgan sana, viloyat/tuman (region.json)
- Header: Salom, name + tiny ID/age/points + avatar
- Pastki bottom-nav: admin.html orqali boshqariladi
- Har section: chip filter + banner/card
- Reyting: o'ngdan chiqadigan panel (points bo'yicha TOP)

## 1) Netlify ENV
- FIREBASE_SERVICE_ACCOUNT = Firebase service account JSON (to'liq JSON matn)
- APP_JWT_SECRET = random secret (uzun)

## 2) Firestore rules (tavsiya)
Client to'g'ridan-to'g'ri kira olmasin:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{doc=**} { allow read, write: if false; }
  }
}
```

## 3) Admin sozlash
`public/admin.js` ichidagi firebaseConfig ni o'zingnikiga mosla.
Admin email: sohibjonmath@gmail.com

## 4) Lokal ishga tushirish
1) npm i
2) npx netlify dev
3) http://localhost:8888


## MUHIM: Netlify settings (404 /api bo'lsa)
- Publish directory: **public**
- Functions directory: **netlify/functions**
- Redirect: public/_redirects bor ( /api/* -> /.netlify/functions/api/:splat )

Agar siz URL'da `.../public/` ko'rayotgan bo'lsangiz — publish directory noto'g'ri qo'yilgan.
