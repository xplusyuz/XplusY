// public/payme-config.js
// OrzuMall Payme konfiguratsiyasi — API-only (Checkout ishlatilmaydi)
// Bu rejimda faqat: KASSA_ID + PAYME_KEY (server env) kerak bo'ladi.
//
// Eslatma: Checkout/web-kassa (redirect) ishlatmoqchi bo'lsangiz, alohida Web-kassa/Checkout Merchant ID kerak bo'ladi.
// Siz hozir "faqat kassa id + key" deb tanlagansiz, shuning uchun checkout link generatsiya YO'Q.

export const PAYME_MODE = "api-only";
export const PAYME_LANG = "uz";

// Faqat ma'lumot uchun (Payme kabinetdagi kassa ID)
export const PAYME_KASSA_ID = "6992f957364df48c3ebc0a21";

// PAYME_KEY frontendga qo'yilmaydi. PAYME_KEY faqat Netlify ENV ichida bo'ladi.
