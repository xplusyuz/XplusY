// improved auth-utils.js (API version)
(function(){
  const STORAGE_KEY = 'leaderMathUserSession';

  let currentUser = null;
  let isSessionLoading = false;
  let sessionPromise = null;

  async function loadSession(){
    if (isSessionLoading && sessionPromise) {
      return sessionPromise;
    }

    isSessionLoading = true;
    sessionPromise = (async () => {
      let sessionId = null;
      try{ 
        sessionId = localStorage.getItem(STORAGE_KEY); 
      } catch(e) {
        console.error('LocalStorage error:', e);
      }

      if (!sessionId){
        currentUser = null;
        isSessionLoading = false;
        return null;
      }

      try{
        // API orqali sessionni tekshirish
        const response = await fetch(`/.netlify/functions/api/auth/session/${sessionId}`);
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || 'Session not found');
        }
        
        currentUser = data.user;
        isSessionLoading = false;
        return currentUser;
      }catch(err){
        console.error('Session yuklashda xatolik:', err);
        try{ localStorage.removeItem(STORAGE_KEY); }catch(e){}
        currentUser = null;
        isSessionLoading = false;
        return null;
      }
    })();

    return sessionPromise;
  }

  async function requireSession(){
    if (currentUser) {
      return currentUser;
    }

    const user = await loadSession();
    
    if (user) {
      return user;
    }

    const currentPath = window.location.pathname;
    if (!currentPath.includes('login.html')) {
      const redirect = encodeURIComponent(window.location.href);
      window.location.href = `login.html?redirect=${redirect}`;
      return new Promise(() => {});
    }
    
    return null;
  }

  async function checkSession() {
    if (currentUser) return currentUser;
    
    const user = await loadSession();
    return user;
  }

  function getUser(){
    return currentUser;
  }

  async function loginWithIdPassword(loginId, password){
    const id   = (loginId || '').trim();
    const pass = (password || '').trim();
    if (!id || !pass) throw new Error('ID va parol talab qilinadi');

    try {
      const response = await fetch('/.netlify/functions/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id, password: pass })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      try{ 
        localStorage.setItem(STORAGE_KEY, data.sessionId); 
      } catch(e) {
        console.error('LocalStorage error:', e);
      }

      currentUser = data.user;
      return currentUser;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  async function registerAuto(){
    try {
      const response = await fetch('/.netlify/functions/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      try{ 
        localStorage.setItem(STORAGE_KEY, data.sessionId); 
      } catch(e) {
        console.error('LocalStorage error:', e);
      }

      currentUser = data.user;
      
      return { 
        loginId: data.loginId, 
        password: data.password, 
        user: currentUser 
      };
    } catch (error) {
      console.error('Register error:', error);
      throw error;
    }
  }

  async function logout(){
    try{ 
      localStorage.removeItem(STORAGE_KEY); 
    } catch(e) {
      console.error('LocalStorage error:', e);
    }
    currentUser = null;
    isSessionLoading = false;
    sessionPromise = null;
  }

  async function updateUserData(partial){
    if (!currentUser) throw new Error('Foydalanuvchi topilmadi');
    
    try {
      const response = await fetch(`/.netlify/functions/api/user/${currentUser.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(partial)
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Update failed');
      }
      
      currentUser = data.user;
      return currentUser;
    } catch (error) {
      console.error('Update error:', error);
      throw error;
    }
  }

  // Avvalgi sessionni yuklash
  loadSession();

  window.authUtils = {
    requireSession,
    checkSession,
    getUser,
    loadSession,
    loginWithIdPassword,
    registerAuto,
    logout,
    updateUserData
  };

})();