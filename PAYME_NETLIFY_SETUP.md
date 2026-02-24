# OrzuMall — Payme (Sandbox) Netlify Functions

## 1) Payme endpoint URL (kabinetga beriladigan)
**Endpoint URL:**
`https://YOUR-NETLIFY-DOMAIN/.netlify/functions/payme`

Masalan:
`https://xplusy.netlify.app/.netlify/functions/payme`

## 2) Netlify Environment Variables (shart)
Netlify → Site settings → Environment variables:

- `PAYME_KEY` = **sandbox/test key** (siz bergan)
- `KASSA_ID` = `6992f957364df48c3ebc0a21` (ixtiyoriy, hozir bu functionda shart emas)
- `FIREBASE_SERVICE_ACCOUNT` = Firebase Service Account JSON (bitta qatorda)

**FIREBASE_SERVICE_ACCOUNT** ni olish:
Firebase Console → Project settings → Service accounts → Generate new private key → JSON fayl.
Shu JSON kontentini Netlify env ga qo‘ying.

## 3) Firestore kolleksiyalar
- `orders/{orderId}`  (frontend yaratadi)
- `payme_transactions/{transactionId}` (function yaratadi)

Payme `PerformTransaction` bo‘lsa:
- `orders/{orderId}.status = "paid"`
- `orders/{orderId}.payment.status = "paid"`

## 4) Sandbox → Production almashtirish
Keyinchalik faqat Netlify envdagi:
- `PAYME_KEY` ni production keyga almashtirasiz.

Agar checkout domeni ham o‘zgarsa, `public/payme-config.js` dagi `PAYME_CHECKOUT_BASE` ni
`https://checkout.test.paycom.uz` ga qaytaring.


## API-only (Checkout EMAS) rejimi
- Siz faqat KASSA_ID + PAYME_KEY bilan ishlashni tanladingiz.
- Checkout/web-kassa ID kerak emas.
- Sayt checkout redirect qilmaydi. To‘lov Payme tomondan tasdiqlanganda (PerformTransaction) order 'paid' bo‘ladi.
- Sandbox’da Paycom tester orqali CreateTransaction/PerformTransaction yuborib test qilasiz.

### Netlify ENV
- PAYME_KEY = (test_key yoki prod_key)
- FIREBASE_SERVICE_ACCOUNT = service account JSON (one-line)
- (ixtiyoriy) PAYME_ALLOW_NO_AUTH=1 (faqat sandbox tester Authorization yubormasa)
