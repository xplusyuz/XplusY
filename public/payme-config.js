// public/payme-config.js
// OrzuMall Payme konfiguratsiyasi — Billing + Verify (avtomatik balans)
// Frontend faqat checkout'ga yo'naltiradi; tekshiruv va balans oshirish server (Netlify Function) orqali bo'ladi.
//
// ENV (Netlify):
//  - PAYME_KEY
//  - FIREBASE_SERVICE_ACCOUNT_B64
//
// Payme Sandbox checkout base: https://checkout.test.paycom.uz
// Production checkout base:     https://checkout.paycom.uz

export const PAYME_MODE = "billing-verify";
export const PAYME_LANG = "uz";

// Payme kabinetdagi kassa/merchant id (checkout param: merchant)
export const PAYME_KASSA_ID = "6992f957364df48c3ebc0a21";

// Checkout base (sandbox)
export const PAYME_CHECKOUT_BASE = "https://checkout.test.paycom.uz";

// Rekvizit nomi (Payme kabinetda qo'yilgan)
export const PAYME_ACCOUNT_KEY = "user_id";
