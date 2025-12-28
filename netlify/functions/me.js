const { getDb, verifyJwt, json } = require('./_firebase');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(200, { ok: true });
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  const auth = event.headers.authorization || event.headers.Authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const payload = verifyJwt(token);
  if (!payload || !payload.uid) return json(401, { error: 'Auth kerak' });

  try {
    const db = getDb();
    const doc = await db.collection('users').doc(String(payload.uid)).get();
    if (!doc.exists) return json(404, { error: 'User topilmadi' });
    const user = doc.data();
    return json(200, {
      ok: true,
      user: {
        id: user.id,
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
