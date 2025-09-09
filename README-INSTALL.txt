Integratsiya paketi (SPA): partials/tests.html + js/tests.js + css/tests.css + csv/tests.csv

O‘rnatish bosqichlari:
1) ZIP ichidagilarni saytingiz ildiziga yozib qo‘ying (mavjud papkalar bilan birlashtiring):
   - partials/tests.html
   - js/tests.js
   - css/tests.css
   - csv/tests.csv
   - csv/tests/dtm_demo.csv (namuna)
2) Routerga qo‘shing (router.js, tests yo‘nalishi):
   // Misol:
   case '#/tests': {
     await loadPartial('partials/tests.html');
     await import('/js/tests.js').then(m => m.default.init());
     break;
   }
3) Mavjud Firebase Auth sessiyasi ishlatiladi. Foydalanuvchi kirmagan bo‘lsa, boshlashga ruxsat berilmaydi.
4) Manifest: csv/tests.csv (ustun: file). Har bir test faylining 1-qatori — kartaning meta ma’lumoti.
5) To‘lov: “Tasdiqlayman” bosilganda users/{uid}.balance dan narx transaction bilan yechiladi. Yakunda sof olmos gems ga qo‘shiladi.
