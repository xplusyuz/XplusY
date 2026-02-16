# OrzuMall — Payme (Sandbox) — Netlify Functions (PRO)

## 1) Payme kabinetga beriladigan endpoint URL
**Endpoint URL:**
`https://YOUR-NETLIFY-DOMAIN/.netlify/functions/payme`

Masalan:
`https://xplusy.netlify.app/.netlify/functions/payme`

> Shu endpoint Payme'ning Merchant API (JSON-RPC) chaqiruvlari uchun.

---

## 2) Netlify Environment Variables (shart)
Netlify → Site settings → Environment variables:

- `PAYME_KEY` = **sandbox/test key** (siz bergan test_key)
- `FIREBASE_SERVICE_ACCOUNT` = Firebase service account JSON (bitta qatorda / one-line)

⚠️ `FIREBASE_SERVICE_ACCOUNT` ni bitta qatorda qilish uchun JSON minify qiling (yoki VS Code’da formatni olib tashlang).

---

## 3) Checkout (redirect sahifa) haqida MUHIM
Checkout (brauzerda to‘lov sahifasi ochilishi) uchun `public/payme-config.js` ichida:

- `PAYME_CHECKOUT_MERCHANT_ID` — Payme kabinetdan olingan **WEB-KASSA / CHECKOUT MERCHANT ID**

⚠️ Bu ID **KASSA ID** (merchant api) bilan ko‘pincha bir xil bo‘lmaydi.
Agar noto‘g‘ri ID qo‘ysangiz checkout sahifada:
**“Поставщик не найден или заблокирован”** chiqadi.

Sandbox uchun checkout domen:
`https://checkout.test.paycom.uz`

---

## 4) Firestore (minimal) talab
`orders/{orderId}` hujjat bo‘lishi kerak.

Tavsiya:
- `amountTiyin` (int, tiyin) yoki `amount` (UZS)
- `status` ("pending" | "paid" | "canceled")

Transactionlar:
- `payme_transactions/{txId}` ga yoziladi.

---

## 5) Balans (ixtiyoriy)
Agar order doc’da `type: "topup"` va `uid` bo‘lsa,
`PerformTransaction` paytida:
`users/{uid}.balanceTiyin` avtomatik oshiriladi.
