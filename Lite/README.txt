MathCenter — Lite Login (users.json) + Firebase Reyting (user_points)

1) Static fayllarni (index.html, login.html, admin.html, assets/*.json, js/firebase-init.js, css/style.css) Netlify yoki GitHub Pages'ga qo'ying.
2) Firebase Console → Firestore → Rules bo'limiga `firestore.rules` faylidagi qoidalarni joylang va deploy qiling.
3) Reyting `user_points` kolleksiyasiga avtomatik yig'iladi (test topshirilganda).
4) Admin panel (admin.html) orqali banner/test/users JSONlarini tahrir qiling va "JSON-ni yuklab olish" bilan eksport qiling. Hostingda assets fayllarini yangilang.
5) Kirish: users.json ichidagi login/parol (default super admin: Math@1999 / Math@28021999).

Eslatma:
- Firebase Auth → Sign-in method → Anonymous: ENABLED bo'lsin.
- Agar “Anonymous” o'chirilsa, test natijasini yozish ishlamaydi (rules isAnon()).