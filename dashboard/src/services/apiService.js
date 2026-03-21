import axios from 'axios';
import toast from 'react-hot-toast';

function resolveApiBaseUrl() {
  if (import.meta.env.VITE_API_URL !== undefined && import.meta.env.VITE_API_URL !== '') {
    return String(import.meta.env.VITE_API_URL).replace(/\/$/, '');
  }
  return String(import.meta.env.VITE_API_PREFIX || '/api/v1').replace(/\/$/, '');
}

export const API_BASE_URL = resolveApiBaseUrl();

function readCookie(name) {
  const escaped = name.replace(/[$()*+.?[\\\]^{|}]/g, '\\$&');
  const m = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : '';
}

// Create axios instance — withCredentials pour envoyer le cookie httpOnly (auth admin)
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  withCredentials: true,
});

const MUTATING = new Set(['post', 'put', 'patch', 'delete']);
api.interceptors.request.use((config) => {
  const method = (config.method || 'get').toLowerCase();
  if (MUTATING.has(method)) {
    const csrf = readCookie('csrfToken');
    if (csrf) {
      config.headers = config.headers || {};
      if (!config.headers['X-CSRF-Token'] && !config.headers['x-csrf-token']) {
        config.headers['X-CSRF-Token'] = csrf;
      }
    }
  }
  return config;
});

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('authToken'); // rétrocompat nettoyage
      if (!window.location.pathname.includes('/login')) {
        const base = window.location.pathname.startsWith('/dashboard') ? '/dashboard' : '';
        window.location.href = `${base}/login`;
      }
    }
    if (error.response?.status === 429) {
      const msg = error.response?.data?.message || 'Trop de requêtes. Veuillez patienter quelques minutes.';
      toast.error(msg);
    }
    return Promise.reject(error);
  }
);

export const apiService = {
  // Dashboard
  getDashboardStats: () => api.get('/admin/dashboard'),
  getDatabases: () => api.get('/admin/databases'),

  // Users
  getUsers: (params = '') => api.get(`/admin/users?${params}`),
  createUser: (data) => api.post('/admin/users', data),
  updateUser: (id, data) => api.put(`/admin/users/${id}`, data),
  deleteUser: (id, hard = false) => api.delete(`/admin/users/${id}${hard ? '?hard=true' : ''}`),

  // Restaurants
  getRestaurants: (params = '') => api.get(`/restaurants?${params}`),
  getRestaurant: (id) => api.get(`/restaurants/${id}`),
  createRestaurant: (data) => api.post('/restaurants', data),
  updateRestaurant: (id, data) => api.put(`/restaurants/${id}`, data),
  deleteRestaurant: (id) => api.delete(`/restaurants/${id}`),

  // Feedback
  getFeedback: (params = '') => api.get(`/feedback/admin/all?${params}`),
  getFeedbackById: (id) => api.get(`/feedback/${id}`),
  updateFeedbackStatus: (id, data) => api.put(`/feedback/admin/${id}`, data),

  // Messages
  getConversations: () => api.get('/admin/conversations'),
  getConversationsUnreadCount: () => api.get('/admin/conversations/unread-count'),
  getMessages: (userId) => api.get(`/messages/${userId}`),
  sendMessage: (data) => api.post('/messages', data),

  // Notifications push GNV (admin)
  getNotificationsAll: (params = '') => api.get(`/notifications/all?${params}`),
  createNotification: (data) => api.post('/notifications', data),
  deleteNotification: (id) => api.delete(`/notifications/${id}`),

  // Analytics
  getAnalyticsOverview: () => api.get('/analytics/overview'),
  getAnalyticsConnections: () => api.get('/analytics/connections'),
  getAnalyticsContent: () => api.get('/analytics/content'),
  getAnalyticsPerformance: () => api.get('/analytics/performance'),

  // Radio
  getRadioStations: (params = '') => api.get(`/radio?${params}`),
  getRadioStation: (id) => api.get(`/radio/${id}`),
  createRadioStation: (data) => api.post('/radio', data),
  updateRadioStation: (id, data) => api.put(`/radio/${id}`, data),
  deleteRadioStation: (id) => api.delete(`/radio/${id}`),

  // Movies & Series
  getMovies: (params = '') => api.get(`/movies?${params}`),
  getMovie: (id) => api.get(`/movies/${id}`),
  createMovie: (data) => api.post('/movies', data),
  updateMovie: (id, data) => api.put(`/movies/${id}`, data),
  deleteMovie: (id) => api.delete(`/movies/${id}`),

  // Magazine
  getArticles: (params = '') => api.get(`/magazine?${params}`),
  getArticle: (id, params = '') => api.get(`/magazine/${id}${params ? `?${params}` : ''}`),
  createArticle: (data) => api.post('/magazine', data),
  updateArticle: (id, data) => api.put(`/magazine/${id}`, data),
  deleteArticle: (id) => api.delete(`/magazine/${id}`),

  // Shop
  getProducts: (params = '') => api.get(`/shop?${params}`),
  getProduct: (id) => api.get(`/shop/${id}`),
  createProduct: (data) => api.post('/shop', data),
  updateProduct: (id, data) => api.put(`/shop/${id}`, data),
  deleteProduct: (id) => api.delete(`/shop/${id}`),
  getPromotions: () => api.get('/shop/promotions'),
  createPromotion: (data) => api.post('/shop/promotions', data),
  updatePromotion: (id, data) => api.put(`/shop/promotions/${id}`, data),
  deletePromotion: (id) => api.delete(`/shop/promotions/${id}`),

  // WebTV (MongoDB + fallback démo)
  getWebTVChannels: (params = '') => api.get(`/webtv/channels?${params}`),
  getWebTVChannel: (id) => api.get(`/webtv/channels/${id}`),
  createWebTVChannel: (data) => api.post('/webtv/channels', data),
  updateWebTVChannel: (id, data) => api.put(`/webtv/channels/${id}`, data),
  deleteWebTVChannel: (id) => api.delete(`/webtv/channels/${id}`),
  /** Traduire titre et description d'une chaîne dans toutes les langues (OpenAI). Retourne la chaîne mise à jour. */
  translateWebTVChannel: (id, data) => api.post(`/webtv/channels/${id}/translate`, data || {}),
  /** Traduire un titre + description sans chaîne (pour formulaire création). Retourne { translations }. */
  translateWebTVPreview: (data) => api.post('/webtv/translate', data),

  // Enfant (MongoDB + fallback démo)
  getEnfantActivities: (params = '') => api.get(`/enfant/activities?${params}`),
  getEnfantActivity: (id) => api.get(`/enfant/activities/${id}`),
  createEnfantActivity: (data) => api.post('/enfant/activities', data),
  updateEnfantActivity: (id, data) => api.put(`/enfant/activities/${id}`, data),
  deleteEnfantActivity: (id) => api.delete(`/enfant/activities/${id}`),
  /** Traduire le contenu d'une activité dans toutes les langues (OpenAI). Retourne l'activité mise à jour. */
  translateEnfantActivity: (id) => api.post(`/enfant/activities/${id}/translate`),

  // Shipmap (MongoDB + fallback démo)
  getShipmapData: () => api.get('/shipmap'),
  getShipmapDecks: (params = '') => api.get(`/shipmap/decks?${params}`),
  updateShipmapData: (data) => api.put('/shipmap', data),
  createShipmapDeck: (data) => api.post('/shipmap/decks', data),
  updateShipmapDeck: (id, data) => api.put(`/shipmap/decks/${id}`, data),
  deleteShipmapDeck: (id) => api.delete(`/shipmap/decks/${id}`),

  // Banners (MongoDB + fallback démo)
  getBanners: (params = '') => api.get(`/banners?${params}`),
  getBannersAll: () => api.get('/banners/all'),
  getBanner: (id) => api.get(`/banners/${id}`),
  createBanner: (data) => api.post('/banners', data),
  updateBanner: (id, data) => api.put(`/banners/${id}`, data),
  deleteBanner: (id) => api.delete(`/banners/${id}`),

  // Publicités vidéo (pre-roll / mid-roll, calendrier)
  getAds: (params = '') => api.get(`/ads?${params}`),
  getAd: (id) => api.get(`/ads/${id}`),
  createAd: (data) => api.post('/ads', data),
  updateAd: (id, data) => api.put(`/ads/${id}`, data),
  deleteAd: (id) => api.delete(`/ads/${id}`),

  // Bandes d'annonces (films/séries) — affiche, titre, description multilingue, vidéo par URL
  getTrailers: (params = '') => api.get(`/trailers?${params}`),
  getTrailer: (id) => api.get(`/trailers/${id}`),
  createTrailer: (data) => api.post('/trailers', data),
  updateTrailer: (id, data) => api.put(`/trailers/${id}`, data),
  deleteTrailer: (id) => api.delete(`/trailers/${id}`),

  // Upload vidéo (compression automatique à 480p)
  uploadVideo: async (file, onProgress) => {
    const formData = new FormData();
    formData.append('video', file);
    const config = onProgress
      ? {
          onUploadProgress: (e) => onProgress(e.loaded && e.total ? (e.loaded / e.total) * 100 : 0),
        }
      : {};
    const response = await api.post('/upload/video', formData, {
      ...config,
      timeout: 300000, // 5 min pour les grosses vidéos
      // Ne pas fixer Content-Type : laisser le navigateur ajouter multipart/form-data + boundary
    });
    return response.data;
  },
  getUploadStatus: () => api.get('/upload/status'),

  // Bibliothèque média : liste et suppression des fichiers sur le serveur
  getMediaLibrary: () => api.get('/media-library'),
  deleteMediaFile: (filePath) => api.delete('/media-library', { data: { path: filePath } }),

  // Upload image (logo station, etc.) — ne pas fixer Content-Type : axios l'ajoute avec la boundary pour FormData
  uploadImage: async (file) => {
    const formData = new FormData();
    formData.append('image', file);
    const response = await api.post('/upload/image', formData, { timeout: 30000 });
    return response.data;
  },

  // Upload audio (MP3, etc.) — programmation radio, sans passer par la bibliothèque
  // onProgress(percent: 0-100) optionnel pour afficher une barre de progression
  uploadAudio: async (file, onProgress) => {
    const formData = new FormData();
    formData.append('audio', file);
    const response = await api.post('/upload/audio', formData, {
      timeout: 120000,
      onUploadProgress: onProgress
        ? (e) => {
            const percent = e.total ? Math.min(100, Math.round((e.loaded / e.total) * 100)) : 0;
            onProgress(percent);
          }
        : undefined,
    });
    return response.data;
  },

  // Health check
  healthCheck: () => api.get('/health'),

  // Navires (GNV) — liste, détail, création, mise à jour
  getShips: (all = false) => api.get(`/gnv/ships${all ? '?all=true' : ''}`),
  getShip: (id) => api.get(`/gnv/ships/${id}`),
  getDestinations: () => api.get('/gnv/destinations'),
  createShip: (data) => api.post('/gnv/ships', data),
  updateShip: (id, data) => api.patch(`/gnv/ships/${id}`, data),
  deleteShip: (id) => api.delete(`/gnv/ships/${id}`),
  // Configuration du bateau unique (nom, capacité, informations) — utilisée dans restaurant, shop, plan du bateau
  getBoatConfig: () => api.get('/gnv/boat-config'),
  updateBoatConfig: (data) => api.patch('/gnv/boat-config', data),
  // Limite de connexions du serveur local (où tourne le backend)
  getConnectionLimit: () => api.get('/gnv/connection-limit'),
  updateConnectionLimit: (data) => api.patch('/gnv/connection-limit', data),
  // Droits d'accès par rôle (persistés en base)
  getAccessSettings: () => api.get('/admin/settings/access'),
  updateAccessSettings: (data) => api.put('/admin/settings/access', data),

  // Generic GET method
  get: (url) => api.get(url),
  post: (url, data) => api.post(url, data),
  put: (url, data) => api.put(url, data),
  delete: (url) => api.delete(url),
};

export default api;
