// ==================== LEADERMATH AUTO USER (lm_token) ====================
// Bu fayl test tizimini LeaderMath platformasidagi login bilan bog'laydi.
// Talab: sinf/o'quvchi tanlash o'rniga kirgan foydalanuvchini avto aniqlash.

// ✅ Endi yagona auth: public/assets/js/authUtils.js
// Orqaga moslik uchun shu obyekt nomini saqlab turamiz.
const leaderMathAuth = (function(){
  const au = window.authUtils;
  if(!au){
    // juda eski fallback (token yo'q bo'lsa null)
    return {
      async me(){ return null; },
      toStudent(){ return null; }
    };
  }
  return {
    getToken: () => au.getToken(),
    me: (...args) => au.me(...args),
    toStudent: (u) => au.toStudent(u)
  };
})();
