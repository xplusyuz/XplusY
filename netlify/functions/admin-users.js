import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ADMIN_ID = "2049065724"; // Sizning Telegram ID

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

function requireAdmin(event) {
  try {
    const authHeader = event.headers['authorization'] || '';
    if (!authHeader.startsWith('Bearer ')) return false;
    const payload = JSON.parse(Buffer.from(authHeader.replace('Bearer ', ''), 'base64').toString());

    if (!isValidTelegramAuth(payload, process.env.TELEGRAM_BOT_TOKEN)) return false;
    if (String(payload.id) !== ADMIN_ID) return false;

    return true;
  } catch {
    return false;
  }
}

export const handler = async (event) => {
  if (!requireAdmin(event)) {
    return { statusCode: 401, body: JSON.stringify({ ok: false, error: 'Access denied' }) };
  }

  try {
    const method = event.httpMethod;

    if (method === 'GET') {
      const { data, error } = await supabase.from('users').select('*').order('id');
      if (error) throw error;
      return { statusCode: 200, body: JSON.stringify({ ok: true, users: data }) };
    }

    const payload = JSON.parse(event.body || '{}');

    if (method === 'POST') {
      const { data, error } = await supabase.from('users').insert(payload).select().single();
      if (error) throw error;
      return { statusCode: 200, body: JSON.stringify({ ok: true, user: data }) };
    }

    if (method === 'PUT') {
      const { telegram_id, ...rest } = payload;
      const { data, error } = await supabase.from('users').update(rest).eq('telegram_id', telegram_id).select().single();
      if (error) throw error;
      return { statusCode: 200, body: JSON.stringify({ ok: true, user: data }) };
    }

    if (method === 'DELETE') {
      const { telegram_id } = payload;
      const { error } = await supabase.from('users').delete().eq('telegram_id', telegram_id);
      if (error) throw error;
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 405, body: 'Method Not Allowed' };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: e.message }) };
  }
};
