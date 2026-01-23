export async function handler(event) {
  // --- CORS (frontend fetch uchun) ---
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }

  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
      return {
        statusCode: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({
          ok: false,
          error: "ENV_MISSING",
          message: "TELEGRAM_BOT_TOKEN yoki TELEGRAM_CHAT_ID yo‘q"
        })
      };
    }

    const data = JSON.parse(event.body || "{}");

    // --- moslashuv: eski format ham, yangi format ham ---
    const testCode = String(data.testCode || data.testId || data.code || "");
    const uid = String(data.uid || data.userKey || data.loginId || "");
    const correct = Number(data.correct ?? data.correctCount ?? data.score?.correctCount ?? 0) || 0;
    const wrong = Number(data.wrong ?? data.wrongCount ?? data.score?.wrongCount ?? 0) || 0;

    // score: old formatda data.score; yangi formatda data.score.finalScore
    const scoreVal =
      Number(data.score?.finalScore ?? data.finalScore ?? data.score ?? 0) || 0;

    // time: old formatda data.time; yangi formatda data.timeSpentSec
    const timeSec =
      Number(data.time ?? data.timeSpentSec ?? 0) || 0;

    const title = String(data.title || data.testTitle || "");

    const formatTime = (sec = 0) => {
      const s = Math.max(0, Math.floor(sec));
      const m = Math.floor(s / 60);
      const r = s % 60;
      return `${m}:${String(r).padStart(2, "0")}`;
    };

    const msg = `
📝 <b>OPEN TEST YECHILDI</b>

🧩 <b>Test:</b> <b>${title ? title : (testCode || "Noma'lum")}</b>
🔖 <b>Kod:</b> <code>${testCode || "—"}</code>
👤 <b>UID:</b> <code>${uid ? uid.slice(0, 24) : "—"}</code>

━━━━━━━━━━━━━━━
📊 <b>NATIJA</b>
━━━━━━━━━━━━━━━
✅ To‘g‘ri: <b>${correct}</b>
❌ Noto‘g‘ri: <b>${wrong}</b>
🏆 <b>Ball:</b> <b>${scoreVal}</b>
⏱ <b>Vaqt:</b> ${formatTime(timeSec)}
━━━━━━━━━━━━━━━
`;

    const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: msg,
        parse_mode: "HTML",
        disable_web_page_preview: true
      })
    });

    const tgJson = await tgRes.json().catch(() => ({}));

    if (!tgRes.ok || tgJson.ok !== true) {
      return {
        statusCode: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({
          ok: false,
          error: "TELEGRAM_FAILED",
          status: tgRes.status,
          telegram: tgJson
        })
      };
    }

    return {
      statusCode: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true })
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ ok: false, error: "SERVER_ERROR", message: e?.message || String(e) })
    };
  }
}
