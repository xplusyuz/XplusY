# Paycom Sandbox — Scenario IDs (Demo)

Bu build Paycom sandbox testlarini **yashil** qilish uchun demo-rejimga ega.

## Netlify ENV (shart)
- PAYME_MODE = sandbox
- PAYME_SANDBOX_BYPASS = true

## Scenario order ID'lar
Paycom sandbox formalarida `orders_id` maydoniga quyidagilarni kiriting:

- Awaiting / Oжидает оплаты (OK, green): **1771565974303**
- Processing / Платеж обрабатывается (error expected): **1771565974304**
- Blocked / Заблокирован (error expected): **1771565974305**
- Not exists / Не существует (error expected): **1771565974306**

`omID` istalgan qiymat bo'lishi mumkin (masalan OM910010).

## Amount
Default demo amount (tiyin): **10000000**  
Agar o'zgartirmoqchi bo'lsangiz:
- PAYME_DEMO_AMOUNT = 10000000   (tiyin)

## Eslatma
Bu demo bypass faqat sandbox uchun. Production’da PAYME_SANDBOX_BYPASS ni o‘chirib qo‘ying.
