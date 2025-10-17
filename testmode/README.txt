MathCenter Test Module — FIXED (single navigator toggle)

Fayllar:
- test.html  — Test bajarish sahifasi (MathJax + mobil drawer, bitta toggle)
- test.js    — Interaktiv logika (duplicate const yo'q), timer, review, Firestore natija yozish
- testadmin.html — Admin konstruktor (LaTeX preview variantlarda)
- test.json  — Namuna test
- natijalar.html — Natija ko‘rish sahifasi
- img/jgp1.jpg — Namuna rasm

Ishga tushirish:
1) testadmin.html → savollarni to‘ldiring → JSON yuklab oling (algebra1.json).
2) test.html?file=algebra1.json orqali testni oching.
3) Tugagach, “Natijalar” tugmasidan natijalarni ko‘ring. Firebase `results` kolleksiyasiga yoziladi.
