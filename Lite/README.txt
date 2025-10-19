MathCenter v4 — to'liq qayta yozilgan (banners/tests/users JSON + Admin + Timer + BEST + LaTeX + Reyting + History).

1) Statik fayllarni (barcha .html, css, js, assets/*.json) Netlify yoki GitHub Pages'ga joylang.
2) Firebase Console -> Authentication -> Sign-in method -> Anonymous: ENABLE.
3) Firestore -> Rules bo'limiga `firestore.rules` faylini qo'yib Publish qiling.
4) Admin: `admin.html` (superadmin: Math@1999 / Math@28021999). CSV import + mapping bor.
5) Test natijalari: `scores` (log), `user_points` (jamlangan ball). `rating.html` umumiy reyting, `scores.html` shaxsiy tarix.
6) Math: test.html MathJax (default) yoki `?renderer=katex` bilan KaTeX.
7) BEST + start/end + durationSeconds: cardlar holatini boshqaradi.

Eslatma: Admin panelda JSON-ni tahrir qilgandan keyin "JSON-ni yuklab olish" bilan faylni olib, hostingdagi `assets/` katalogidagi mos faylni almashtiring.