export async function handler(event) {
  const data = JSON.parse(event.body);

  const BOT_TOKEN = process.env.TG_BOT_TOKEN;
  const CHAT_ID = process.env.TG_CHAT_ID;

  const text = `
📝 Yangi test urinish!
👤 ${data.name}
📊 Ball: ${data.score}
📚 Test: ${data.testTitle}
  `;

  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ chat_id: CHAT_ID, text })
  });

  return { statusCode: 200, body: "OK" };
}
