// ==================== LEADERMATH AUTO USER (lm_token) ====================
// Bu fayl test tizimini LeaderMath platformasidagi login bilan bog'laydi.
// Talab: sinf/o'quvchi tanlash o'rniga kirgan foydalanuvchini avto aniqlash.

const leaderMathAuth = {
  tokenKey: 'lm_token',
  apiBase: '/.netlify/functions/api',

  getToken() {
    try { return localStorage.getItem(this.tokenKey) || ''; } catch (_) { return ''; }
  },

  async me() {
    const token = this.getToken();
    if (!token) return null;

    // LeaderMath API: /.netlify/functions/api?path=auth/me
    const u = new URL(this.apiBase, location.origin);
    u.searchParams.set('path','/auth/me');

    const res = await fetch(u.toString(), {
      method: 'GET',
      headers: { Authorization: 'Bearer ' + token }
    });

    if (!res.ok) {
      // Token yaroqsiz bo'lsa, test ichida ham tozalab yuboramiz.
      if (res.status === 401 || res.status === 403) {
        try { localStorage.removeItem(this.tokenKey); } catch (_) {}
      }
      return null;
    }

    const data = await res.json().catch(() => null);
    const user = data?.user || data?.data?.user || null;
    return user;
  },

  toStudent(user) {
    if (!user) return null;
    const fullName = (user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.loginId || 'Foydalanuvchi').trim();
    return {
      id: user.loginId || user.id || user.uid || 'unknown',
      fullName,
      // qo'shimcha: test header/watermark kerak bo'lsa
      _lm: user
    };
  }
};
