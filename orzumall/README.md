# Mobile Shop — Chips + Filters + Cart + Orders (Firebase)

## 1) Qisqa ishlatish
- `index.html` — user app
- `admin.html` — admin panel (Google login)
- Firestore collections:
  - `shop_nav/{bigId}` (fields: title, order, active)
    - `shop_nav/{bigId}/filters/{filterId}` (fields: title, order, active)
  - `products/{productId}` (fields: title, price, currency, img, desc, bigId, filterId, order, active)
  - `carts/{userId}/items/{productId}` (qty + product snapshot)
  - `orders/{orderId}` (customer + items + status)

## 2) Firebase config
`index.html` va `admin.html` ichida `firebaseConfig` ni o'zingiznikiga almashtiring.

## 3) Admin permissions
Console -> Authentication -> Users -> admin user -> UID ni oling
`firestore.rules` ichida `PASTE_ADMIN_UID_HERE` o‘rniga qo‘ying.

## 4) Firestore Index (MUHIM)
Agar konsolda `query requires an index` chiqsa:
Firestore -> Indexes -> Create index.

Kerak bo‘ladigan index:
- Collection: products
  - active ASC
  - bigId ASC
  - order ASC

(Agar filter bo'yicha ham orderBy qilsangiz)
- Collection: products
  - active ASC
  - bigId ASC
  - filterId ASC
  - order ASC

## 5) Telegram notify (ixtiyoriy)
Netlify’da env variables qo‘ying:
- TELEGRAM_BOT_TOKEN
- TELEGRAM_CHAT_ID

Checkout paytida `/.netlify/functions/notify-order` chaqiriladi.

## 6) Deploy (Netlify)
Project rootni Netlify’ga upload qiling (publish = ".")
Functions folder: `netlify/functions`
