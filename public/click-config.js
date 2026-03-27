// CLICK auto top-up public config (SECRET_KEY server tomonda qoladi)
export const CLICK_CONFIG = {
  enabled: true,
  serviceId: "98862",
  merchantId: "45406",
  merchantUserId: "80786",
  minAmountUZS: 1000,
  returnPath: "/index.html#profile",
  // /api yo'li ishlamasa direct function ishlatiladi
  startEndpoint: "/.netlify/functions/click-start",
  prepareUrl: "https://xplusy.netlify.app/.netlify/functions/click-prepare",
  completeUrl: "https://xplusy.netlify.app/.netlify/functions/click-complete"
};
