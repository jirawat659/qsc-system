// 🗄️ Centralized Storage Utility for QSC System
// รองรับทั้ง HttpOnly Cookie (Production) และ Bearer Token Fallback (Development Cross-Port HTTP)

const KEYS = {
  TOKEN: 'token',
  ROLE: 'role',
  USER: 'user',
  USERNAME: 'username'
};

export const authStorage = {
  isTokenValid: () => {
    const token = localStorage.getItem(KEYS.TOKEN);
    if (token) {
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          const base64Url = parts[1];
          const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
          const jsonPayload = decodeURIComponent(
            atob(base64)
              .split('')
              .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
              .join('')
          );
          const payload = JSON.parse(jsonPayload);
          if (payload.exp && Date.now() >= payload.exp * 1000) {
            authStorage.clearSession();
            return false;
          }
          return true;
        }
      } catch {
        // format ไม่ถูกต้อง ให้ลองดู user object
      }
    }
    const user = authStorage.getUser();
    return !!(user && user.id);
  },

  isSessionActive: () => {
    return authStorage.isTokenValid();
  },

  getToken: () => {
    return localStorage.getItem(KEYS.TOKEN) || null;
  },
  setToken: (token) => {
    if (token) localStorage.setItem(KEYS.TOKEN, token);
    else localStorage.removeItem(KEYS.TOKEN);
  },

  getRole: () => localStorage.getItem(KEYS.ROLE),
  setRole: (role) => localStorage.setItem(KEYS.ROLE, role),

  getUser: () => {
    try {
      const data = localStorage.getItem(KEYS.USER);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },
  setUser: (user) => localStorage.setItem(KEYS.USER, JSON.stringify(user)),

  saveSession: ({ token, role, user, username }) => {
    if (token) localStorage.setItem(KEYS.TOKEN, token);
    if (role) localStorage.setItem(KEYS.ROLE, role);
    if (username) localStorage.setItem(KEYS.USERNAME, username);
    if (user) localStorage.setItem(KEYS.USER, JSON.stringify(user));
  },

  clearSession: () => {
    Object.values(KEYS).forEach((key) => localStorage.removeItem(key));
    localStorage.removeItem('qsc_selected_brand_id');
    localStorage.removeItem('fullName');
    try {
      sessionStorage.clear();
    } catch (e) {}
  }
};

export default authStorage;
