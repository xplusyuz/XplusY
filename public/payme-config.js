// Payme config (ES Module)
// SAFE to expose: merchant_id is public in Payme checkout URLs.
export const PAYME_MERCHANT_ID = (window.PAYME_MERCHANT_ID || "").toString();
export const PAYME_LANG = (window.PAYME_LANG || "uz").toString();

// Backward-compat for legacy code:
window.PAYME_MERCHANT_ID = window.PAYME_MERCHANT_ID || PAYME_MERCHANT_ID;
window.PAYME_LANG = window.PAYME_LANG || PAYME_LANG;
