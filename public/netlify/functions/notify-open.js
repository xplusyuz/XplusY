export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  let payload = {};
  try {
    payload = await req.json();
  } catch {
    payload = {};
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    return new Response('Missing TELEGRAM env', { status: 500 });
  }

  const lines = [];
  lines.push('📝 OPEN TEST');
  lines.push(`👤 ${payload.studentName || '—'} (${payload.studentId || payload.uid || '—'})`);
  if (payload.studentClass) lines.push(`🏫 ${payload.studentClass}`);
  lines.push(`🔑 Code: ${payload.testCode || '—'}`);
  if (payload.testTitle) lines.push(`📌 ${payload.testTitle}`);
  lines.push(`🎯 Score: ${payload.score ?? 0}/${payload.totalScore ?? ''}`);
  if (payload.timeSpent !== undefined) lines.push(`⏱ Time: ${payload.timeSpent}s`);
  if (payload.violations !== undefined) lines.push(`⚠️ Violations: ${payload.violations}`);

  const added = !!payload.pointsAdded;
  const amt = Number(payload.pointsAddedAmount) || 0;
  lines.push(added ? `✅ Points +${amt}` : 'ℹ️ Points already counted');

  if (payload.completedAt) lines.push(`🕒 ${payload.completedAt}`);

  const text = lines.join('\n');

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text })
    });
    const ok = res.ok;
    if (!ok) {
      const t = await res.text();
      return new Response(`Telegram API error: ${t}`, { status: 502 });
    }
    return new Response('ok', { status: 200 });
  } catch (e) {
    return new Response(`Telegram request failed: ${String(e)}`, { status: 502 });
  }
};
