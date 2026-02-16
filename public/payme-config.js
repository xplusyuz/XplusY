// public/payme-config.js
// OrzuMall Payme konfiguratsiyasi (ES Module)
// SAFE: merchant_id frontendda ochiq bo‘lishi mumkin (Payme checkout link uchun).

export const PAYME_MERCHANT_ID = "697ba4c920e090490061e8c1";

// til (Payme checkout odatda uz/ru/en)
export const PAYME_LANG = "uz";

// Payme checkout base
export const PAYME_CHECKOUT_BASE = "https://checkout.paycom.uz";

// Siz Payme kabinetda "account" sifatida qaysi field ishlatayotgan bo‘lsangiz
export const PAYME_ACCOUNT_FIELD = "order_id";

// Checkout URL generator
export function createPaymeCheckoutUrl(orderId, amountUzs) {
  const amountTiyin = Math.round(Number(amountUzs) * 100);
  const payload = `m=${PAYME_MERCHANT_ID};ac.${PAYME_ACCOUNT_FIELD}=${orderId};a=${amountTiyin}`;
  const encoded = btoa(unescape(encodeURIComponent(payload)));
  return `${PAYME_CHECKOUT_BASE}/${encoded}`;
}
