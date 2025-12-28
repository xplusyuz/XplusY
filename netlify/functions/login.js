const { getDb, verifyPassword, signJwt, json, readJsonBody } = require('./_firebase');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(200, { ok: true });
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  const body = readJsonBody(event);
  if (!body) return json(400, { error: 'JSON xato' });

  const id = String(body.id || '').trim();
  const password = String(body.password || '');

  if (!id || !/^[0-9]{4,12}$/.test(id)) return json(400, { error: 'ID xato (faqat raqam)' });
  if (!password) return json(400, { error: 'Parol kiriting' });

  try {
    const db = getDb();
    const doc = await db.collection('users').doc(id).get();
    if (!doc.exists) return json(404, { error: 'Bunday ID topilmadi' });

    const user = doc.data();
    if (!verifyPassword(password, user.pass)) return json(401, { error: 'Parol noto‘g‘ri' });

    const token = signJwt({ uid: id });
    return json(200, {
      ok: true,
      token,
      user: {
        id,
        points: user.points || 0,
        balance: user.balance || 0,
        profile: user.profile || {},
        mustCompleteProfile: !!user.mustCompleteProfile,
      }
    });
  } catch (e) {
    return json(500, { error: 'Server xatosi', detail: String(e.message || e) });
  }
};
