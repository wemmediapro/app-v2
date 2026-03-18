import axios from 'axios';

// En dev : utiliser le proxy Vite (/api → backend 3000). Sinon : .env ou défaut 3000.
const API_BASE_URL = import.meta.env.DEV
  ? '/api'
  : (import.meta.env.VITE_API_URL || (typeof window !== 'undefined' ? `${window.location.origin}/api` : 'http://localhost:3000/api')); // navigateur : fallback window.location.origin, pas de localhost hardcodé
/** Origine du backend (sans /api) pour streaming vidéo, audio et images. En 100% offline, servir l'app depuis ce même hôte. */
export const BACKEND_ORIGIN = import.meta.env.DEV ? '' : (API_BASE_URL || '').replace(/\/api\/?$/, '');

/**
 * Origine effective pour les URLs de streaming/médias.
 * - En dev : origine de la page (proxy Vite envoie /api et /uploads au backend).
 * - En prod : si VITE_API_URL est défini (accès distant / tunnel), on utilise l’origine du backend
 *   pour que la radio et les vidéos soient lisibles même quand l’app est ouverte depuis une autre URL.
 */
function getEffectiveBackendOrigin() {
  if (typeof window === 'undefined') return BACKEND_ORIGIN || '';
  // En production avec API explicite (tunnel/accès distant), faire pointer les streams vers le backend
  if (!import.meta.env.DEV && BACKEND_ORIGIN && BACKEND_ORIGIN !== window.location.origin) {
    return BACKEND_ORIGIN;
  }
  return window.location.origin;
}

/** URL affichable pour un logo radio (image uploadée ou URL externe). Retourne null si pas une URL valide (ex: texte "Mosaïque"). */
export function getRadioLogoUrl(logo) {
  if (!logo || typeof logo !== 'string') return null;
  let t = logo.trim();
  if (!t) return null;
  if (t.startsWith('file://')) {
    t = t.replace(/^file:\/\//, '');
    if (!t.startsWith('/')) t = `/${t}`;
  }
  if (t.startsWith('http://') || t.startsWith('https://')) return t;
  if (t.startsWith('/')) return `${getEffectiveBackendOrigin()}${t}`;
  if (t.startsWith('uploads/')) return `${getEffectiveBackendOrigin()}/${t}`;
  // Chemin relatif type "radio/logo.png" → préfixer par l'origine et /uploads/
  if (/\.(png|jpe?g|gif|webp|svg|ico)(\?|$)/i.test(t) || /^[a-z0-9_-]+\//i.test(t)) {
    return `${getEffectiveBackendOrigin()}/uploads/${t.replace(/^\/+/, '')}`;
  }
  return null;
}

/** URL affichable pour une affiche film/série (poster). Gère les chemins relatifs vers le backend. */
export function getPosterUrl(poster) {
  if (!poster || typeof poster !== 'string') return '';
  const t = poster.trim();
  if (!t) return '';
  if (t.startsWith('http://') || t.startsWith('https://')) return t;
  if (t.startsWith('/')) return `${getEffectiveBackendOrigin()}${t}`;
  if (t.startsWith('uploads/')) return `${getEffectiveBackendOrigin()}/${t}`;
  return poster;
}

/**
 * URL de lecture pour un fichier audio (MP3, etc.) de la programmation radio.
 * Les chemins relatifs (/uploads/audio/...) sont résolus vers le backend pour le streaming.
 * En dev : les URLs absolues pointant vers /uploads/audio/... sont réécrites vers l'origine courante
 * pour que la lecture passe par le proxy (backend local), évitant CORS et erreurs de lecture.
 * 100% offline : héberger l'interface utilisateur et l'API sur le même serveur (même origine).
 */
export function getRadioStreamUrl(streamUrl) {
  if (!streamUrl || typeof streamUrl !== 'string') return '';
  const t = streamUrl.trim();
  const origin = getEffectiveBackendOrigin();
  // URL absolue : en dev ou en prod si c'est un lien localhost/uploads, réécrire vers l'origine courante
  if (t.startsWith('http://') || t.startsWith('https://')) {
    if (typeof window !== 'undefined') {
      try {
        const u = new URL(t);
        const pathname = u.pathname.replace(/\/+/g, '/');
        const isBackendUpload = /^\/uploads\/audio\/.+/.test(pathname) || /^\/audio\/.+/.test(pathname);
        const isLocalhost = u.hostname === 'localhost' || u.hostname === '127.0.0.1';
        if (import.meta.env.DEV || isLocalhost || isBackendUpload) {
          if (/^\/uploads\/audio\/.+/.test(pathname)) return `${origin}${pathname}`;
          if (/^\/audio\/.+/.test(pathname)) return `${origin}/uploads${pathname}`;
          if (isLocalhost) return `${origin}${pathname}`;
        }
      } catch (_) {}
    }
    return t;
  }
  const path = t.startsWith('/') ? t : `/${t}`;
  return `${origin}${path}`;
}

/**
 * Retourne l’URL du serveur de streaming pour une vidéo.
 * - Les vidéos hébergées sur le backend passent par GET /api/stream/video/:filename (Range, seek).
 * - Les URLs externes (YouTube, CDN, etc.) sont renvoyées telles quelles.
 */
export function getStreamingVideoUrl(videoUrl) {
  if (!videoUrl || typeof videoUrl !== 'string') return '';
  let trimmed = videoUrl.trim().replace(/\\/g, '/').replace(/\/+/g, '/');

  if (trimmed.startsWith('blob:')) return '';

  let filename = '';
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const pathname = new URL(trimmed).pathname.replace(/\/+/g, '/');
      const match =
        pathname.match(/\/uploads\/videos\/([^/]+)$/) ||
        pathname.match(/\/videos\/([^/]+)$/) ||
        pathname.match(/\/api\/stream\/video\/([^/]+)$/);
      if (match) {
        try {
          filename = decodeURIComponent(match[1]);
        } catch {
          filename = match[1];
        }
      }
    } catch {
      // invalid URL
    }
  }
  if (!filename) {
    const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    const match =
      path.match(/\/uploads\/videos\/([^/]+)$/) ||
      path.match(/\/videos\/([^/]+)$/) ||
      path.match(/\/api\/stream\/video\/([^/]+)$/);
    if (match) {
      try {
        filename = decodeURIComponent(match[1]);
      } catch {
        filename = match[1];
      }
    }
  }
  if (!filename && trimmed.length > 0 && /\.(mp4|webm|ogg|mov|m4v)$/i.test(trimmed)) {
    const base = trimmed.includes('/') ? trimmed.replace(/^.*\//, '').trim() : trimmed;
    if (base) {
      try {
        filename = decodeURIComponent(base);
      } catch {
        filename = base;
      }
    }
  }

  if (filename) {
    const origin = getEffectiveBackendOrigin();
    // Préférer /uploads/videos/ quand Nginx sert les uploads en statique (démarrage plus rapide)
    if (import.meta.env.VITE_STREAM_VIA_UPLOADS !== '0') {
      return `${origin}/uploads/videos/${encodeURIComponent(filename)}`;
    }
    return `${origin}/api/stream/video/${encodeURIComponent(filename)}`;
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;

  const origin = getEffectiveBackendOrigin();
  return `${origin}${trimmed.startsWith('/') ? trimmed : `/${trimmed}`}`;
}

/**
 * URL HLS dérivée à partir d'une URL vidéo MP4 (convention backend).
 * /uploads/videos/foo.mp4 → /uploads/videos_hls/foo/playlist.m3u8
 * Retourne null si l'URL ne correspond pas à une vidéo locale.
 */
export function getHlsUrlFromVideoUrl(videoUrl) {
  if (!videoUrl || typeof videoUrl !== 'string') return null;
  const trimmed = videoUrl.trim();
  const match = trimmed.match(/\/uploads\/videos\/([^/]+)$/i) || trimmed.match(/\/videos\/([^/]+)$/i);
  if (!match) return null;
  const filename = match[1];
  const base = filename.replace(/\.[^.]+$/, '');
  const safeName = base.replace(/[^a-zA-Z0-9_-]/g, '_');
  const origin = trimmed.startsWith('http') ? (() => { try { return new URL(trimmed).origin; } catch { return getEffectiveBackendOrigin(); } })() : getEffectiveBackendOrigin();
  return `${origin}/uploads/videos_hls/${safeName}/playlist.m3u8`;
}
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Silently handle network errors in demo mode
    if (error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED') {
      // Backend not available, return empty response for demo mode
      return Promise.reject(error);
    }
    
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      // Optionally redirect to login
    }
    
    // For 500+ errors: attach a clearer message and log for debugging
    if (error.response?.status >= 500) {
      const url = error.config?.baseURL && error.config?.url
        ? `${error.config.baseURL}${error.config.url}`
        : error.config?.url || 'requête inconnue';
      const serverMsg = error.response?.data?.message || error.response?.data?.error;
      const detail = serverMsg ? ` — ${serverMsg}` : '';
      error.userMessage = `Erreur serveur (${error.response.status}) sur ${url}${detail}`;
      // Ne pas polluer la console pour GET /api/notifications (backend souvent arrêté en dev)
      const isNotificationsList = /\/api\/notifications(\?|$)/.test(url || '') && (error.config?.method || 'get').toLowerCase() === 'get';
      if (import.meta.env.DEV && !isNotificationsList) {
        console.error('[API 5xx]', url, error.response?.data || error.message);
      }
      return Promise.reject(error);
    }
    
    return Promise.reject(error);
  }
);

export const apiService = {
  // Radio
  getRadioStations: (params = '') => api.get(`/radio${params ? `?${params}` : ''}`),
  getRadioStation: (id) => api.get(`/radio/${id}`),
  /** Signale qu'un auditeur rejoint ou quitte l'écoute (action: 'join' | 'leave') */
  updateRadioListeners: (stationId, action) => api.patch(`/radio/${stationId}/listeners`, { action }),
  
  // Movies & Series
  getMovies: (params = '') => api.get(`/movies?${params}`),
  getMovie: (id) => api.get(`/movies/${id}`),
  
  // Magazine
  getArticles: (params = '') => api.get(`/magazine?${params}`),
  getArticle: (id, params = '') => api.get(`/magazine/${id}${params ? `?${params}` : ''}`),
  
  // Restaurants
  getRestaurants: (params = '') => api.get(`/restaurants?${params}`),
  getRestaurant: (id) => api.get(`/restaurants/${id}`),
  
  // Shop
  getProducts: (params = '') => api.get(`/shop?${params}`),
  getProduct: (id) => api.get(`/shop/${id}`),
  getPromotions: () => api.get('/shop/promotions'),

  // WebTV (passenger app) — chaînes et programme du jour depuis la base de données
  getWebTVChannels: (params = '') => api.get(`/webtv/channels?${params}`),
  getWebTVChannel: (id, params = '') => api.get(`/webtv/channels/${id}${params ? `?${params}` : ''}`),

  // Espace Enfant
  getEnfantActivities: (params = '') => api.get(`/enfant/activities?${params}`),

  // Config bateau (public — nom, capacité, shipId pour plan du navire)
  getBoatConfig: () => api.get('/gnv/boat-config'),

  // Shipmap
  getShipmap: () => api.get('/shipmap'),
  getShipmapDecks: (params = '') => api.get(`/shipmap/decks?${params}`),

  // Banners
  getBanners: (params = '') => api.get(`/banners?${params}`),
  /** Enregistrer un affichage (impression) d'une bannière — appelé par l'app quand une bannière est visible */
  recordBannerImpression: (bannerId) => {
    const id = bannerId != null ? String(bannerId) : '';
    if (!id) return Promise.resolve();
    return api.post(`/banners/${id}/impression`).catch((err) => {
      if (import.meta.env.DEV) console.warn('[Banners] Erreur enregistrement affichage:', err?.response?.status, err?.message);
    });
  },
  /** Enregistrer un clic sur une bannière */
  recordBannerClick: (bannerId) => api.post(`/banners/${bannerId}/click`).catch(() => {}),

  /** Prochaine pub éligible (calendrier). type: 'preroll' | 'midroll'. Retourne { id, videoUrl, skipAfterSeconds } ou { videoUrl: null }. */
  getNextAd: (type, atPercent) => {
    const q = `type=${type}` + (type === 'midroll' && atPercent != null && atPercent !== '' ? `&atPercent=${encodeURIComponent(atPercent)}` : '');
    return api.get(`/ads/next?${q}`);
  },
  /** Enregistrer un affichage (impression) d'une publicité vidéo */
  recordAdImpression: (adId) => {
    const id = adId != null ? String(adId) : '';
    if (!id) return Promise.resolve();
    return api.post(`/ads/${id}/impression`).catch((err) => {
      if (import.meta.env.DEV) console.warn('[Pubs] Erreur enregistrement affichage:', err?.response?.status, err?.message);
    });
  },

  /** Config publique des pubs (cue points mid-roll : secondes et %). */
  getAdsConfig: () => api.get('/ads/config'),

  // Notifications push GNV
  getNotifications: (params = '') => api.get(`/notifications${params ? `?${params}` : ''}`),
  createNotification: (data) => api.post('/notifications', data),
  deleteNotification: (id) => api.delete(`/notifications/${id}`),
  
  // Messages
  getConversations: () => api.get('/messages'),
  getMessages: (userId) => api.get(`/messages/${userId}`),
  sendMessage: (data) => api.post('/messages', data),
  
  // Feedback
  submitFeedback: (data) => api.post('/feedback', data),
  getFeedback: (id) => api.get(`/feedback/${id}`),
  
  // Auth
  login: (credentials) => api.post('/auth/login', credentials),
  register: (userData) => api.post('/auth/register', userData),
  getProfile: () => api.get('/auth/me'),
  updateProfile: (data) => api.put('/auth/profile', data),
  changePassword: (data) => api.put('/auth/change-password', data),
  /** Données utilisateur (favoris + positions de lecture) — persistées côté serveur */
  getUserData: () => api.get('/auth/user-data'),
  putUserData: (data) => api.put('/auth/user-data', data),
  
  // Health check
  healthCheck: () => api.get('/health'),

  /** Heure serveur pour synchronisation WebTV / radio (retourne un Date ou null si erreur).
   * Essaie /time, puis /health, puis l'en-tête Date d'une requête GET /radio (toujours disponible si l'API répond).
   */
  getServerTime: async () => {
    try {
      const res = await api.get('/time');
      const data = res?.data;
      if (data?.serverTime) return new Date(data.serverTime);
      if (typeof data?.unix === 'number') return new Date(data.unix);
      if (res?.headers?.date) return new Date(res.headers.date);
    } catch (_) {}
    try {
      const res = await api.get('/health');
      const ts = res?.data?.timestamp;
      if (ts) return new Date(ts);
      if (res?.headers?.date) return new Date(res.headers.date);
    } catch (_) {}
    try {
      const res = await api.get('/radio?lang=fr');
      if (res?.headers?.date) return new Date(res.headers.date);
    } catch (_) {}
    return null;
  },
  
  // GNV - Navires (API MongoDB)
  getGNVShips: () => api.get('/gnv/ships'),
  getGNVShip: (id) => api.get(`/gnv/ships/${id}`),
  
  // Generic methods
  get: (url) => api.get(url),
  post: (url, data) => api.post(url, data),
  put: (url, data) => api.put(url, data),
  delete: (url) => api.delete(url),
};

export default api;




