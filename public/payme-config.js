// public/payme-config.js
// OrzuMall Payme konfiguratsiyasi — "billingsiz" (Form generator / Checkout page)
// Bu rejimda foydalanuvchi Payme Checkout sahifasiga yuboriladi (server-side verify YO'Q).
// To'lovni tasdiqlash (paid) odatda admin tomonidan qo'lda qilinadi.

// UI logikasi uchun
export const PAYME_MODE = "form";

// ru | uz | en
export const PAYME_LANG = "ru";

// Merchant ID (ID веб-кассы) — Payme Business -> Web-kassa -> Developer params
// Screenshotdagi merchant: 699981188dbbeda52ae0ec5d
export const PAYME_MERCHANT_ID = "699981188dbbeda52ae0ec5d";

// Checkout URL
// Sandbox: https://test.paycom.uz
// Prod:    https://checkout.paycom.uz
export const PAYME_CHECKOUT_URL = "https://test.paycom.uz";

// Siz Payme Business'da rekvizit sifatida: order_id (Buyurtma raqami) qo'shgansiz.
export const PAYME_ACCOUNT_FIELD = "order_id";

// Ixtiyoriy: to'lov tavsifi
export const PAYME_DESCRIPTION = {
  ru: "Оплата заказа OrzuMall",
  uz: "OrzuMall buyurtma to‘lovi",
  en: "OrzuMall order payment"
};
