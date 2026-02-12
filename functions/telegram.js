const admin = require("firebase-admin");

const BOT_TOKEN = process.env.TG_TOKEN;
const ADMIN_CHAT_ID = process.env.TG_ADMIN_CHAT;

async function sendTG(chatId, text, parseMode="HTML") {
  if (!BOT_TOKEN) throw new Error("TG_TOKEN env is missing");
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type":"application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: parseMode, disable_web_page_preview: true })
  });
  const data = await res.json();
  if (!data.ok) throw new Error("Telegram error: " + JSON.stringify(data));
}

async function onceEvent(key) {
  const id = key.replaceAll("/", "__");
  const ref = admin.firestore().collection("events").doc(id);
  const snap = await ref.get();
  if (snap.exists) return false;
  await ref.set({ key, createdAt: admin.firestore.FieldValue.serverTimestamp() });
  return true;
}

function money(sum) {
  return new Intl.NumberFormat("uz-UZ").format(Number(sum||0)) + " so'm";
}

function adminOrderHtml(o) {
  const items = (o.items||[]).map(i => `• ${i.title} x${i.qty} (${i.colorKey||"-"}, ${i.size||"-"})`).join("\n");
  return [
    "🛒 <b>Yangi buyurtma</b>",
    `<b>ID:</b> ${o.orderNo || o.id}`,
    `<b>OM:</b> ${o.userSnapshot?.omId || "-"}`,
    `<b>Mijoz:</b> ${o.userSnapshot?.name || "-"}`,
    `<b>Telefon:</b> ${o.userSnapshot?.phone || "-"}`,
    `<b>Summa:</b> ${money(o.totalAmount||0)}`,
    `<b>To'lov:</b> ${o.payment?.method || "-"}`,
    `<b>Holat:</b> ${o.status || "-"}`,
    "",
    "<b>Mahsulotlar:</b>",
    items || "-"
  ].join("\n");
}

function userOrderHtml(o) {
  return [
    "✅ <b>Buyurtmangiz qabul qilindi</b>",
    `<b>ID:</b> ${o.orderNo || o.id}`,
    `<b>Summa:</b> ${money(o.totalAmount||0)}`,
    `<b>Holat:</b> ${o.status || "new"}`,
    `<b>To'lov:</b> ${o.payment?.status || "pending"}`
  ].join("\n");
}

module.exports = { sendTG, onceEvent, ADMIN_CHAT_ID, adminOrderHtml, userOrderHtml };
