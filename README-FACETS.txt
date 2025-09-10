CSV-dan boshqariladigan filtrlar (v4)

tests.csv manifest formatini kengaytirdik:
- `file` ustunidan tashqari istalgan qo‘shimcha ustunlar **filtr** sifatida ishlaydi.
- Masalan: `fan, daraja, mavzu, narx_tag, vaqt_tag` va h.k.
- UI dagi select'lar shu ustunlar va ularning noyob qiymatlaridan **avtomatik** hosil bo‘ladi.

Namuna:
file,fan,daraja,mavzu,narx_tag,vaqt_tag
/csv/tests/dtm_demo.csv,Matematika,O‘rta,Algebra,≤5k,≤20

Eslatma:
- Qidiruv baribir sarlavha/meta bo‘yicha ishlaydi (ixtiyoriy).
- Test CSV (dtm_demo.csv) 1-qator: card_img, card_title, card_meta, price_som, time_min
- Savol rasmiga `q_img` ustuni qo‘shilgan (bo‘lmasa card_img fallback).
