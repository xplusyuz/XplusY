// netlify/functions/notify-order.js
// Telegram notify (optional). Set env vars on Netlify:
// TELEGRAM_BOT_TOKEN = 123:ABC
// TELEGRAM_CHAT_ID = -100xxxxxxxxxx or user chat id
//
// Client calls: POST /.netlify/functions/notify-order

export async function handler(event) {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) {
      // silently ignore if not configured
      return { statusCode: 200, body: JSON.stringify({ ok: true, skipped: true }) };
    }

    const data = JSON.parse(event.body || "{}");
    const lines = [];
    lines.push("🛍️ Yangi buyurtma!");
    if (data.orderId) lines.push("🧾 " + data.orderId);
    if (data.userId) lines.push("👤 ID: " + data.userId);
    if (data.name) lines.push("📛 " + data.name);
    if (data.phone) lines.push("📞 " + data.phone);
    if (typeof data.total !== "undefined") lines.push("💰 Jami: " + data.total + " UZS");

    if (Array.isArray(data.items) && data.items.length) {
      lines.push("");
      lines.push("📦 Items:");
      for (const it of data.items.slice(0, 25)) {
        const qty = Number(it.qty || 0);
        const title = String(it.title || it.productId || "Item");
        lines.push(`- ${title} × ${qty}`);
      }
      if (data.items.length > 25) lines.push("…");
    }

    const text = lines.join("\n");

    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text })
    });

    const out = await res.json().catch(() => ({}));
    return { statusCode: 200, body: JSON.stringify({ ok: true, telegram: out.ok || false }) };
  } catch (e) {
    return { statusCode: 200, body: JSON.stringify({ ok: false, error: String(e?.message || e) }) };
  }
}
