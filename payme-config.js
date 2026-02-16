// payme-config.js
// OrzuMall Payme konfiguratsiyasi

export const PAYME_CONFIG = {
  merchantId: "697ba4c920e090490061e8c1",
  checkoutBaseUrl: "https://checkout.paycom.uz",
  apiUrl: "https://checkout.paycom.uz/api",
  accountField: "order_id",
  currency: "UZS"
};

export function createPaymeCheckoutUrl(orderId, amountUzs) {
  const amountTiyin = Math.round(Number(amountUzs) * 100);

  const payload = `m=${PAYME_CONFIG.merchantId};ac.${PAYME_CONFIG.accountField}=${orderId};a=${amountTiyin}`;

  const encoded = btoa(unescape(encodeURIComponent(payload)));

  return `${PAYME_CONFIG.checkoutBaseUrl}/${encoded}`;
}