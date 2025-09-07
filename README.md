# MathCenter.uz — Final Starter (Vanilla JS + Firebase)
Mobil-app ko‘rinishi, **Google + Email auth**, **majburiy profil**, **ID (1000001+)**, **balans + olmos**, **kun/tun rejimi**, **CSV ↔ Firestore kontent**, **xarid oqimi + kirish gating**, **Top-100**, **o‘qituvchi** va **admin** panellari.

## Ishga tushirish
1) Statik hosting (Netlify/Vercel) ga fayllarni qo‘ying.  
2) Firebase Console → Firestore → **Rules**: `firestore.rules` dan ko‘chirib **Publish** qiling.  
3) Authentication → Sign-in method: **Google** va **Email/Password** → **Enable**; Google’da **Support email** tanlang.  
4) Authentication → Settings → **Authorized domains**: saytingiz domenini qo‘shing (masalan `xplusy.netlify.app`).  
5) (Ixtiyoriy) `counters/users` hujjatiga `lastAssigned: 1000000` qo‘yishingiz mumkin, lekin transaction o‘zi yaratadi.

## Admin/Teacher
- Admin: `users/{uid}` ga `isAdmin: true` qo‘shing → Sozlamalarda Admin panel ko‘rinadi (Firestore’da `content_*` ni boshqaradi).
- O‘qituvchi: `users/{uid}` ga `isTeacher: true` → O‘qituvchi paneli ko‘rinadi (demo).

## CSV formatlari
- home.csv: `title,tag,meta`
- courses.csv: `name,tag,meta`
- tests.csv: `name,tag,meta,price,productId`
- sim.csv: `name,tag,meta`

*Yaratilgan sana:* 2025-09-07
