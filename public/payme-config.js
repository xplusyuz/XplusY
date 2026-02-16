// public/payme-config.js
// OrzuMall Payme konfiguratsiyasi (ES Module)
//
// ⚠️ MUHIM:
// - Merchant API (Netlify function) uchun: PAYME_KEY (ENV) ishlatiladi.
// - Checkout (redirect) uchun esa Payme kabinetdan olingan *WEB-KASSA / CHECKOUT MERCHANT ID* kerak.
//   Bu ID odatda KASSA ID (merchant api uchun berilgan) bilan BIR XIL EMAS.
//
// Quyidagi CHECKOUT_MERCHANT_ID ni Payme kabinetdan olib shu yerga qo‘ying.

export const PAYME_CHECKOUT_MERCHANT_ID = "PASTE_CHECKOUT_MERCHANT_ID_HERE";

// til (Payme checkout odatda uz/ru/en)
export const PAYME_LANG = "uz";

// Payme checkout base (sandbox uchun)
export const PAYME_CHECKOUT_BASE = "https://checkout.test.paycom.uz";

// Payme "account" field nomi (standard: order_id)
export const PAYME_ACCOUNT_FIELD = "order_id";

// Checkout URL generator
export function createPaymeCheckoutUrl(orderId, amountUzs, returnUrl) {
  if (!PAYME_CHECKOUT_MERCHANT_ID || PAYME_CHECKOUT_MERCHANT_ID.startsWith("PASTE_")) {
    throw new Error("PAYME_CHECKOUT_MERCHANT_ID sozlanmagan (payme-config.js)");
  }
  const amountTiyin = Math.round(Number(amountUzs) * 100);
  const cPart = returnUrl ? `;c=${encodeURIComponent(returnUrl)}` : "";
  const payload = `m=${PAYME_CHECKOUT_MERCHANT_ID};ac.${PAYME_ACCOUNT_FIELD}=${orderId};a=${amountTiyin};l=${PAYME_LANG}${cPart}`;
  const encoded = btoa(unescape(encodeURIComponent(payload)));
  return `${PAYME_CHECKOUT_BASE}/${encoded}`;
}
