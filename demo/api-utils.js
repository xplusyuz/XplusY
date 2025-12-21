// api-utils.js
(function() {
  const API_BASE = '/.netlify/functions/api';
  
  async function apiRequest(endpoint, method = 'GET', body = null) {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    try {
      const response = await fetch(`${API_BASE}${endpoint}`, options);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Server xatosi');
      }
      
      return data;
    } catch (error) {
      console.error('API so\'rovi xatosi:', error);
      throw error;
    }
  }

  window.apiUtils = {
    // Auth endpoints
    login: (id, password) => apiRequest('/auth/login', 'POST', { id, password }),
    register: () => apiRequest('/auth/register', 'POST'),
    getUser: (userId) => apiRequest(`/user/${userId}`, 'GET'),
    updateUser: (userId, data) => apiRequest(`/user/${userId}`, 'PATCH', data),
    checkSession: (sessionId) => apiRequest(`/auth/session/${sessionId}`, 'GET'),
  };
})();