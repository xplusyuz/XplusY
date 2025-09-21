# SPA Router Pack (partials bilan)

**Qanday ishlatish:**
1) Ushbu pack ichidagi `index.html` faylni oching — unda `router.js` va `sw.js` allaqachon ulangan.
2) `partials/` papkasidagi fayllarni o'zingizga moslab tahrir qiling.
3) FAB menyudagi `data-route` qiymatlari `home, courses, tests, simulators, results, profile` bo'lsa, SPA avtomatik o'sha partialni yuklaydi.
4) Offline: sahifani kamida bir marta ochgach, SW cache qo'llab-quvvatlaydi.

**Eslatma:**
- Sizning asl `index.html` dizayningiz saqlab qolingan. Biz nusxa sifatida `index.html` yaratdik va faqat `</body>` oldidan 2 ta script qo'shildi.
- Agar rootda SW ishlashi uchun `sw.js` ga to'g'ri yo'l kerak bo'lsa, serverda `scope` sozlamalarini tekshiring.