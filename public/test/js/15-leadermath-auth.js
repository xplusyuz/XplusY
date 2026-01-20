// ==================== LEADERMATH AUTO USER (lm_token) ====================
// Talab: sinf/o'quvchi tanlash YO'Q.
// Test tizimi kirgan foydalanuvchini LeaderMath umumiy authUtils orqali avto aniqlaydi.
//
// Eslatma:
//  - authUtils.js o'zi API fallback qiladi: /.netlify/functions/api -> /api
//  - Token bo'lmasa: app.html?login=1 ga qaytaradi

(function(){
  'use strict';

  // authUtils mavjud bo'lmasa ham test sahifa ochilib turishi uchun yengil wrapper.
  const au = (typeof window !== 'undefined' && window.authUtils) ? window.authUtils : null;

  // Test sahifa /test/ ichida bo'lgani uchun appHome ni aniq berib qo'yamiz.
  try {
    if (au && typeof au.configure === 'function') {
      au.configure({ appHome: '/app.html' });
    }
  } catch (_) {}

  window.leaderMathAuth = {
    async me(){
      if (!au || typeof au.me !== 'function') return null;
      return await au.me().catch(()=>null);
    },

    async requireUser(opts){
      if (!au || typeof au.requireUser !== 'function') return null;
      return await au.requireUser(opts || {});
    },

    toStudent(user){
      if (!au || typeof au.toStudent !== 'function') {
        if (!user) return null;
        const fullName = (user.name || `${user.firstName||''} ${user.lastName||''}`.trim() || user.loginId || 'Foydalanuvchi').trim();
        return { id: user.loginId || user.id || user.uid || 'unknown', fullName, _lm: user };
      }
      return au.toStudent(user);
    }
  };
})();
