// api-utils.js (API-only, session-aware)
(function () {
  const API_BASE = '/.netlify/functions/api';
  const STORAGE_KEY = 'leaderMathUserSession';

  function getSessionId(){
    try { return localStorage.getItem(STORAGE_KEY) || ''; } catch(e){ return ''; }
  }

  async function apiRequest(endpoint, method='GET', body=null, extraHeaders=null){
    const headers = { 'Content-Type': 'application/json' };

    // Session header (server both X-Session-Id and Authorization supports)
    const sid = getSessionId();
    if (sid) {
      headers['X-Session-Id'] = sid;
      headers['Authorization'] = `Bearer ${sid}`;
    }
    if (extraHeaders) Object.assign(headers, extraHeaders);

    const options = { method, headers };
    if (body !== null) options.body = JSON.stringify(body);

    const res = await fetch(`${API_BASE}${endpoint}`, options);
    const text = await res.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch(e){ data = { raw: text }; }

    if (!res.ok) {
      const msg = data?.error || data?.message || `HTTP ${res.status}`;
      const err = new Error(msg);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  window.apiUtils = {
    API_BASE,
    // Auth
    register: () => apiRequest('/auth/register', 'POST'),
    login: (id, password) => apiRequest('/auth/login', 'POST', { id, password }),
    session: (sessionId) => apiRequest(`/auth/session/${encodeURIComponent(sessionId)}`,'GET'),
    changePassword: (currentPassword, newPassword) => apiRequest('/auth/password','POST',{ currentPassword, newPassword }),

    // User
    getUser: (userId) => apiRequest(`/user/${encodeURIComponent(userId)}`,'GET'),
    updateUser: (userId, patch) => apiRequest(`/user/${encodeURIComponent(userId)}`,'PATCH', patch),
    uploadAvatar: (userId, avatarBase64) => apiRequest(`/user/${encodeURIComponent(userId)}/avatar`,'POST',{ avatar: avatarBase64 }),

    // Content
    getHomeContent: () => apiRequest('/content/home','GET'),
    getRanking: () => apiRequest('/ranking','GET'),
  };
})();