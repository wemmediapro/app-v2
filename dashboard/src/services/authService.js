import axios from 'axios';

function resolveApiBaseUrl() {
  if (import.meta.env.VITE_API_URL !== undefined && import.meta.env.VITE_API_URL !== '') {
    return String(import.meta.env.VITE_API_URL).replace(/\/$/, '');
  }
  return String(import.meta.env.VITE_API_PREFIX || '/api/v1').replace(/\/$/, '');
}

const API_BASE_URL = resolveApiBaseUrl();

const authApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  withCredentials: true,
});

export const authService = {
  login: async (credentials) => {
    const response = await authApi.post('/auth/login', credentials);
    // Backend envoie le token en cookie httpOnly ; on ne stocke plus le token en localStorage (sécurité XSS)
    return response;
  },

  register: async (userData) => {
    const response = await authApi.post('/auth/register', userData);
    return response;
  },

  getProfile: async () => {
    const response = await authApi.get('/auth/me');
    return response;
  },

  updateProfile: async (profileData) => {
    const response = await authApi.put('/auth/profile', profileData);
    return response;
  },

  logout: async () => {
    try {
      await authApi.post('/auth/logout');
    } catch (_) {}
    localStorage.removeItem('authToken');
  },
};

export default authService;
