Test tizimi (test.html + tests.csv + testcsv/*.csv)

Qanday ishlaydi:
1) /tests.csv — test CSV fayllar ro'yxati (ustun: file).
2) /testcsv/*.csv — har bir test fayli:
   - 1-qator: card_img, card_title, card_meta, price_som, time_min
   - 2-qator (sarlavha): q_img, q_text, a, b, c, d, correct, olmos, penalty_olmos
   - 3+ qatorlar: savollar
3) test.html — manifestni o‘qib katalog hosil qiladi, Boshlash bosilganda Firestore balansidan narxni yechib testni ishga tushiradi.

Eslatma:
- Kirish (Firebase Auth) asosiy saytda bo‘lishi kerak. test.html faqat mavjud sessiyani ishlatadi.
- MathJax qo‘llab-quvvatlanadi ($...$).
- To‘lovdan so‘ng yakunda sof olmos gems maydoniga qo‘shiladi.

Muallif: ChatGPT (GPT-5 Thinking)
