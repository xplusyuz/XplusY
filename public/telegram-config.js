// Telegram admin notification config (client-side, no Functions)
// ⚠️ IMPORTANT: Token in client-side code is visible to anyone who opens DevTools.
// For best security, use Cloud Functions / server. This is the simplest variant.
//
// Fill these and redeploy:
window.TG_ADMIN = {
  botToken: "8318922493:AAHXRXrfpEbS-uvtqIOIPrXEhbsxT6ii-M0", // e.g. "123456:ABC..."
  chatId: "2049065724"    // e.g. "2049065724"
};

// Optional: user notifications (same bot token usually works).
// To enable: set botToken and (optionally) defaultChatId.
// Per-user chat id should be stored in Firestore users/{uid}.telegramChatId (or tgChatId).
window.TG_USER = window.TG_USER || {
  botToken: (window.TG_ADMIN && window.TG_ADMIN.botToken) ? window.TG_ADMIN.botToken : "",
  defaultChatId: ""
};
