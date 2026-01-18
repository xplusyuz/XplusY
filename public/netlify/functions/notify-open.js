
export async function handler(event) {
  const data = JSON.parse(event.body || "{}");

  const formatTime = (sec=0) => {
    const m = Math.floor(sec/60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2,'0')}`;
  };

  const msg = `
📝 <b>OPEN TEST YECHILDI</b>

🧩 <b>Test kodi:</b> <code>${data.testCode}</code>
👤 <b>UID:</b> <code>${(data.uid||'').slice(0,8)}</code>

━━━━━━━━━━━━━━━
📊 <b>NATIJA</b>
━━━━━━━━━━━━━━━
✅ To‘g‘ri: <b>${data.correct}</b>
❌ Noto‘g‘ri: <b>${data.wrong}</b>
🏆 <b>Ball:</b> <b>${data.score}</b>
⏱ <b>Vaqt:</b> ${formatTime(data.time)}
━━━━━━━━━━━━━━━

⭐ <b>Points faqat 1-marta qo‘shildi</b>
`;

  await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: process.env.TELEGRAM_CHAT_ID,
      text: msg,
      parse_mode: "HTML"
    })
  });

  return {
    statusCode: 200,
    body: JSON.stringify({ ok: true })
  };
}
