import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Telegram login hash tekshirish
function isValidTelegramAuth(data, botToken) {
  const checkHash = data.hash;
  const dataCheckString = Object.keys(data)
    .filter(k => k !== 'hash')
    .sort()
    .map(k => `${k}=${data[k]}`)
    .join('\n');

  const secretKey = crypto.createHash('sha256').update(botToken).digest();
  const hmac = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  return hmac === checkHash;
}

export const handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: 'Method Not Allowed' };
    }
    const body = JSON.parse(event.body || '{}');
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    if (!isValidTelegramAuth(body, botToken)) {
      return { statusCode: 401, body: JSON.stringify({ ok: false, error: 'Invalid Telegram auth' }) };
    }

    const telegram_id = Number(body.id);
    const username = body.username || null;
    const first_name = body.first_name || null;

    // Foydalanuvchini qo‘shish yoki yangilash
    const { data, error } = await supabase
      .from('users')
      .upsert({ telegram_id, username, first_name }, { onConflict: 'telegram_id' })
      .select()
      .single();

    if (error) throw error;

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        user: {
          telegram_id: data.telegram_id,
          username: data.username,
          first_name: data.first_name,
          balance: data.balance,
          role: data.role
        }
      })
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: e.message }) };
  }
};
