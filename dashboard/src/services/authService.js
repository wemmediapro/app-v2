import axios from 'axios';

// Même logique que apiService : en prod utiliser /api relatif pour éviter localhost (CORS)
const API_BASE_URL = import.meta.env.VITE_API_URL !== undefined
  ? import.meta.env.VITE_API_URL
  : (import.meta.env.DEV ? '' : '/api');

const authApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  withCredentials: true,
});

export const authService = {
  login: async (credentials) => {
    const response = await authApi.post('/auth/login', credentials);
    if (response.data?.token) {
      localStorage.setItem('adminToken', response.data.token);
    }
    return response;
  },
  
  register: async (userData) => {
    const response = await authApi.post('/auth/register', userData);
    return response;
  },
  
  getProfile: async () => {
    const token = localStorage.getItem('adminToken');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const response = await authApi.get('/auth/me', { headers });
    return response;
  },
  
  updateProfile: async (profileData) => {
    const token = localStorage.getItem('adminToken');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const response = await authApi.put('/auth/profile', profileData, { headers });
    return response;
  },
  
  logout: async () => {
    try {
      await authApi.post('/auth/logout');
    } catch (_) {}
    localStorage.removeItem('adminToken');
    delete authApi.defaults.headers.common['Authorization'];
    if (typeof axios !== 'undefined') {
      delete axios.defaults.headers.common['Authorization'];
    }
  }
};

export default authService;