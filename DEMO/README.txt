LeaderMath.UZ — Isolated Pages + Firebase Auth (ZIP)

Fayllar:
- index.html — chip navigatsiya, sandbox iframe, Firebase Auth blok
- home.json — bo‘lim/sahifalar ro‘yxati (mode:url yoki mode:html)
- inner-demo.html — mustaqil CSS/JS bilan namunaviy ichki sahifa
- firestore.rules — Firestore uchun minimal xavfsizlik qoidalari
- storage.rules — Storage uchun minimal xavfsizlik qoidalari
- logo.png — oddiy vaqtinchalik logo

Ishga tushirish:
1) index.html dagi firebaseConfig ni o‘zingizning qiymatlarga almashtiring.
2) Lokal serverda ishga tushiring (masalan: VS Code Live Server / `python -m http.server`).
3) home.json orqali bo‘limlarni qo‘shing/olib tashlang. 
   - mode:'html' => contentHtml ichiga to‘liq HTML yozing.
   - mode:'url'  => src ga sahifa yo‘lini bering va ichki sahifaga auto-height skriptini qo‘shing.
4) Firebase backend resurslari (Firestore/Storage) uchun berilgan rules fayllarini konsol orqali yuklang.
