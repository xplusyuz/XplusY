// Telegram notification config (SAFE: no tokens in client)
// Uses Netlify Function: /.netlify/functions/telegram
// Server must have env:
//   ORDER_BOT_TOKEN (orders)  / TOPUP_BOT_TOKEN (topup)  (fallback: TELEGRAM_BOT_TOKEN / TG_BOT_TOKEN)
//   TELEGRAM_ADMIN_CHAT_ID
//   FIREBASE_SERVICE_ACCOUNT_B64
//
// Optional: to disable notifications on client, set enabled=false below.
window.TG_ADMIN = { enabled: true };
window.TG_USER  = { enabled: true };
