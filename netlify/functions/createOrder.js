const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch");

const DB_PATH = path.join(process.cwd(), "data/db.json");

function readDB() {
  return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
}

function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const order = JSON.parse(event.body);

  if (!order.telegram_id || !order.name || !order.phone || !order.address) {
    return { statusCode: 400, body: "Invalid order data" };
  }

  // 📖 DB o‘qiymiz
  const db = readDB();

  // 🔢 Order raqami
  const orderNumber = db.order_counter++;

  // 🧾 Yangi order
  const newOrder = {
    order_id: orderNumber,
    telegram_id: order.telegram_id,
    name: order.name,
    phone: order.phone,
    address: order.address,
    items: order.items || [],
    status: "new",
    created_at: new Date().toISOString()
  };

  db.orders.push(newOrder);
  writeDB(db);

  // 📩 Telegramga avtomatik xabar
  const BOT_TOKEN = process.env.TG_BOT_TOKEN;

  const message = `
✅ Buyurtmangiz qabul qilindi!

🧾 Buyurtma raqami: #${orderNumber}

💳 To‘lov uchun karta:
8600 **** **** 1234

📸 Iltimos, to‘lov chekini shu botga yuboring.
  `;

  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: order.telegram_id,
      text: message
    })
  });

  return {
    statusCode: 200,
    body: JSON.stringify({ success: true, order_id: orderNumber })
  };
};
