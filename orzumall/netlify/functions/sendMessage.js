export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const { telegram_id, text } = JSON.parse(event.body);

  const BOT_TOKEN = process.env.TG_BOT_TOKEN;
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: telegram_id,
      text
    })
  });

  const data = await r.json();

  return {
    statusCode: 200,
    body: JSON.stringify(data)
  };
}
