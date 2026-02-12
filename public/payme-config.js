// Payme public config (safe to expose)
// This file is imported as an ES module from public/app.js

// 1) Merchant ID (required)
// Example: export const PAYME_MERCHANT_ID = "YOUR_MERCHANT_ID";
export const PAYME_MERCHANT_ID = "697ba4c920e090490061e8c1";

// 2) UI language hint (optional)
// Use: "uz" | "ru" | "en"
export const PAYME_LANG = "uz";

// Backward-compatible globals
window.PAYME_MERCHANT_ID = window.PAYME_MERCHANT_ID || PAYME_MERCHANT_ID;
window.PAYME_LANG = window.PAYME_LANG || PAYME_LANG;
