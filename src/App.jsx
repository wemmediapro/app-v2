import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
// Icônes Lucide : importées dans les composants enfants (BottomNav, AppHeader, pages) pour alléger le bundle racine
import { apiService, getStreamingVideoUrl, getRadioLogoUrl, getRadioStreamUrl, getPosterUrl, BACKEND_ORIGIN } from "./services/apiService";
import { attachVideoSource } from "./utils/hlsVideo";
import { getMediaUrlForPlayback, clearOfflineCache } from "./services/offlineMedia";
import { getPlaybackStorageKey } from "./hooks/useMoviePlayback";
import { io } from "socket.io-client";
import { useLanguage } from "./contexts/LanguageContext";
import { useMagazine } from "./hooks/useMagazine";
import { useRestaurant } from "./hooks/useRestaurant";
import { useEnfant } from "./hooks/useEnfant";
import { useNotifications } from "./hooks/useNotifications";
import { useMoviesState } from "./hooks/useMoviesState";
import { useBanners } from "./hooks/useBanners";
import { useShipmap } from "./hooks/useShipmap";
import LanguageSelector from "./components/LanguageSelector";
import BottomNav from "./components/BottomNav";
import AppHeader from "./components/AppHeader";
import BannersCarousel from "./components/BannersCarousel";
import OfflineBanner from "./components/OfflineBanner";
import ConditionsGate, { CONDITIONS_ACCEPTED_KEY } from "./components/ConditionsGate";
import ErrorBoundary from "./components/ErrorBoundary";
import MainContent from "./components/MainContent";
import { gnvShipsList, currentShip } from "./data/ships";

// Image défaut 100% offline (data URI) — plus de dépendance Unsplash
const DEFAULT_RESTAURANT_IMAGE = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 400" width="800" height="400"><rect fill="%23e5e7eb" width="800" height="400"/><text x="400" y="220" font-size="24" fill="%239ca3af" text-anchor="middle" font-family="system-ui,sans-serif">Restaurant</text></svg>');

/** Découpe un numéro stocké (ex. "+33123456789") en préfixe + numéro local */
function parsePhonePrefix(phoneStr) {
  if (!phoneStr || typeof phoneStr !== 'string') return { phonePrefix: '+33', phone: '' };
  const s = phoneStr.trim().replace(/\s/g, '');
  const prefixes = ['+212', '+216', '+33', '+34', '+39'];
  for (const p of prefixes) {
    if (s.startsWith(p)) {
      return { phonePrefix: p, phone: s.slice(p.length).trim() };
    }
  }
  return { phonePrefix: '+33', phone: s };
}

function App() {
  const { t, language, changeLanguage } = useLanguage();
  const [conditionsAccepted, setConditionsAccepted] = useState(() => {
    try {
      return localStorage.getItem(CONDITIONS_ACCEPTED_KEY) === 'true';
    } catch (_) {
      return false;
    }
  });

  // Plein écran (vidéo)
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));
  useEffect(() => {
    const onFullscreenChange = () => {
      const fullscreenEl = document.fullscreenElement || document.webkitFullscreenElement;
      if (fullscreenEl) {
        const el = fullscreenEl.nodeName === 'VIDEO' ? fullscreenEl : null;
        const webtvEl = webtvVideoRefRef.current;
        const videoEl = el || webtvEl;
        if (videoEl && typeof videoEl.currentTime === 'number' && !isNaN(videoEl.currentTime)) {
          videoPositionOnFullscreenExitRef.current = { time: videoEl.currentTime, type: 'webtv' };
        }
        return;
      }
      const saved = videoPositionOnFullscreenExitRef.current;
      if (!saved) return;
      setTimeout(() => {
        const current = videoPositionOnFullscreenExitRef.current;
        if (!current) return;
        const wEl = webtvVideoRefRef.current;
        if (current.type === 'webtv' && wEl) {
          try {
            if (current.time < (wEl.duration || 0)) wEl.currentTime = current.time;
          } catch (_) {}
          videoPositionOnFullscreenExitRef.current = null;
        }
      }, 200);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
    };
  }, []);
  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // === Navigation (React Router + état page) — deep linking et historique
  const location = useLocation();
  const navigate = useNavigate();
  const pathnameToPage = (pathname) => {
    const p = (pathname || '').replace(/^\/+|\/+$/g, '') || 'home';
    const map = { shop: 'shop', radio: 'radio', movies: 'movies', webtv: 'webtv', magazine: 'magazine', restaurant: 'restaurant', restaurants: 'restaurant', enfant: 'enfant', shipmap: 'shipmap', 'plan-du-navire': 'shipmap', favorites: 'favorites', notifications: 'notifications' };
    return map[p] || (p === '' ? 'home' : null);
  };
  const pageToPathname = (p) => (p === 'home' ? '/' : `/${p}`);
  const [page, setPageState] = useState(() => pathnameToPage(location.pathname) || 'home');
  const setPage = useCallback((next) => {
    setPageState(next);
    const path = pageToPathname(next);
    if (location.pathname !== path) navigate(path, { replace: false });
  }, [navigate, location.pathname]);
  useEffect(() => {
    const next = pathnameToPage(location.pathname);
    if (next) setPageState(next);
  }, [location.pathname]);
  // Redirection des routes non implémentées (feedback, profile, signup) — audit frontend
  useEffect(() => {
    const p = (location.pathname || '').replace(/^\/+|\/+$/g, '');
    if (p === 'feedback' || p === 'profile' || p === 'signup') {
      navigate('/', { replace: true });
      setPageState('home');
    }
  }, [location.pathname, navigate]);

  // Bannières d'accueil (hook useBanners)
  const banners = useBanners(page, language);

  // === Radio state ===
  const [radioStations, setRadioStations] = useState([]);
  const [currentRadio, setCurrentRadio] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(50);
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState('off'); // 'off', 'one', 'all'
  const [isFavorite, setIsFavorite] = useState(false);
  const [audioElement, setAudioElement] = useState(null);
  const [radioLoading, setRadioLoading] = useState(true);
  /** Playlist locale (100% offline) : titres à enchaîner */
  const [radioPlaylistTracks, setRadioPlaylistTracks] = useState([]);
  const [radioPlaylistIndex, setRadioPlaylistIndex] = useState(0);

  // === Movies & Series (liste + chargement dans useMoviesState ; watchlist reste ici pour sync favoris) ===
  const {
    moviesAndSeries,
    moviesLoading,
    movieToOpenFromFavorites,
    setMovieToOpenFromFavorites,
  } = useMoviesState(language);
  const [watchlist, setWatchlist] = useState([]);

  // === Magazine (état + chargement dans useMagazine ; favoris restent dans App pour la page Favorites) ===
  const {
    magazineArticles,
    selectedArticle,
    setSelectedArticle,
    selectedCategory,
    setSelectedCategory,
    magazineSearchQuery,
    setMagazineSearchQuery,
    magazineLoading,
    magazineError,
    magazineRetryTrigger,
    setMagazineRetryTrigger,
    magazineCategories,
    filteredArticles,
    featuredArticles,
    breakingNews,
  } = useMagazine(language, t);
  const [magazineFavoritesIds, setMagazineFavoritesIds] = useState([]);

  // === Notifications (hook dédié) ===
  const { notificationsList, notificationsLoading, notificationsUnreadCount } = useNotifications(page, language);

  // === WebTV state ===
  const [tvChannels, setTvChannels] = useState([]);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [selectedChannelCategory, setSelectedChannelCategory] = useState('all');
  const [webtvLoading, setWebtvLoading] = useState(true);
  /** WebTV : programme sélectionné pour lecture en streaming (vidéos uploadées) */
  const [selectedWebtvProgram, setSelectedWebtvProgram] = useState(null);
  const [webtvPlaybackUrl, setWebtvPlaybackUrl] = useState(null);
  const [webtvVideoRef, setWebtvVideoRef] = useState(null);
  const [isWebtvVideoPlaying, setIsWebtvVideoPlaying] = useState(false);
  const [isMoviesVideoPlaying, setIsMoviesVideoPlaying] = useState(false);
  const [webtvVideoError, setWebtvVideoError] = useState(false); // erreur de chargement (tunnel, 404, etc.)
  const [webtvPlaySyncing, setWebtvPlaySyncing] = useState(false); // chargement heure serveur au clic Play
  const webtvVideoUrlLoadedRef = useRef(null);
  const webtvVideoRetryRef = useRef(0); // retry automatique une fois en cas d'erreur de chargement
  const webtvVideoSourceCleanupRef = useRef(null);
  const webtvSeekToSecondsRef = useRef(null);
  /** Page précédente pour détecter le retour sur WebTV et resynchroniser avec l'heure serveur */
  const webtvPrevPageRef = useRef(null);
  /** Cache du programme du jour (timeline) par chaîne : clé = `${channelId}-${lang}`, valeur = { schedule, programs, ... } */
  const webtvTimelineCacheRef = useRef(Object.create(null));
  const webtvVideoRefRef = useRef(null); // ref stable pour restaurer currentTime à la sortie du plein écran (mobile)
  const WEBTV_TIMELINE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  // === Chat state ===
  const [selectedChat, setSelectedChat] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [selectedChatUser, setSelectedChatUser] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [messageSearchQuery, setMessageSearchQuery] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState({});
  const [socket, setSocket] = useState(null);
  const [chatUsers, setChatUsers] = useState([]);
  const [showAddUser, setShowAddUser] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [voiceRecording, setVoiceRecording] = useState(null);
  const [pinnedMessages, setPinnedMessages] = useState([]);
  const [showPinnedMessages, setShowPinnedMessages] = useState(false);
  const [openConversationMenu, setOpenConversationMenu] = useState(null);
  const [archivedConversations, setArchivedConversations] = useState([]);
  const [mutedConversations, setMutedConversations] = useState([]);
  const [blockedUsers, setBlockedUsers] = useState([]);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const conversationMenuRefs = useRef({});
  const radioSeekToRef = useRef(null); // position en secondes pour démarrer le titre au bon endroit (synchro heure)
  const radioSeekHandledInClickRef = useRef(false); // true quand le seek+play est géré dans startRadioPlayInClickContext (évite que l'effet lance play() trop tôt)
  const radioRetryCountRef = useRef(0); // nombre de tentatives de reconnexion au stream radio
  const radioRetryTimeoutRef = useRef(null);
  const radioListenersStationIdRef = useRef(null); // id de la station pour laquelle on a envoyé "join" (pour envoyer "leave" au cleanup)
  /** Offset ms (serveur - client) pour la synchro radio : heure serveur = Date.now() + offset. Mis à jour au chargement des stations. */
  const radioServerTimeOffsetRef = useRef(null);
  /** true si on a déjà lancé la lecture auto en ouvrant la page Radio (une seule station avec programmation). */
  const radioAutoStartedRef = useRef(false);
  const audioRef = useRef(null); // ref vers l'élément Audio pour lancer play() dans le contexte du clic (autoplay)
  const videoPositionOnFullscreenExitRef = useRef(null); // { time, type: 'webtv' } après sortie plein écran
  const userDataLoadedFromServerRef = useRef(false);
  const syncFavoritesToServerTimeoutRef = useRef(null);

  // Initialize Socket.io connection (with error handling). Backend exige un token → ne pas tenter si pas de token.
  useEffect(() => {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) return;

    let newSocket = null;
    let connectTimeout;
    // URL Socket.io : dev = même origine (proxy Vite) ; prod = VITE_SOCKET_URL ou dérivé de VITE_API_URL ou window.location.origin (pas de localhost hardcodé côté navigateur).
    const socketUrl = import.meta.env.DEV
      ? ''
      : (import.meta.env.VITE_SOCKET_URL || (import.meta.env.VITE_API_URL || '').replace(/\/api\/?$/, '') || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'));

    try {
      newSocket = io(socketUrl || undefined, {
        auth: { token: token || '' },
        transports: ['websocket'],
        reconnection: false, // Disable auto-reconnection to avoid console errors
        timeout: 2000,
        autoConnect: false
      });
      
      // Try to connect with timeout
      connectTimeout = setTimeout(() => {
        if (newSocket && !newSocket.connected) {
          // Ne pas appeler disconnect() ici : la connexion n'a jamais abouti,
          // cela évite le message console "WebSocket is closed before the connection is established"
          newSocket.removeAllListeners();
          newSocket = null;
        }
      }, 2000);
      
      newSocket.connect();
    
    newSocket.on('connect', () => {
        clearTimeout(connectTimeout);
        setSocket(newSocket);
        newSocket.emit('join-room', selectedChat?.id ? `room-${selectedChat.id}` : 'general');
    });
      
      newSocket.on('connect_error', () => {
        clearTimeout(connectTimeout);
        // Backend non disponible : ne pas appeler disconnect() pour éviter le warning WebSocket en console
        if (newSocket) {
          newSocket.removeAllListeners();
          newSocket = null;
        }
      });
      
      newSocket.on('disconnect', () => {
        // Silently handle disconnection
    });
    
    newSocket.on('new-message', (message) => {
      setChatMessages(prev => [...prev, message]);
    });
    
    newSocket.on('typing', (data) => {
      setTypingUsers(prev => ({
        ...prev,
        [data.userId]: data.isTyping
      }));
    });
    
    newSocket.on('message-read', (data) => {
      setChatMessages(prev => prev.map(msg => 
        msg.id === data.messageId ? { ...msg, isRead: true } : msg
      ));
    });
      
    } catch (error) {
      // Backend not available, continue in demo mode
      if (newSocket) {
        try {
          newSocket.disconnect();
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    }
    
    return () => {
      clearTimeout(connectTimeout);
      if (newSocket) {
        try {
          if (newSocket.connected) newSocket.disconnect();
          else newSocket.removeAllListeners();
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    };
  }, []);

  // Rejoindre la room chat quand la conversation sélectionnée change (socket déjà connecté)
  useEffect(() => {
    if (!socket?.connected) return;
    const room = selectedChat?.id ? `room-${selectedChat.id}` : 'general';
    socket.emit('join-room', room);
  }, [socket, selectedChat?.id]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);
  

  // Load chat users and messages from API (with graceful fallback)
  useEffect(() => {
    const loadChatData = async () => {
      const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
      if (token) {
        try {
          const conversationsPromise = apiService.getConversations();
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), 3000)
          );
          const conversationsResponse = await Promise.race([conversationsPromise, timeoutPromise]);
          if (conversationsResponse?.data) {
            const transformedUsers = conversationsResponse.data.map((conv, index) => ({
              id: conv.user?._id || conv.userId,
              conversationId: conv._id || `conv-${index}`,
              name: `${conv.user?.firstName || ''} ${conv.user?.lastName || ''}`.trim() || 'Utilisateur',
              avatar: conv.user?.avatar || '',
              status: 'online',
              lastSeen: 'En ligne',
              isTyping: false,
              unreadCount: conv.unreadCount || 0
            }));
            setChatUsers(transformedUsers);
            return;
          }
        } catch (error) {
          const status = error.response?.status;
          const isAuthOrUnavailable = status === 401 || error.code === 'ERR_NETWORK' || error.message === 'Timeout';
          if (!isAuthOrUnavailable) {
            console.warn('Erreur lors du chargement des données de chat:', error.message);
          }
        }
      }
      setChatUsers([]);
      setChatMessages([]);
    };
    loadChatData();
  }, [selectedChat]);

  // === Shop state (favoris dans App pour Favorites + synchro ; promos home chargées à part) ===
  const [shopFavorites, setShopFavorites] = useState([]);
  const [homeShopPromotions, setHomeShopPromotions] = useState([]);

  // === Restaurant (état + chargement dans useRestaurant ; cart + favoris restent dans App) ===
  const [cart, setCart] = useState([]);
  const [restaurantFavoritesIds, setRestaurantFavoritesIds] = useState([]);
  const {
    restaurants,
    restaurantsLoading,
    restaurantSearchQuery,
    setRestaurantSearchQuery,
    selectedRestaurantCategory,
    setSelectedRestaurantCategory,
    restaurantCategories,
    filteredRestaurants,
    allPromotions,
    selectedRestaurant,
    setSelectedRestaurant,
  } = useRestaurant(language, t, restaurantFavoritesIds);

  // === Plan du navire : ID depuis boatConfig (API), puis hook useShipmap ===
  const [shipmapShipId, setShipmapShipId] = useState(7);
  useEffect(() => {
    let cancelled = false;
    apiService.getBoatConfig().then((res) => {
      if (cancelled) return;
      const data = res?.data?.data ?? res?.data ?? {};
      const id = data.shipId != null && data.shipId >= 1 ? Number(data.shipId) : 7;
      setShipmapShipId(id);
    }).catch(() => { if (!cancelled) setShipmapShipId(7); });
    return () => { cancelled = true; };
  }, []);
  const shipmap = useShipmap(language, t, shipmapShipId);
  const currentShipName = shipmap.currentShipName || currentShip.name;

  // === Espace Enfant state ===
  const [enfantFavoritesIds, setEnfantFavoritesIds] = useState([]);
  const {
    enfantActivities,
    enfantLoading,
    enfantSearchQuery,
    setEnfantSearchQuery,
    selectedEnfantCategory,
    setSelectedEnfantCategory,
    enfantCategories,
    filteredEnfantActivities,
    enfantHighlights,
    selectedActivity,
    setSelectedActivity,
  } = useEnfant(language, t, enfantFavoritesIds);

  // Recalculer les titres de pages quand la langue change
  const pageTitles = useMemo(() => ({
    home: 'GNV OnBoard',
    radio: t('radio.title'),
    movies: t('common.movies'),
    webtv: t('webtv.title'),
    magazine: t('magazine.title'),
    restaurant: t('restaurants.title'),
    enfant: t('enfant.title'),
    shop: t('shop.title'),
    favorites: t('common.myFavorites'),
    menu: t('common.dailyMenu'),
    shipmap: t('shipmap.title'),
    dutyfree: t('common.dutyFreeShop'),
    kids: t('common.kidsZone'),
    info: t('common.moreInfo'),
    profile: t('profile.title'),
    signup: t('common.signup'),
    notifications: t('notifications.title')
  }), [language, t]);

  // Clé de stockage des favoris : par profil connecté ou "guest"
  const favoritesStorageSuffix = 'guest';

  // Charger les favoris (et positions de lecture) : depuis le serveur si connecté, sinon localStorage
  useEffect(() => {
    const suffix = favoritesStorageSuffix;
    const readLocal = (baseKey, fallbackKey) => {
      try {
        const key = `${baseKey}_${suffix}`;
        let raw = localStorage.getItem(key);
        if (suffix === 'guest' && fallbackKey && (!raw || raw === '[]')) {
          const legacy = localStorage.getItem(fallbackKey);
          if (legacy) raw = legacy;
        }
        return raw ? JSON.parse(raw) : [];
      } catch (_) { return []; }
    };

    if (suffix === 'guest') {
      setMagazineFavoritesIds(readLocal('magazineFavorites', 'magazineFavorites'));
      setRestaurantFavoritesIds(readLocal('restaurantFavorites', 'restaurantFavorites'));
      setEnfantFavoritesIds(readLocal('enfantFavorites', 'enfantFavorites'));
      setWatchlist(readLocal('watchlist', null));
      try {
        const shopRaw = readLocal('shopFavorites', null);
        setShopFavorites(Array.isArray(shopRaw) ? shopRaw : []);
      } catch (_) {}
      return;
    }

    let cancelled = false;
    apiService.getUserData()
      .then((res) => {
        if (cancelled) return;
        const fav = res?.data?.favorites || {};
        const playback = res?.data?.playbackPositions || {};
        let magazineIds = Array.isArray(fav.magazineIds) ? fav.magazineIds : [];
        let restaurantIds = Array.isArray(fav.restaurantIds) ? fav.restaurantIds : [];
        let enfantIds = Array.isArray(fav.enfantIds) ? fav.enfantIds : [];
        let watchlistData = Array.isArray(fav.watchlist) ? fav.watchlist : [];
        let shopItems = Array.isArray(fav.shopItems) ? fav.shopItems : [];
        let playbackData = typeof playback === 'object' && playback !== null ? playback : {};
        const serverEmpty = magazineIds.length === 0 && restaurantIds.length === 0 && enfantIds.length === 0 && watchlistData.length === 0 && shopItems.length === 0 && Object.keys(playbackData).length === 0;
        if (serverEmpty) {
          try {
            const pre = (baseKey) => {
              try {
                const raw = localStorage.getItem(`${baseKey}_${suffix}`);
                return raw ? JSON.parse(raw) : [];
              } catch (_) { return []; }
            };
            magazineIds = pre('magazineFavorites');
            restaurantIds = pre('restaurantFavorites');
            enfantIds = pre('enfantFavorites');
            watchlistData = pre('watchlist');
            const shopRaw = pre('shopFavorites');
            shopItems = Array.isArray(shopRaw) ? shopRaw : [];
            const key = getPlaybackStorageKey(suffix);
            const rawPlay = localStorage.getItem(key);
            playbackData = rawPlay ? JSON.parse(rawPlay) : {};
            if (magazineIds.length > 0 || restaurantIds.length > 0 || enfantIds.length > 0 || watchlistData.length > 0 || shopItems.length > 0 || Object.keys(playbackData).length > 0) {
              apiService.putUserData({
                favorites: { magazineIds, restaurantIds, enfantIds, watchlist: watchlistData, shopItems },
                playbackPositions: playbackData
              }).catch(() => {});
            }
          } catch (_) {}
        }
        setMagazineFavoritesIds(magazineIds);
        setRestaurantFavoritesIds(restaurantIds);
        setEnfantFavoritesIds(enfantIds);
        setWatchlist(watchlistData);
        setShopFavorites(shopItems);
        try {
          const key = getPlaybackStorageKey(suffix);
          if (Object.keys(playbackData).length > 0 && suffix === 'guest') {
            localStorage.setItem(key, JSON.stringify(playbackData));
          }
        } catch (_) {}
        userDataLoadedFromServerRef.current = true;
      })
      .catch(() => {
        if (cancelled) return;
        // Ne pas écraser l'état si on a déjà reçu les données du serveur (getProfile ou login)
        // Pour les utilisateurs connectés : ne pas utiliser le cache navigateur pour les favoris (source = profil serveur uniquement)
        if (userDataLoadedFromServerRef.current) return;
        if (suffix !== 'guest') {
          // Utilisateur connecté : ne pas charger les favoris depuis le cache
          return;
        }
        setMagazineFavoritesIds(readLocal('magazineFavorites', null));
        setRestaurantFavoritesIds(readLocal('restaurantFavorites', null));
        setEnfantFavoritesIds(readLocal('enfantFavorites', null));
        setWatchlist(readLocal('watchlist', null));
        try {
          const shopRaw = readLocal('shopFavorites', null);
          setShopFavorites(Array.isArray(shopRaw) ? shopRaw : []);
        } catch (_) {}
      });
    return () => { cancelled = true; };
  }, [favoritesStorageSuffix]);

  useEffect(() => {
    if (favoritesStorageSuffix === 'guest') {
      userDataLoadedFromServerRef.current = false;
      return;
    }
  }, [favoritesStorageSuffix]);

  useEffect(() => {
    if (favoritesStorageSuffix === 'guest' || !userDataLoadedFromServerRef.current) return;
    if (syncFavoritesToServerTimeoutRef.current) clearTimeout(syncFavoritesToServerTimeoutRef.current);
    syncFavoritesToServerTimeoutRef.current = setTimeout(() => {
      syncFavoritesToServerTimeoutRef.current = null;
      apiService.putUserData({
        favorites: {
          magazineIds: magazineFavoritesIds,
          restaurantIds: restaurantFavoritesIds,
          enfantIds: enfantFavoritesIds,
          watchlist,
          shopItems: shopFavorites
        }
      }).catch(() => {});
    }, 1500);
    return () => {
      if (syncFavoritesToServerTimeoutRef.current) {
        clearTimeout(syncFavoritesToServerTimeoutRef.current);
        syncFavoritesToServerTimeoutRef.current = null;
      }
    };
  }, [favoritesStorageSuffix, magazineFavoritesIds, restaurantFavoritesIds, enfantFavoritesIds, watchlist, shopFavorites]);

  const syncPlaybackToServer = useCallback(() => {
    if (favoritesStorageSuffix === 'guest') return;
    try {
      const storageKey = getPlaybackStorageKey(favoritesStorageSuffix);
      const raw = localStorage.getItem(storageKey);
      const playback = raw ? JSON.parse(raw) : {};
      apiService.putUserData({ playbackPositions: playback }).catch(() => {});
    } catch (_) {}
  }, [favoritesStorageSuffix]);

  // Load radio stations from API
  useEffect(() => {
    let cancelled = false;
    const loadRadioStations = async () => {
      try {
        setRadioLoading(true);
        const response = await apiService.getRadioStations(`lang=${language}`);
        if (cancelled) return;
        const raw = response?.data;
        const data = Array.isArray(raw) ? raw : (raw?.stations || []);
        if (data && data.length > 0) {
          const transformed = data.map(station => ({
            id: station._id || station.id,
            name: station.name,
            artist: station.genre || "Live",
            genre: station.genre || "Variétés",
            description: station.description || "",
            streamUrl: station.streamUrl || "",
            programs: station.programs || [],
            playlistId: station.playlistId || "",
            logo: station.logo ?? station.logoUrl ?? station.image ?? "",
            color: station.color || "from-blue-500 to-cyan-500",
            currentlyPlaying: station.currentSong || "En direct",
            listeners: station.listeners?.toString() || "0",
            bitrate: station.bitrate || "128k"
          }));
          if (cancelled) return;
          setRadioStations(transformed);
        } else {
          if (cancelled) return;
          setRadioStations([]);
        }
        // Heure serveur : priorité à l'en-tête Date de la réponse (toujours présent si l'API répond)
        const dateHeader = response?.headers?.date;
        if (dateHeader) {
          const serverDate = new Date(dateHeader);
          if (!isNaN(serverDate.getTime())) radioServerTimeOffsetRef.current = serverDate.getTime() - Date.now();
        }
        if (radioServerTimeOffsetRef.current === null) {
          apiService.getServerTime().then((serverDate) => {
            if (serverDate) radioServerTimeOffsetRef.current = serverDate.getTime() - Date.now();
          }).catch(() => {});
        }
      } catch (error) {
        console.warn('Erreur chargement stations radio:', error);
        if (!cancelled) setRadioStations([]);
      } finally {
        if (!cancelled) setRadioLoading(false);
      }
    };
    loadRadioStations();
    return () => { cancelled = true; };
  }, [language]);

  // Radio : à l'ouverture de la page, rafraîchir l'heure serveur et (si une seule station avec programmation) lancer la lecture selon l'heure serveur
  useEffect(() => {
    if (page !== 'radio') {
      radioAutoStartedRef.current = false;
      return;
    }
    let cancelled = false;
    (async () => {
      // Toujours rafraîchir l'heure serveur avant toute décision de lecture (position, créneau)
      try {
        const d = await apiService.getServerTime();
        if (cancelled) return;
        if (d) radioServerTimeOffsetRef.current = d.getTime() - Date.now();
      } catch (_) {}
      if (cancelled) return;
      // Auto-démarrage une seule station avec programmation : s'assurer d'avoir l'offset avant de lancer
      if (radioStations.length === 1 && !currentRadio && !radioAutoStartedRef.current) {
        const station = radioStations[0];
        if (station.programs && station.programs.length > 0) {
          // Si l'offset n'a pas été mis à jour (ex: getServerTime en échec), retry une fois pour utiliser l'heure serveur au lancement
          if (radioServerTimeOffsetRef.current === null) {
            try {
              const d2 = await apiService.getServerTime();
              if (d2) radioServerTimeOffsetRef.current = d2.getTime() - Date.now();
            } catch (_) {}
          }
          if (cancelled) return;
          radioAutoStartedRef.current = true;
          toggleRadio(station);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [page, radioStations, currentRadio]);

  // === Radio functions ===
  // Initialiser l'élément audio
  useEffect(() => {
    const audio = new Audio();
    // Pas de crossOrigin pour les flux same-origin (évite blocage lecture par le navigateur)
    audio.preload = 'auto';
    audioRef.current = audio;
    setAudioElement(audio);

    return () => {
      audioRef.current = null;
      if (audio) {
        audio.pause();
        audio.src = '';
      }
    };
  }, []);

  // Gérer la lecture audio (ne pas dépendre de volume : géré par l'effet séparé ci-dessous)
  useEffect(() => {
    if (!audioElement) return;

    const normalizeStreamUrlForCompare = (url) => {
      if (!url || typeof url !== 'string') return '';
      try {
        const u = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
        return (u.pathname || '').replace(/\/+/g, '/').replace(/\/$/, '') || '/';
      } catch (_) {
        return (url.split('?')[0] || '').replace(/\/+/g, '/').replace(/\/$/, '') || '/';
      }
    };

    if (currentRadio && isPlaying && currentRadio.streamUrl) {
      const streamUrl = getRadioStreamUrl(currentRadio.streamUrl);
      if (!streamUrl) return;
      const stationId = currentRadio.id || currentRadio._id;
      if (stationId) {
        radioListenersStationIdRef.current = stationId;
        apiService.updateRadioListeners(stationId, 'join').catch(() => {});
      }
      // Ne pas réassigner src si la ressource est la même (pathname) : évite redémarrage sur mobile
      // quand l'origine ou le query string diffère (cache, redirect, http vs https).
      const currentPath = normalizeStreamUrlForCompare(audioElement.src);
      const newPath = normalizeStreamUrlForCompare(streamUrl);
      const isSameResource = currentPath === newPath && currentPath.length > 0;
      if (!isSameResource) {
        audioElement.src = streamUrl;
      }
      const seekTo = radioSeekToRef.current;
      const doSeek = () => {
        if (seekTo == null || seekTo <= 0) return;
        const dur = audioElement.duration;
        const hasValidDuration = typeof dur === 'number' && !isNaN(dur) && isFinite(dur);
        const pos = hasValidDuration ? Math.min(seekTo, dur) : seekTo;
        try {
          audioElement.currentTime = pos;
          radioSeekToRef.current = null;
        } catch (_) {}
      };
      const onCanPlay = () => {
        radioRetryCountRef.current = 0;
        doSeek();
        audioElement.removeEventListener('canplay', onCanPlay);
        audioElement.removeEventListener('loadedmetadata', onCanPlay);
      };
      audioElement.addEventListener('canplay', onCanPlay);
      audioElement.addEventListener('loadedmetadata', onCanPlay);
      if (audioElement.readyState >= 2) setTimeout(() => { doSeek(); audioElement.removeEventListener('canplay', onCanPlay); audioElement.removeEventListener('loadedmetadata', onCanPlay); }, 0);

      const maxRetries = 2;
      const retryDelayMs = 1500;
      const handleError = () => {
        if (radioRetryCountRef.current >= maxRetries) {
          console.error('Stream radio: échec après', maxRetries, 'tentatives');
          setIsPlaying(false);
          return;
        }
        radioRetryCountRef.current += 1;
        audioElement.removeEventListener('error', handleError);
        radioRetryTimeoutRef.current = setTimeout(() => {
          radioRetryTimeoutRef.current = null;
          audioElement.src = streamUrl;
          audioElement.load();
          audioElement.addEventListener('error', handleError, { once: true });
          audioElement.play().catch(() => setIsPlaying(false));
        }, retryDelayMs);
      };
      // Ne relancer que sur "error". "stalled" est normal en flux direct (buffer vide entre segments)
      // et déclenchait un reload ~toutes les 6 s → coupure / "relance" du titre (ex. Radio GNV Just Relax).
      audioElement.addEventListener('error', handleError, { once: true });

      // Ne lancer play() que si la source vient d'être mise (évite de casser la lecture déjà lancée au clic)
      // Ne pas lancer play() si le seek+play est géré dans le contexte du clic (évite lecture depuis 0 avant le qualage)
      if (!radioSeekHandledInClickRef.current && (!isSameResource || audioElement.paused)) {
        audioElement.play().catch(error => {
          if (error?.name === 'AbortError') return;
          console.error('Erreur de lecture audio:', error);
          setIsPlaying(false);
        });
      }
      return () => {
        const prevId = radioListenersStationIdRef.current;
        if (prevId) {
          radioListenersStationIdRef.current = null;
          apiService.updateRadioListeners(prevId, 'leave').catch(() => {});
        }
        if (radioRetryTimeoutRef.current) {
          clearTimeout(radioRetryTimeoutRef.current);
          radioRetryTimeoutRef.current = null;
        }
        audioElement.removeEventListener('canplay', onCanPlay);
        audioElement.removeEventListener('loadedmetadata', onCanPlay);
        audioElement.removeEventListener('error', handleError);
        // Ne pas appeler pause() ici : au clic sur une autre station, ce cleanup s'exécute
        // et couperait la lecture lancée par startRadioPlayInClickContext (contexte du clic).
        // Le pause est géré par le bloc else quand isPlaying ou currentRadio change.
      };
    } else {
      if (radioListenersStationIdRef.current) {
        const prevId = radioListenersStationIdRef.current;
        radioListenersStationIdRef.current = null;
        apiService.updateRadioListeners(prevId, 'leave').catch(() => {});
      }
      radioSeekHandledInClickRef.current = false;
      radioRetryCountRef.current = 0;
      if (radioRetryTimeoutRef.current) {
        clearTimeout(radioRetryTimeoutRef.current);
        radioRetryTimeoutRef.current = null;
      }
      audioElement.pause();
      // Ne pas appeler pause() dans le cleanup : quand on passe à "lecture", le cleanup s'exécute
      // et stoppait le son lancé par startRadioPlayInClickContext (contexte du clic).
      return () => {};
    }
  }, [currentRadio, isPlaying, audioElement]);

  // Enchaînement des titres : programmation (station.programs) ou playlist locale (playlistId)
  useEffect(() => {
    if (!audioElement || !currentRadio || radioPlaylistTracks.length === 0) return;
    const normalizeUrl = (url) => {
      if (!url || typeof url !== 'string') return '';
      try {
        const u = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
        return (u.pathname || '').replace(/\/+/g, '/').replace(/\/$/, '') || '/';
      } catch (_) {
        return (url.split('?')[0] || '').replace(/\/+/g, '/').replace(/\/$/, '') || '/';
      }
    };
    const uniqueUrls = [...new Set(radioPlaylistTracks.filter((t) => t?.streamUrl).map((t) => normalizeUrl(t.streamUrl)))];
    const isSingleStreamPlaylist = uniqueUrls.length <= 1;

    const onEnded = () => {
      // Flux unique (ex. Radio GNV) : une seule URL pour toute la grille → ne jamais avancer sur "ended"
      // (le navigateur peut émettre "ended" à chaque segment ~6 s sur les streams ICEcast/HLS).
      if (isSingleStreamPlaylist) return;

      // Sur mobile, "ended" peut être déclenché par buffer underrun ou mise en arrière-plan sans fin réelle de piste.
      const dur = audioElement.duration;
      const pos = audioElement.currentTime;
      const hasValidDuration = typeof dur === 'number' && !isNaN(dur) && isFinite(dur) && dur > 0;
      const isShortSegment = hasValidDuration && dur < 60; // < 1 min = segment/flux, pas une vraie piste
      const reallyEnded = hasValidDuration && !isShortSegment && (pos >= dur - 2);
      if (!reallyEnded) return;

      const currentNorm = normalizeUrl(currentRadio?.streamUrl);

      // Passer à la piste suivante en ignorant les null (programmes sans streamUrl)
      let nextIndex = radioPlaylistIndex + 1;
      while (nextIndex < radioPlaylistTracks.length && !radioPlaylistTracks[nextIndex]) nextIndex++;
      if (nextIndex < radioPlaylistTracks.length) {
        const nextTrack = radioPlaylistTracks[nextIndex];
        if (nextTrack) {
          if (normalizeUrl(nextTrack.streamUrl) === currentNorm) return;
          setRadioPlaylistIndex(nextIndex);
          setCurrentRadio(prev => prev ? {
            ...prev,
            streamUrl: nextTrack.streamUrl,
            currentlyPlaying: nextTrack.title || nextTrack.name,
            artist: nextTrack.artist || ''
          } : null);
        }
      } else if (repeatMode === 'all') {
        const firstIndex = radioPlaylistTracks.findIndex((t) => t != null);
        if (firstIndex >= 0) {
          const first = radioPlaylistTracks[firstIndex];
          if (first && normalizeUrl(first.streamUrl) === currentNorm) return;
          setRadioPlaylistIndex(firstIndex);
          setCurrentRadio(prev => prev ? {
            ...prev,
            streamUrl: first.streamUrl,
            currentlyPlaying: first.title || first.name,
            artist: first.artist || ''
          } : null);
        } else {
          setIsPlaying(false);
        }
      } else {
        setIsPlaying(false);
      }
    };
    audioElement.addEventListener('ended', onEnded);
    return () => audioElement.removeEventListener('ended', onEnded);
  }, [audioElement, currentRadio, radioPlaylistTracks, radioPlaylistIndex, repeatMode]);

  // Gérer le volume
  useEffect(() => {
    if (audioElement) {
      audioElement.volume = volume / 100;
    }
  }, [volume, audioElement]);

  // MediaSession : écran de verrouillage / notification mobile — toujours la station courante (évite afficher une autre station ex. Mediapro)
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.mediaSession) return;
    if (currentRadio && isPlaying) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentRadio.name || 'GNV Radio',
        artist: currentRadio.currentlyPlaying && currentRadio.currentlyPlaying !== 'En direct' ? currentRadio.currentlyPlaying : 'En direct',
        album: 'GNV OnBoard'
      });
      navigator.mediaSession.playbackState = 'playing';
    } else {
      navigator.mediaSession.playbackState = 'none';
      navigator.mediaSession.metadata = null;
    }
  }, [currentRadio, isPlaying]);

  // Quand une vidéo démarre (Films/Séries ou WebTV), arrêter la radio automatiquement
  const isAnyVideoPlaying = isWebtvVideoPlaying || isMoviesVideoPlaying;
  useEffect(() => {
    if (!isAnyVideoPlaying) return;
    setIsPlaying(false);
    if (audioElement) {
      audioElement.pause();
    }
  }, [isAnyVideoPlaying, audioElement]);

  /** Heure en secondes depuis minuit pour une date donnée (par défaut heure serveur pour la radio). */
  const getCurrentTimeSecondsFromMidnight = (date = null) => {
    const d = date != null ? date : (radioServerTimeOffsetRef.current != null
      ? new Date(Date.now() + radioServerTimeOffsetRef.current)
      : new Date());
    return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
  };

  /** Parse "HH:MM" ou "HH:MM:SS" (ou extrait de ISO) en secondes depuis minuit. */
  const parseTimeToSecondsFromMidnight = (timeStr) => {
    if (timeStr == null) return null;
    const s = typeof timeStr === 'string' ? timeStr.trim() : String(timeStr);
    if (!s) return null;
    // Extraire HH:MM ou HH:MM:SS si format ISO (ex: "2025-02-27T08:30:00.000Z")
    let timePart = s;
    const tIndex = s.indexOf('T');
    if (tIndex >= 0) {
      timePart = s.slice(tIndex + 1).replace(/\.\d+Z?$/i, '').split('Z')[0];
    }
    const parts = timePart.split(':').map(Number);
    if (parts.length < 2) return null;
    const h = parts[0] || 0;
    const m = parts[1] || 0;
    const sec = parts[2] || 0;
    return h * 3600 + m * 60 + sec;
  };

  /** Heure de fin d'un créneau en secondes. Si endTime est "00:00" et start l'après-midi/soir, on considère 24:00 (86400). */
  const segmentEndSeconds = (startSec, endSec, durationFallback) => {
    if (endSec != null) {
      if (endSec === 0 && startSec != null && startSec >= 12 * 3600) return 86400; // 00:00 = minuit suivant
      return endSec;
    }
    return startSec != null && durationFallback != null ? startSec + durationFallback : null;
  };

  /** Jour courant (serveur) au format attendu par daysOfWeek : 'sunday'..'saturday'. */
  const getServerDayName = () => {
    const d = radioServerTimeOffsetRef.current != null
      ? new Date(Date.now() + radioServerTimeOffsetRef.current)
      : new Date();
    return ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][d.getDay()];
  };

  /** Retourne true si le programme s'applique au jour donné (dayName = 'sunday'..'saturday'). */
  const programAppliesToDay = (prog, dayName) => {
    const days = prog.daysOfWeek;
    if (!days || !Array.isArray(days) || days.length === 0) return true;
    const normalized = dayName.toLowerCase();
    const longNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const shortNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const dayIndex = longNames.indexOf(normalized);
    return days.some((d) => {
      const v = String(d).toLowerCase().trim();
      if (v === normalized) return true;
      if (dayIndex >= 0 && (v === String(dayIndex) || v === shortNames[dayIndex])) return true;
      const num = parseInt(v, 10);
      if (!isNaN(num) && num >= 0 && num <= 6) return num === dayIndex;
      return false;
    });
  };

  /**
   * Principe radio :
   * - La playlist est définie par la programmation (programmes avec startTime/endTime).
   * - Quand l'utilisateur clique sur une station (ou ouvre la page Radio avec une seule station), la lecture
   *   démarre selon l'heure serveur : on détermine le créneau en cours, on lance le stream correspondant
   *   et on cale la position (seek) pour être synchronisé avec l'heure serveur — jamais depuis le début du titre.
   */
  /** Programme en cours et position (secondes) depuis le début du titre pour coïncider avec l'heure serveur.
   * Analyse les horaires de la playlist (startTime/endTime) et l'heure serveur : on ne lance jamais la lecture depuis le début du titre.
   * Retourne { index, positionInSeconds, matched }. Si aucun créneau ne correspond (ex: hors grille),
   * matched vaut false pour que la reprise ne force pas le premier programme (évite "relance boucle dès le début" sur mobile).
   */
  const getCurrentRadioProgramAndPosition = (programsWithTimes) => {
    const now = getCurrentTimeSecondsFromMidnight(); // heure serveur (offset appliqué si disponible)
    const dayName = getServerDayName();
    const withOriginalIndex = programsWithTimes.map((prog, i) => ({ prog, originalIndex: i }));
    let forToday = withOriginalIndex.filter(({ prog }) => programAppliesToDay(prog, dayName));
    if (forToday.length === 0) forToday = withOriginalIndex; // aucun programme pour ce jour -> prendre tous
    // Cas 1 : au moins un programme a startTime -> matching par plage horaire (comme le direct)
    const hasAnyStartTime = forToday.some(({ prog }) => parseTimeToSecondsFromMidnight(prog.startTime) != null);
    if (hasAnyStartTime) {
      const sortedByStart = [...forToday].sort((a, b) => {
        const sa = parseTimeToSecondsFromMidnight(a.prog.startTime);
        const sb = parseTimeToSecondsFromMidnight(b.prog.startTime);
        return (sa ?? 0) - (sb ?? 0);
      });
      const firstStart = parseTimeToSecondsFromMidnight(sortedByStart[0]?.prog?.startTime);
      const lastProg = sortedByStart[sortedByStart.length - 1];
      const lastStartParsed = parseTimeToSecondsFromMidnight(lastProg?.prog?.startTime);
      const lastEndParsed = parseTimeToSecondsFromMidnight(lastProg?.prog?.endTime);
      const lastEndSec = segmentEndSeconds(lastStartParsed, lastEndParsed, lastProg?.prog?.duration) ?? (firstStart != null && lastProg?.prog?.duration != null ? lastStartParsed + lastProg.prog.duration : null);

      for (let j = 0; j < forToday.length; j++) {
        const { prog, originalIndex: i } = forToday[j];
        const start = parseTimeToSecondsFromMidnight(prog.startTime);
        const end = parseTimeToSecondsFromMidnight(prog.endTime);
        if (start == null) continue;
        const endSec = segmentEndSeconds(start, end, prog.duration || 0);
        if (endSec == null) continue;
        if (now >= start && now < endSec) {
          const positionInSeconds = Math.min(Math.max(0, now - start), prog.duration || 0);
          return { index: i, positionInSeconds, matched: true };
        }
      }
      // Aucune plage ne contient "now" : selon l'heure serveur, boucler ou prendre la fin du dernier
      if (firstStart != null && now < firstStart) {
        // Avant le premier créneau : on joue la fin du dernier programme (synchro direct)
        const idx = lastProg?.originalIndex ?? 0;
        const dur = Math.max(0, Number(lastProg?.prog?.duration) || 0) || (lastEndSec != null && lastStartParsed != null ? lastEndSec - lastStartParsed : 60);
        return { index: idx, positionInSeconds: Math.max(1, dur - 1), matched: true };
      }
      if (lastEndSec != null && now >= lastEndSec && firstStart != null) {
        // Après le dernier créneau : on boucle sur la grille (même principe que le direct)
        const totalDuration = lastEndSec - firstStart;
        if (totalDuration > 0) {
          const nowInGrid = (now - firstStart) % totalDuration;
          let acc = 0;
          for (let j = 0; j < sortedByStart.length; j++) {
            const { prog, originalIndex: i } = sortedByStart[j];
            const start = parseTimeToSecondsFromMidnight(prog.startTime);
            const end = parseTimeToSecondsFromMidnight(prog.endTime);
            const endSec = segmentEndSeconds(start, end, prog.duration || 0);
            if (start == null || endSec == null) continue;
            const segLen = endSec - start;
            if (segLen <= 0) continue;
            if (nowInGrid >= acc && nowInGrid < acc + segLen) {
              const positionInSeconds = Math.min(nowInGrid - acc, prog.duration || segLen);
              return { index: i, positionInSeconds, matched: true };
            }
            acc += segLen;
          }
        }
      }
      // Fallback : dernier programme déjà commencé, ou premier
      let best = { index: 0, positionInSeconds: 0 };
      for (let j = 0; j < forToday.length; j++) {
        const { prog, originalIndex: i } = forToday[j];
        const start = parseTimeToSecondsFromMidnight(prog.startTime);
        if (start != null && start <= now) best = { index: i, positionInSeconds: 0 };
      }
      return { ...best, matched: true };
    }
    // Cas 2 : aucun startTime -> grille virtuelle répartie sur 24h selon l'heure serveur (comme Mosaïque)
    // Répartition égale sur la journée : chaque programme couvre 86400/n secondes, pour éviter de toujours
    // retomber sur le 1er programme à 0s quand la grille est courte (ex. 10×60s → now % 600 = 0 à 10h).
    const daySeconds = 24 * 3600;
    const n = forToday.length;
    if (n === 0) return { index: 0, positionInSeconds: 0, matched: false };
    const segmentLength = daySeconds / n;
    const programIndexInDay = Math.min(Math.floor(now / segmentLength), n - 1);
    const { prog, originalIndex: i } = forToday[programIndexInDay];
    const dur = Math.max(0, Number(prog.duration) || 60);
    const positionInSegment = now - programIndexInDay * segmentLength;
    const positionInSeconds = Math.min(
      Math.floor((positionInSegment / segmentLength) * dur),
      Math.max(0, dur - 1)
    );
    return { index: i, positionInSeconds, matched: true };
  };

  /** Progression du flux radio en mode programmation (streaming) : position et durée du créneau courant selon l'heure serveur.
   * Utilisé pour afficher la barre de seek synchronisée avec la grille. Retourne null en flux direct (pas de grille). */
  const getRadioStreamProgress = () => {
    if (!currentRadio?.programs?.length || radioPlaylistTracks.length === 0) return null;
    const sorted = [...currentRadio.programs].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const { index, positionInSeconds, matched } = getCurrentRadioProgramAndPosition(sorted);
    if (!matched) return null;
    const prog = sorted[index];
    const start = parseTimeToSecondsFromMidnight(prog?.startTime);
    const endParsed = parseTimeToSecondsFromMidnight(prog?.endTime);
    const endSec = segmentEndSeconds(start, endParsed, prog?.duration);
    let durationSeconds = Math.max(0, Number(prog?.duration) || 0);
    if (durationSeconds <= 0 && start != null && endSec != null && endSec > start) durationSeconds = endSec - start;
    if (durationSeconds <= 0) durationSeconds = 60;
    return { positionSeconds: Math.min(positionInSeconds, durationSeconds), durationSeconds };
  };

  /** Lance la lecture radio dans le contexte du clic utilisateur (contourne la politique autoplay des navigateurs).
   * Si seekToSeconds > 0, attend canplay/loadedmetadata pour caler la position puis lancer play() — garantit le qualage sur l'heure serveur. */
  const startRadioPlayInClickContext = (streamUrl, seekToSeconds = null) => {
    if (!streamUrl || !audioRef.current) return;
    const audio = audioRef.current;
    try {
      audio.src = streamUrl;
      const seekPos = typeof seekToSeconds === 'number' && seekToSeconds > 0 ? seekToSeconds : null;
      if (seekPos != null) {
        const doSeekAndPlay = () => {
          try {
            const dur = audio.duration;
            const hasValidDuration = typeof dur === 'number' && !isNaN(dur) && isFinite(dur) && dur > 0;
            const pos = hasValidDuration ? Math.min(seekPos, dur) : seekPos;
            audio.currentTime = pos;
            audio.play().catch(() => setIsPlaying(false));
            // Certains fichiers ne sont seekables qu'après un court délai : réessayer une fois si on est resté à 0
            if (pos > 1 && (!hasValidDuration || pos < dur)) {
              const check = () => {
                if (audio.currentTime < 0.5 && audio.readyState >= 2) {
                  try {
                    const d = audio.duration;
                    if (typeof d === 'number' && !isNaN(d) && d > 0) audio.currentTime = Math.min(pos, d);
                  } catch (_) {}
                }
              };
              setTimeout(check, 250);
            }
          } catch (_) {
            audio.play().catch(() => setIsPlaying(false));
          }
          audio.removeEventListener('canplay', onReady);
          audio.removeEventListener('loadedmetadata', onReady);
        };
        const onReady = () => {
          radioRetryCountRef.current = 0;
          radioSeekHandledInClickRef.current = false;
          doSeekAndPlay();
        };
        audio.addEventListener('canplay', onReady, { once: true });
        audio.addEventListener('loadedmetadata', onReady, { once: true });
        if (audio.readyState >= 2) {
          setTimeout(() => {
            audio.removeEventListener('canplay', onReady);
            audio.removeEventListener('loadedmetadata', onReady);
            radioSeekHandledInClickRef.current = false;
            doSeekAndPlay();
          }, 0);
        } else {
          audio.load();
        }
      } else {
        audio.play().catch(() => setIsPlaying(false));
      }
    } catch (_) {
      setIsPlaying(false);
    }
  };

  const toggleRadio = (station) => {
    if (currentRadio && currentRadio.id === station.id) {
      if (isPlaying) {
        setIsPlaying(false);
        return;
      }
      // Reprise (Play après Pause) : réaligner la lecture sur l'heure serveur seulement si un créneau correspond
      if (station.programs && station.programs.length > 0) {
        (async () => {
          const setOffsetFromServer = async () => {
            try {
              const d = await apiService.getServerTime();
              if (d) radioServerTimeOffsetRef.current = d.getTime() - Date.now();
            } catch (_) {}
          };
          await setOffsetFromServer();
          if (radioServerTimeOffsetRef.current === null) await setOffsetFromServer();
          const sorted = [...station.programs].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        const resolveTracks = sorted.map((prog) => {
          if (prog.streamUrl) return { streamUrl: getRadioStreamUrl(prog.streamUrl), title: prog.title, artist: prog.artist || '', duration: prog.duration };
          if (prog.libraryId) {
            try {
              const lib = JSON.parse(localStorage.getItem('mp3Library') || '[]');
              const file = lib.find((f) => f.id === prog.libraryId);
              if (file && file.streamUrl) return { streamUrl: getRadioStreamUrl(file.streamUrl), title: prog.title || file.title, artist: prog.artist || file.artist || '', duration: prog.duration || file.duration };
            } catch (_) {}
          }
          return null;
        });
        const firstPlayableIndex = resolveTracks.findIndex((t) => t != null);
        if (firstPlayableIndex >= 0) {
          const { index: programIndex, positionInSeconds, matched } = getCurrentRadioProgramAndPosition(sorted);
          let track;
          let playIndex;
          if (matched) {
            track = resolveTracks[programIndex];
            playIndex = programIndex;
          }
          if (!matched || !track) {
            if (matched && !track) {
              for (let k = 1; k < resolveTracks.length; k++) {
                const nextIdx = (programIndex + k) % resolveTracks.length;
                if (resolveTracks[nextIdx]) {
                  playIndex = nextIdx;
                  track = resolveTracks[nextIdx];
                  break;
                }
              }
            }
            if (!track) {
              playIndex = Math.min(radioPlaylistIndex, resolveTracks.length - 1);
              if (playIndex < firstPlayableIndex) playIndex = firstPlayableIndex;
              track = resolveTracks[playIndex];
            }
          }
          if (!track) {
            playIndex = firstPlayableIndex;
            track = resolveTracks[playIndex];
          }
          const urlToPlay = (track && track.streamUrl) ? track.streamUrl : getRadioStreamUrl(station.streamUrl || '');
          const seekPos = (matched && track && playIndex === programIndex && positionInSeconds > 0) ? positionInSeconds : null;
          radioSeekToRef.current = seekPos;
          setRadioPlaylistTracks(resolveTracks);
          setRadioPlaylistIndex(playIndex);
          setCurrentRadio(prev => prev ? {
            ...prev,
            streamUrl: urlToPlay || (track && track.streamUrl) || prev.streamUrl,
            currentlyPlaying: (track && track.title) || prev.currentlyPlaying,
            artist: (track && track.artist) || prev.artist || ''
          } : null);
          if (urlToPlay) {
            if (seekPos != null) radioSeekHandledInClickRef.current = true;
            startRadioPlayInClickContext(urlToPlay, seekPos);
          }
          if (seekPos != null) radioSeekToRef.current = null;
          setIsPlaying(true);
        }
        })();
        return;
      }
      setIsPlaying(true);
      return;
    }
    setIsFavorite(false);
    // Nouvelle station avec programmes
    if (station.programs && station.programs.length > 0) {
      (async () => {
        const setOffsetFromServer = async () => {
          try {
            const d = await apiService.getServerTime();
            if (d) radioServerTimeOffsetRef.current = d.getTime() - Date.now();
          } catch (_) {}
        };
        await setOffsetFromServer();
        if (radioServerTimeOffsetRef.current === null) await setOffsetFromServer();
        const sorted = [...station.programs].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      // Garder le même ordre que sorted : resolveTracks[i] = piste pour sorted[i] ou null
      const resolveTracks = sorted.map((prog) => {
        if (prog.streamUrl) return { streamUrl: getRadioStreamUrl(prog.streamUrl), title: prog.title, artist: prog.artist || '', duration: prog.duration };
        if (prog.libraryId) {
          try {
            const lib = JSON.parse(localStorage.getItem('mp3Library') || '[]');
            const file = lib.find((f) => f.id === prog.libraryId);
            if (file && file.streamUrl) return { streamUrl: getRadioStreamUrl(file.streamUrl), title: prog.title || file.title, artist: prog.artist || file.artist || '', duration: prog.duration || file.duration };
          } catch (_) {}
        }
        return null;
      });
      const firstPlayableIndex = resolveTracks.findIndex((t) => t != null);
      if (firstPlayableIndex < 0) {
        setCurrentRadio({ ...station, currentlyPlaying: '—', artist: 'Aucune piste lisible' });
        setRadioPlaylistTracks([]);
        setRadioPlaylistIndex(0);
        setIsPlaying(false);
        return;
      }
      const { index: programIndex, positionInSeconds, matched } = getCurrentRadioProgramAndPosition(sorted);
      // Piste correspondant au programme courant, ou prochain programme jouable dans la grille (jamais le premier par défaut)
      let track = resolveTracks[programIndex];
      let playIndex = programIndex;
      if (!matched || !track) {
        // Créneau hors grille ou programme sans piste : prendre le *prochain* programme jouable dans l'ordre (synchro direct)
        if (matched && !track) {
          for (let k = 1; k < resolveTracks.length; k++) {
            const nextIdx = (programIndex + k) % resolveTracks.length;
            if (resolveTracks[nextIdx]) {
              playIndex = nextIdx;
              track = resolveTracks[nextIdx];
              break;
            }
          }
        }
        if (!track) {
          playIndex = firstPlayableIndex;
          track = resolveTracks[playIndex];
        }
      }
      if (!track) {
        playIndex = firstPlayableIndex;
        track = resolveTracks[playIndex];
      }
      // Seek uniquement si on joue le programme calculé pour l'heure serveur (pas un fallback)
      const seekPos = (matched && track && playIndex === programIndex && positionInSeconds > 0) ? positionInSeconds : null;
      const urlToPlay = (track && track.streamUrl) ? track.streamUrl : getRadioStreamUrl(station.streamUrl || '');
      radioSeekToRef.current = seekPos;
      setRadioPlaylistTracks(resolveTracks);
      setRadioPlaylistIndex(playIndex);
      setCurrentRadio({
        ...station,
        streamUrl: urlToPlay || (track && track.streamUrl) || station.streamUrl || '',
        currentlyPlaying: (track && track.title) || station.currentlyPlaying || '—',
        artist: (track && track.artist) || station.artist || ''
      });
      setIsPlaying(true);
      if (urlToPlay) {
        if (seekPos != null) radioSeekHandledInClickRef.current = true;
        startRadioPlayInClickContext(urlToPlay, seekPos);
      }
      if (seekPos != null) radioSeekToRef.current = null;
      })();
      return;
    }
    // Ancien mode : playlist locale (localStorage)
    if (station.playlistId) {
      try {
        const raw = localStorage.getItem('playlists');
        const playlists = raw ? JSON.parse(raw) : [];
        const playlist = playlists.find(p => p.id === station.playlistId);
        const files = playlist?.files || [];
        if (files.length === 0) {
          setCurrentRadio({ ...station, currentlyPlaying: '—', artist: 'Playlist vide' });
          setRadioPlaylistTracks([]);
          setRadioPlaylistIndex(0);
          setIsPlaying(false);
          return;
        }
        const first = files[0];
        setRadioPlaylistTracks(files);
        setRadioPlaylistIndex(0);
        setCurrentRadio({
          ...station,
          streamUrl: first.streamUrl,
          currentlyPlaying: first.title || first.name,
          artist: first.artist || ''
        });
        setIsPlaying(true);
        const urlToPlay = getRadioStreamUrl(first.streamUrl);
        if (urlToPlay) startRadioPlayInClickContext(urlToPlay);
      } catch (e) {
        setCurrentRadio(station);
        setRadioPlaylistTracks([]);
        setRadioPlaylistIndex(0);
        setIsPlaying(false);
      }
      return;
    }
    // Flux direct (URL) — ou premier programme si la station n'a pas de streamUrl direct
    setRadioPlaylistTracks([]);
    setRadioPlaylistIndex(0);
    let effectiveStation = station;
    let streamUrlToPlay = getRadioStreamUrl(station.streamUrl || '');
    if (!streamUrlToPlay && station.programs?.length > 0) {
      const sorted = [...station.programs].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      for (const prog of sorted) {
        if (prog.streamUrl) {
          streamUrlToPlay = getRadioStreamUrl(prog.streamUrl);
          effectiveStation = { ...station, streamUrl: prog.streamUrl, currentlyPlaying: prog.title || 'En direct', artist: prog.artist || '' };
          break;
        }
        if (prog.libraryId) {
          try {
            const lib = JSON.parse(localStorage.getItem('mp3Library') || '[]');
            const file = lib.find((f) => f.id === prog.libraryId);
            if (file?.streamUrl) {
              streamUrlToPlay = getRadioStreamUrl(file.streamUrl);
              effectiveStation = { ...station, streamUrl: file.streamUrl, currentlyPlaying: prog.title || file.title || 'En direct', artist: prog.artist || file.artist || '' };
              break;
            }
          } catch (_) {}
        }
      }
    }
    // En flux direct (streaming), forcer "En direct" pour éviter d'afficher le titre d'une autre station (ex. Mediapro au lieu de Mosaïque)
    if (!effectiveStation.programs?.length && !station.playlistId) {
      effectiveStation = { ...effectiveStation, id: station.id || station._id, name: station.name, currentlyPlaying: 'En direct', artist: '' };
    }
    setCurrentRadio(effectiveStation);
    setIsPlaying(true);
    if (streamUrlToPlay) startRadioPlayInClickContext(streamUrlToPlay);
  };

  const toggleRepeat = () => {
    setRepeatMode(prev => prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off');
  };

  const toggleShuffle = () => {
    setIsShuffle(!isShuffle);
  };

  const toggleFavorite = () => {
    setIsFavorite(!isFavorite);
  };

  const handleVolumeChange = (e) => {
    setVolume(parseInt(e.target.value));
  };

  // Load WebTV channels from API (base de données)
  useEffect(() => {
    let cancelled = false;
    const loadWebTVChannels = async () => {
      try {
        setWebtvLoading(true);
        const response = await apiService.getWebTVChannels(`lang=${language}`);
        if (cancelled) return;
        const list = response.data?.data ?? (Array.isArray(response.data) ? response.data : []);
        const categoryMap = { entertainment: 'divertissement', music: 'musique', kids: 'enfants', documentary: 'documentaire', actualites: 'actualites', sport: 'sport' };
        const transformed = (list || []).map(ch => ({
          id: ch._id || ch.id,
          name: ch.name || 'Chaîne',
          description: ch.description || '',
          category: categoryMap[ch.category] || ch.category || 'divertissement',
          image: ch.imageUrl || ch.logo || '',
          logo: ch.logo || '',
          streamUrl: ch.streamUrl || '',
          isLive: ch.isLive !== false,
          isActive: ch.isActive !== false,
          quality: ch.quality || 'HD',
          viewers: ch.viewers ?? 0,
          schedule: ch.schedule || [],
          programs: ch.programs || [],
        }));
        if (cancelled) return;
        setTvChannels(transformed);
      } catch (error) {
        console.warn('Erreur chargement WebTV:', error);
        if (!cancelled) setTvChannels([]);
      } finally {
        if (!cancelled) setWebtvLoading(false);
      }
    };
    loadWebTVChannels();
    return () => { cancelled = true; };
  }, [language]);

  // Récupérer le programme du jour depuis la base de données quand une chaîne est sélectionnée (avec cache du timeline)
  useEffect(() => {
    if (!selectedChannel?.id) return;
    const categoryMap = { entertainment: 'divertissement', music: 'musique', kids: 'enfants', documentary: 'documentaire', actualites: 'actualites', sport: 'sport' };
    const cacheKey = `${selectedChannel.id}-${language}`;
    const cached = webtvTimelineCacheRef.current[cacheKey];
    const now = Date.now();
    if (cached && (now - cached.fetchedAt) < WEBTV_TIMELINE_CACHE_TTL_MS) {
      setSelectedChannel(prev => prev && prev.id === selectedChannel.id ? {
        ...prev,
        schedule: Array.isArray(cached.schedule) ? cached.schedule : prev.schedule || [],
        programs: Array.isArray(cached.programs) ? cached.programs : prev.programs || [],
        name: cached.name ?? prev.name,
        description: cached.description ?? prev.description,
        category: categoryMap[cached.category] || cached.category || prev.category,
      } : prev);
      return;
    }
    let cancelled = false;
    const loadChannelSchedule = async () => {
      try {
        const response = await apiService.getWebTVChannel(selectedChannel.id, `lang=${language}`);
        if (cancelled) return;
        const ch = response.data;
        if (!ch) return;
        const schedule = Array.isArray(ch.schedule) ? ch.schedule : [];
        const programs = Array.isArray(ch.programs) ? ch.programs : [];
        webtvTimelineCacheRef.current[cacheKey] = {
          schedule,
          programs,
          name: ch.name,
          description: ch.description,
          category: ch.category,
          fetchedAt: Date.now(),
        };
        setSelectedChannel(prev => prev && prev.id === (ch._id || ch.id) ? {
          ...prev,
          schedule,
          programs,
          name: ch.name ?? prev.name,
          description: ch.description ?? prev.description,
          category: categoryMap[ch.category] || ch.category || prev.category,
        } : prev);
      } catch (err) {
        if (!cancelled) console.warn('Erreur chargement programme du jour:', err);
      }
    };
    loadChannelSchedule();
    return () => { cancelled = true; };
  }, [selectedChannel?.id, language]);

  // Réinitialiser la lecture WebTV quand on quitte la chaîne
  useEffect(() => {
    if (!selectedChannel) {
      setSelectedWebtvProgram(null);
      setWebtvPlaybackUrl(null);
      setIsWebtvVideoPlaying(false);
      setWebtvVideoError(false);
    }
  }, [selectedChannel]);

  // Au retour sur la page WebTV : resynchroniser le lecteur avec l'heure serveur (streaming depuis la playlist)
  useEffect(() => {
    const prevPage = webtvPrevPageRef.current;
    webtvPrevPageRef.current = page;
    const justEnteredWebtv = page === 'webtv' && prevPage !== 'webtv';
    if (!justEnteredWebtv || !selectedChannel?.programs?.length) return;

    const programsWithVideo = selectedChannel.programs.filter(p => (p.streamUrl && p.streamUrl.trim()) || (p.videoFile && String(p.videoFile).trim()));
    if (programsWithVideo.length === 0) return;

    let cancelled = false;
    setWebtvPlaySyncing(true);
    (async () => {
      try {
        let serverDate;
        try {
          serverDate = await apiService.getServerTime();
        } catch {
          serverDate = null;
        }
        if (cancelled) return;
        const d = serverDate || new Date();
        const nowSecs = d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
        const nowMins = d.getHours() * 60 + d.getMinutes();
        const programsWithTimes = programsWithVideo.filter(p => p.startTime || p.endTime);
        let current = null;
        let positionInSeconds = 0;
        if (programsWithTimes.length > 0) {
          for (const prog of programsWithTimes) {
            const startMins = timeToMins(prog.startTime);
            let endMins = timeToMins(prog.endTime);
            if (endMins <= startMins) endMins += 24 * 60;
            if (nowMins >= startMins && nowMins < endMins) {
              current = prog;
              const startSecs = startMins * 60;
              positionInSeconds = Math.max(0, nowSecs - startSecs);
              const maxSecs = prog.duration != null ? Number(prog.duration) : (endMins - startMins) * 60;
              positionInSeconds = Math.min(positionInSeconds, maxSecs);
              break;
            }
          }
        }
        if (!current && programsWithVideo.length > 0) current = programsWithVideo[0];
        if (!cancelled && current) {
          webtvSeekToSecondsRef.current = positionInSeconds;
          setSelectedWebtvProgram({ ...current });
          setIsWebtvVideoPlaying(true);
        }
      } finally {
        if (!cancelled) setWebtvPlaySyncing(false);
      }
    })();
    return () => { cancelled = true; };
  }, [page, selectedChannel?.id, selectedChannel?.programs]);

  // Résoudre l'URL de streaming pour le programme WebTV sélectionné (vidéos uploadées)
  useEffect(() => {
    const program = selectedWebtvProgram;
    setWebtvVideoError((prev) => (prev ? false : prev));
    // En changeant de programme (ex. fin de boucle), invalider l’URL précédente pour éviter de rejouer l’ancienne
    webtvVideoUrlLoadedRef.current = null;
    const videoUrl = program?.streamUrl || program?.videoFile || '';
    if (!videoUrl || typeof videoUrl !== 'string' || !videoUrl.trim()) {
      setWebtvPlaybackUrl(null);
      return;
    }
    const streamUrl = getStreamingVideoUrl(videoUrl.trim());
    if (!streamUrl) {
      setWebtvPlaybackUrl(videoUrl.startsWith('http') ? videoUrl : null);
      return;
    }
    setWebtvPlaybackUrl(null);
    let revoked = false;
    getMediaUrlForPlayback(streamUrl).then((url) => {
      if (!revoked) setWebtvPlaybackUrl(url);
    });
    return () => { revoked = true; };
  }, [selectedWebtvProgram?.streamUrl, selectedWebtvProgram?.videoFile]);

  // Synchroniser l'élément vidéo WebTV avec l'URL et play/pause
  useEffect(() => {
    const el = webtvVideoRef;
    const url = webtvPlaybackUrl || (selectedWebtvProgram ? getStreamingVideoUrl(selectedWebtvProgram.streamUrl || selectedWebtvProgram.videoFile || '') : null);
    if (!el) return;
    const shouldPlay = isWebtvVideoPlaying && url;
    if (shouldPlay && url) {
      const alreadyLoaded = webtvVideoUrlLoadedRef.current === url && el.readyState >= 2;
      if (alreadyLoaded) {
        el.play().catch(() => {});
        return;
      }
      webtvVideoRetryRef.current = 0;
      webtvVideoSourceCleanupRef.current?.();
      webtvVideoSourceCleanupRef.current = attachVideoSource(el, url, {
        onCanPlay: () => {
          webtvVideoUrlLoadedRef.current = url;
          const seekTo = webtvSeekToSecondsRef.current;
          if (seekTo != null && seekTo > 0) {
            el.currentTime = Math.min(seekTo, el.duration || seekTo);
            webtvSeekToSecondsRef.current = null;
          }
          const exitPos = videoPositionOnFullscreenExitRef.current;
          if (exitPos && exitPos.type === 'webtv' && el.duration && exitPos.time < el.duration) {
            el.currentTime = exitPos.time;
            videoPositionOnFullscreenExitRef.current = null;
          }
          el.play().catch(() => {});
        },
        onError: () => {
          if (webtvVideoRetryRef.current < 1) {
            webtvVideoRetryRef.current += 1;
            webtvVideoSourceCleanupRef.current?.();
            webtvVideoSourceCleanupRef.current = attachVideoSource(el, url, {
              onCanPlay: () => {
                webtvVideoUrlLoadedRef.current = url;
                const seekTo = webtvSeekToSecondsRef.current;
                if (seekTo != null && seekTo > 0) {
                  el.currentTime = Math.min(seekTo, el.duration || seekTo);
                  webtvSeekToSecondsRef.current = null;
                }
                const exitPos = videoPositionOnFullscreenExitRef.current;
                if (exitPos && exitPos.type === 'webtv' && el.duration && exitPos.time < el.duration) {
                  el.currentTime = exitPos.time;
                  videoPositionOnFullscreenExitRef.current = null;
                }
                el.play().catch(() => {});
              },
              onError: () => {
                webtvVideoUrlLoadedRef.current = null;
                setWebtvVideoError(true);
              },
            });
            if (el.readyState >= 3) el.play().catch(() => {});
          } else {
            webtvVideoUrlLoadedRef.current = null;
            setWebtvVideoError(true);
          }
        },
      });
      return () => {
        webtvVideoSourceCleanupRef.current?.();
      };
    }
    el.pause();
  }, [selectedWebtvProgram, isWebtvVideoPlaying, webtvVideoRef, webtvPlaybackUrl]);

  const channelCategories = [
    { id: 'all', nameKey: 'webtv.categories.all' },
    { id: 'actualites', nameKey: 'webtv.categories.actualites' },
    { id: 'sport', nameKey: 'webtv.categories.sport' },
    { id: 'divertissement', nameKey: 'webtv.categories.divertissement' },
    { id: 'enfants', nameKey: 'webtv.categories.enfants' },
    { id: 'musique', nameKey: 'webtv.categories.musique' },
    { id: 'documentaire', nameKey: 'webtv.categories.documentaire' }
  ];

  const normalizeWebtvCategoryId = (raw) => {
    if (!raw || typeof raw !== 'string') return '';
    const id = raw
      .toLowerCase()
      .trim()
      .replace(/é|è|ê|ë/g, 'e')
      .replace(/à|â/g, 'a')
      .replace(/ù|û|ü/g, 'u')
      .replace(/î|ï/g, 'i')
      .replace(/ô/g, 'o')
      .replace(/ç/g, 'c')
      .replace(/\s+/g, '');
    return id || raw.toLowerCase();
  };

  const getWebtvCategoryLabel = (raw, t) => {
    const id = normalizeWebtvCategoryId(raw);
    if (!id) return raw || '';
    const key = `webtv.categories.${id}`;
    const translated = t(key);
    return translated !== key ? translated : raw;
  };

  // === WebTV functions ===
  const filteredChannels = tvChannels.filter(channel => {
    const channelCategoryId = normalizeWebtvCategoryId(channel?.category);
    const matchesCategory = selectedChannelCategory === 'all' || channelCategoryId === selectedChannelCategory;
    return matchesCategory;
  });

  const timeToMins = (t) => {
    if (!t) return 0;
    const [h, m] = String(t).trim().split(':').map(n => parseInt(n, 10) || 0);
    return h * 60 + m;
  };

  const handleWebtvPlayByServerTime = useCallback(async () => {
    if (!selectedChannel?.programs?.length) return;
    const programsWithVideo = selectedChannel.programs.filter(p => (p.streamUrl && p.streamUrl.trim()) || (p.videoFile && String(p.videoFile).trim()));
    if (programsWithVideo.length === 0) return;

    // Reprise après pause : reprendre au moment de l'arrêt, pas à l'heure serveur
    if (!isWebtvVideoPlaying && selectedWebtvProgram && webtvVideoRef && webtvVideoRef.readyState >= 2) {
      setIsWebtvVideoPlaying(true);
      return;
    }

    setWebtvPlaySyncing(true);
    setWebtvVideoError(false);
    try {
      let serverDate;
      try {
        serverDate = await apiService.getServerTime();
      } catch {
        serverDate = null;
      }
      const d = serverDate || new Date();
      const nowSecs = d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
      const nowMins = d.getHours() * 60 + d.getMinutes();
      const programsWithTimes = programsWithVideo.filter(p => p.startTime || p.endTime);
      let current = null;
      let positionInSeconds = 0;
      if (programsWithTimes.length > 0) {
        for (const prog of programsWithTimes) {
          const startMins = timeToMins(prog.startTime);
          let endMins = timeToMins(prog.endTime);
          if (endMins <= startMins) endMins += 24 * 60;
          if (nowMins >= startMins && nowMins < endMins) {
            current = prog;
            const startSecs = startMins * 60;
            positionInSeconds = Math.max(0, nowSecs - startSecs);
            const maxSecs = prog.duration != null ? Number(prog.duration) : (endMins - startMins) * 60;
            positionInSeconds = Math.min(positionInSeconds, maxSecs);
            break;
          }
        }
      }
      if (!current && programsWithVideo.length > 0) current = programsWithVideo[0];
      if (current) {
        webtvSeekToSecondsRef.current = positionInSeconds;
        setSelectedWebtvProgram({ ...current });
        setIsWebtvVideoPlaying(true);
      }
    } finally {
      setWebtvPlaySyncing(false);
    }
  }, [selectedChannel, isWebtvVideoPlaying, selectedWebtvProgram, webtvVideoRef]);

  // À la fin d'une vidéo WebTV : passer automatiquement à la suivante dans la playlist (boucle)
  const handleWebtvVideoEnded = useCallback(() => {
    if (!selectedChannel?.programs?.length) {
      setIsWebtvVideoPlaying(false);
      return;
    }
    const programsWithVideo = selectedChannel.programs.filter(p => (p.streamUrl && p.streamUrl.trim()) || (p.videoFile && String(p.videoFile).trim()));
    if (programsWithVideo.length === 0) {
      setIsWebtvVideoPlaying(false);
      return;
    }
    webtvVideoUrlLoadedRef.current = null;
    webtvVideoRetryRef.current = 0;
    const currentUrl = selectedWebtvProgram?.streamUrl || selectedWebtvProgram?.videoFile || '';
    const currentId = selectedWebtvProgram?.id || selectedWebtvProgram?._id;
    const findIndex = () => {
      for (let i = 0; i < programsWithVideo.length; i++) {
        const p = programsWithVideo[i];
        if (currentId && (p.id === currentId || p._id === currentId)) return i;
        const u = p.streamUrl || p.videoFile || '';
        if (u && currentUrl && String(u).trim() === String(currentUrl).trim()) return i;
      }
      return -1;
    };
    const idx = findIndex();
    const nextIdx = idx < 0 ? 0 : (idx + 1) % programsWithVideo.length;
    const next = programsWithVideo[nextIdx];
    setSelectedWebtvProgram({ ...next });
    setIsWebtvVideoPlaying(true);
  }, [selectedChannel, selectedWebtvProgram]);

  // (Magazine: chargement + filtres dans useMagazine)

  // === Shop data (catégories selon la langue) ===
  const shopCategories = useMemo(() => [
    { id: 'all', name: t('shop.categories.all'), icon: '🛍️' },
    { id: 'souvenirs', name: t('shop.categories.souvenirs'), icon: '🎁' },
    { id: 'dutyfree', name: t('shop.categories.dutyfree'), icon: '🍷' },
    { id: 'fashion', name: t('shop.categories.fashion'), icon: '👕' },
    { id: 'electronics', name: t('shop.categories.electronics'), icon: '📱' },
    { id: 'food', name: t('shop.categories.food'), icon: '🍯' }
  ], [t]);

  // Promos boutique pour la page d’accueil uniquement (page Shop charge les siennes via useShop)
  useEffect(() => {
    let cancelled = false;
    apiService.getPromotions()
      .then((response) => {
        if (cancelled) return;
        const data = response?.data;
        const list = Array.isArray(data) ? data : (data?.promotions || data?.data || []);
        setHomeShopPromotions((list || []).filter(p => p.isActive !== false));
      })
      .catch(() => { if (!cancelled) setHomeShopPromotions([]); });
    return () => { cancelled = true; };
  }, []);

  // === Movies & Series functions ===
  const toggleWatchlist = (movieId) => {
    const key = `watchlist_${favoritesStorageSuffix}`;
    setWatchlist(prev => {
      const next = prev.includes(movieId) ? prev.filter(id => id !== movieId) : [...prev, movieId];
      if (favoritesStorageSuffix === 'guest') try { localStorage.setItem(key, JSON.stringify(next)); } catch (_) {}
      return next;
    });
  };

  // === Chat functions ===
  const filteredChatUsers = chatUsers.filter(user => 
    user.name.toLowerCase().includes(chatSearchQuery.toLowerCase()) &&
    !archivedConversations.includes(user.id) &&
    !blockedUsers.includes(user.id)
  );
  
  const filteredArchivedConversations = chatUsers.filter(user => 
    archivedConversations.includes(user.id) &&
    user.name.toLowerCase().includes(chatSearchQuery.toLowerCase())
  );
  
  // Search for users to add to chat by phone number or email
  const searchUsers = async (query) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    
    // Check if query looks like an email (contains @)
    const isEmail = query.includes('@');
    // Check if query looks like a phone (contains mostly digits)
    const phoneNumber = query.replace(/\D/g, '');
    const isPhone = phoneNumber.length >= 3;
    
    if (!isEmail && !isPhone) {
      setSearchResults([]);
      return;
    }
    
    setIsSearchingUsers(true);
    try {
      // Search by phone number or email
      const response = await apiService.get(`/messages/users/search?q=${encodeURIComponent(query)}`);
      if (response.data) {
        const transformed = response.data.map(user => ({
          id: user._id || user.id,
          name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Utilisateur',
          avatar: user.avatar || `https://ui-avatars.com/api/?name=${user.firstName || 'User'}`,
          email: user.email,
          phone: user.phone,
          cabinNumber: user.cabinNumber,
          status: 'online',
          lastSeen: 'En ligne',
          isTyping: false,
          unreadCount: 0
        }));
        setSearchResults(transformed);
      }
    } catch (error) {
      console.error('Erreur lors de la recherche d\'utilisateurs:', error);
      // Fallback: simulate search results for demo
      if (isEmail) {
        setSearchResults([
          {
            id: 999,
            name: query.split('@')[0],
            avatar: `https://ui-avatars.com/api/?name=${query.split('@')[0]}`,
            email: query,
            phone: '0612345678',
            cabinNumber: 'A100',
            status: 'online',
            lastSeen: 'En ligne',
            isTyping: false,
            unreadCount: 0
          }
        ]);
      } else if (isPhone) {
        setSearchResults([
          {
            id: 999,
            name: `Utilisateur ${phoneNumber}`,
            avatar: `https://ui-avatars.com/api/?name=${phoneNumber}`,
            email: `user${phoneNumber}@gnv.local`,
            phone: phoneNumber,
            cabinNumber: 'A100',
            status: 'online',
            lastSeen: 'En ligne',
            isTyping: false,
            unreadCount: 0
          }
        ]);
      }
    } finally {
      setIsSearchingUsers(false);
    }
  };
  
  // Handle user search input
  useEffect(() => {
    if (showAddUser && userSearchQuery) {
      const timeoutId = setTimeout(() => {
        searchUsers(userSearchQuery);
      }, 300);
      return () => clearTimeout(timeoutId);
    } else {
      setSearchResults([]);
    }
  }, [userSearchQuery, showAddUser]);
  
  // Start new conversation with user
  const startNewChat = (user) => {
    // Check if conversation already exists
    const existingChat = chatUsers.find(u => u.id === user.id);
    
    if (existingChat) {
      // Open existing conversation
      setSelectedChat(user.id);
      setSelectedChatUser(existingChat);
    } else {
      // Add new user to chat list and start conversation
      const newUser = {
        ...user,
        unreadCount: 0
      };
      setChatUsers(prev => [newUser, ...prev]);
      setSelectedChat(user.id);
      setSelectedChatUser(newUser);
      setChatMessages([]); // Clear messages for new conversation
    }
    
    // Close add user modal
    setShowAddUser(false);
    setUserSearchQuery('');
    setSearchResults([]);
  };

  const getChatMessages = (chatId) => {
    return chatMessages.filter(msg => msg.chatId === chatId);
  };

  const getLastMessage = (chatId) => {
    const messages = getChatMessages(chatId);
    return messages[messages.length - 1];
  };

  const sendMessage = async () => {
    if (newMessage.trim() && selectedChat) {
      const newMsg = {
        id: Date.now(),
        chatId: selectedChat,
        senderId: 0, // Current user
        content: newMessage.trim(),
        timestamp: new Date().toISOString(),
        isRead: false,
        type: "text",
        attachments: [],
        reactions: []
      };
      
      // Add message locally for instant feedback
      setChatMessages(prev => [...prev, newMsg]);
      setNewMessage('');
      
      // Send via Socket.io if connected
      if (socket && socket.connected) {
        socket.emit('send-message', {
          room: `room-${typeof selectedChat === 'string' ? selectedChat : (selectedChat?.id ?? 'general')}`,
          message: newMsg
        });
      }
      
      // Also send via API
      try {
        await apiService.sendMessage({
          receiver: selectedChat,
          content: newMsg.content,
          type: 'text'
        });
      } catch (error) {
        console.error('Erreur lors de l\'envoi du message:', error);
      }
      
      // Stop typing indicator
      setIsTyping(false);
      if (socket && socket.connected && selectedChat) {
        socket.emit('typing', {
          room: `room-${typeof selectedChat === 'string' ? selectedChat : (selectedChat?.id ?? 'general')}`,
          userId: 0,
          isTyping: false
        });
      }
    }
  };
  
  const handleTyping = (e) => {
    setNewMessage(e.target.value);
    
    if (!isTyping && e.target.value.trim()) {
      setIsTyping(true);
      if (socket && socket.connected && selectedChat) {
        socket.emit('typing', {
          room: `room-${typeof selectedChat === 'string' ? selectedChat : (selectedChat?.id ?? 'general')}`,
          userId: 0,
          isTyping: true
        });
      }
    }
    
    // Clear typing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Set timeout to stop typing indicator
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      if (socket && socket.connected && selectedChat) {
        socket.emit('typing', {
          room: `room-${typeof selectedChat === 'string' ? selectedChat : (selectedChat?.id ?? 'general')}`,
          userId: 0,
          isTyping: false
        });
      }
    }, 1000);
  };
  
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const attachment = {
          type: file.type.startsWith('image/') ? 'image' : 'file',
          url: reader.result,
          name: file.name,
          size: file.size
        };
        
        const newMsg = {
          id: Date.now(),
          chatId: selectedChat,
          senderId: 0,
          content: '',
          timestamp: new Date().toISOString(),
          isRead: false,
          type: attachment.type,
          attachments: [attachment],
          reactions: []
        };
        
        setChatMessages(prev => [...prev, newMsg]);
        
        if (socket && socket.connected) {
        socket.emit('send-message', {
            room: `room-${typeof selectedChat === 'string' ? selectedChat : (selectedChat?.id ?? 'general')}`,
            message: newMsg
          });
        }
      };
      reader.readAsDataURL(file);
    }
  };
  
  const addReaction = (messageId, emoji) => {
    setChatMessages(prev => prev.map(msg => {
      if (msg.id === messageId) {
        const reactions = msg.reactions || [];
        const existingReaction = reactions.find(r => r.emoji === emoji && r.userId === 0);
        
        if (existingReaction) {
          return {
            ...msg,
            reactions: reactions.filter(r => !(r.emoji === emoji && r.userId === 0))
          };
        } else {
          return {
            ...msg,
            reactions: [...reactions, { emoji, userId: 0, timestamp: new Date().toISOString() }]
          };
        }
      }
      return msg;
    }));
  };
  
  // Voice message functions
  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        setVoiceRecording({ blob: audioBlob, url: audioUrl });
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start();
      setIsRecordingVoice(true);
    } catch (error) {
      console.error('Erreur lors du démarrage de l\'enregistrement:', error);
      alert('Impossible d\'accéder au microphone. Veuillez vérifier les permissions.');
    }
  };
  
  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecordingVoice(false);
    }
  };
  
  const sendVoiceMessage = async () => {
    if (voiceRecording && selectedChat) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const attachment = {
          type: 'voice',
          url: voiceRecording.url,
          blob: voiceRecording.blob,
          name: 'Voice message',
          duration: 0 // Could calculate duration if needed
        };
        
        const newMsg = {
          id: Date.now(),
          chatId: selectedChat,
          senderId: 0,
          content: '🎤 Message vocal',
          timestamp: new Date().toISOString(),
          isRead: false,
          type: 'voice',
          attachments: [attachment],
          reactions: []
        };
        
        setChatMessages(prev => [...prev, newMsg]);
        setVoiceRecording(null);
        setIsRecordingVoice(false);
        
        if (socket && socket.connected) {
        socket.emit('send-message', {
            room: `room-${typeof selectedChat === 'string' ? selectedChat : (selectedChat?.id ?? 'general')}`,
            message: newMsg
          });
        }
      };
      reader.readAsDataURL(voiceRecording.blob);
    }
  };
  
  const togglePinMessage = (messageId) => {
    setPinnedMessages(prev => {
      if (prev.includes(messageId)) {
        return prev.filter(id => id !== messageId);
      } else {
        return [...prev, messageId];
      }
    });
  };
  
  // Conversation management functions
  const deleteConversation = (chatId) => {
    setChatUsers(prev => prev.filter(u => u.id !== chatId));
    setChatMessages(prev => prev.filter(msg => msg.chatId !== chatId));
    if (selectedChat === chatId) {
      setSelectedChat(null);
      setSelectedChatUser(null);
    }
    setOpenConversationMenu(null);
  };
  
  const archiveConversation = (chatId) => {
    setArchivedConversations(prev => [...prev, chatId]);
    setChatUsers(prev => prev.filter(u => u.id !== chatId));
    if (selectedChat === chatId) {
      setSelectedChat(null);
      setSelectedChatUser(null);
    }
    setOpenConversationMenu(null);
  };
  
  const unarchiveConversation = (chatId) => {
    setArchivedConversations(prev => prev.filter(id => id !== chatId));
    setOpenConversationMenu(null);
  };
  
  const muteConversation = (chatId) => {
    setMutedConversations(prev => [...prev, chatId]);
    setOpenConversationMenu(null);
  };
  
  const unmuteConversation = (chatId) => {
    setMutedConversations(prev => prev.filter(id => id !== chatId));
    setOpenConversationMenu(null);
  };
  
  const markAsRead = (chatId) => {
    setChatUsers(prev => prev.map(u => 
      u.id === chatId ? { ...u, unreadCount: 0 } : u
    ));
    setChatMessages(prev => prev.map(msg => 
      msg.chatId === chatId ? { ...msg, isRead: true } : msg
    ));
    setOpenConversationMenu(null);
  };
  
  const markAsUnread = (chatId) => {
    setChatUsers(prev => prev.map(u => 
      u.id === chatId ? { ...u, unreadCount: 1 } : u
    ));
    setOpenConversationMenu(null);
  };
  
  const blockUser = (userId) => {
    setBlockedUsers(prev => [...prev, userId]);
    deleteConversation(userId);
  };
  
  const unblockUser = (userId) => {
    setBlockedUsers(prev => prev.filter(id => id !== userId));
  };
  
  // Close conversation menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (openConversationMenu) {
        const menuRef = conversationMenuRefs.current[openConversationMenu];
        if (menuRef && !menuRef.contains(event.target)) {
          setOpenConversationMenu(null);
        }
      }
    };
    
    if (openConversationMenu) {
      // Use setTimeout to avoid immediate closure
      setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 0);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [openConversationMenu]);
  
  const filteredMessages = selectedChat ? getChatMessages(selectedChat).filter(msg => {
    if (!messageSearchQuery || messageSearchQuery.trim() === '') return true;
    return msg.content && msg.content.toLowerCase().includes(messageSearchQuery.toLowerCase());
  }) : [];

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);
    
    if (diffInHours < 1) {
      return "À l'instant";
    } else if (diffInHours < 24) {
      return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
    }
  };

  // === Restaurant functions ===
  const isRestaurantFavorite = (restaurantId) => restaurantFavoritesIds.some(id => String(id) === String(restaurantId));
  const toggleRestaurantFavorite = (restaurantId) => {
    const key = `restaurantFavorites_${favoritesStorageSuffix}`;
    setRestaurantFavoritesIds(prev => {
      const next = prev.some(id => String(id) === String(restaurantId))
        ? prev.filter(id => String(id) !== String(restaurantId))
        : [...prev, String(restaurantId)];
      if (favoritesStorageSuffix === 'guest') try { localStorage.setItem(key, JSON.stringify(next)); } catch (_) {}
      return next;
    });
  };
  const restaurantFavoritesList = useMemo(
    () => restaurants.filter(r => restaurantFavoritesIds.some(id => String(id) === String(r.id))),
    [restaurants, restaurantFavoritesIds]
  );

  /** Promos : 1 resto + 1 boutique, sélection déterministe (évite re-renders et sauts visuels). */
  const homePromosCombined = useMemo(() => {
    const restAll = (allPromotions || []).map((p) => ({ ...p, _promoType: 'restaurant', _promoKey: `rest-${p.restaurant?.id ?? ''}-${p.id ?? ''}` }));
    const shopAll = (homeShopPromotions || []).map((p) => ({ ...p, _promoType: 'shop', _promoKey: `shop-${p.id ?? p._id ?? ''}` }));
    const oneRest = restAll.length > 0 ? [restAll[0]] : [];
    const oneShop = shopAll.length > 0 ? [shopAll[0]] : [];
    return [...oneRest, ...oneShop];
  }, [allPromotions, homeShopPromotions]);

  // Titre/description d'une promotion selon la langue (translations ou fallback) — mémoïsés pour limiter re-renders
  const getPromoTitle = useCallback((promo) =>
    (promo.translations && promo.translations[language] && promo.translations[language].title)
      ? promo.translations[language].title
      : (promo.title || ''),
  [language]);
  const getPromoDescription = useCallback((promo) =>
    (promo.translations && promo.translations[language] && promo.translations[language].description)
      ? promo.translations[language].description
      : (promo.description || ''),
  [language]);

  const addToCart = useCallback((item) => {
    setCart(prev => [...prev, { ...item, id: Date.now(), quantity: 1 }]);
  }, []);

  const removeFromCart = useCallback((itemId) => {
    setCart(prev => prev.filter(item => item.id !== itemId));
  }, []);

  const updateCartQuantity = useCallback((itemId, quantity) => {
    if (quantity <= 0) {
      setCart(prev => prev.filter(item => item.id !== itemId));
    } else {
      setCart(prev => prev.map(item =>
        item.id === itemId ? { ...item, quantity } : item
      ));
    }
  }, []);

  // === Shop favoris (utilisés par ShopPage, Favorites et raccourcis home) ===
  const isShopFavorite = (productId) => shopFavorites.some(p => p.id === productId);

  const toggleShopFavorite = (product) => {
    const key = `shopFavorites_${favoritesStorageSuffix}`;
    setShopFavorites(prev => {
      const next = prev.some(p => p.id === product.id) ? prev.filter(p => p.id !== product.id) : [...prev, { ...product }];
      if (favoritesStorageSuffix === 'guest') try { localStorage.setItem(key, JSON.stringify(next)); } catch (_) {}
      return next;
    });
  };

  const removeFromShopFavorites = (productId) => {
    const key = `shopFavorites_${favoritesStorageSuffix}`;
    setShopFavorites(prev => {
      const next = prev.filter(p => p.id !== productId);
      if (favoritesStorageSuffix === 'guest') try { localStorage.setItem(key, JSON.stringify(next)); } catch (_) {}
      return next;
    });
  };

  const isMagazineFavorite = (articleId) => magazineFavoritesIds.some(id => String(id) === String(articleId));
  const toggleMagazineFavorite = (article) => {
    const id = article?.id ?? article?._id;
    if (!id) return;
    const key = `magazineFavorites_${favoritesStorageSuffix}`;
    setMagazineFavoritesIds(prev => {
      const next = prev.some(i => String(i) === String(id)) ? prev.filter(i => String(i) !== String(id)) : [...prev, id];
      if (favoritesStorageSuffix === 'guest') try { localStorage.setItem(key, JSON.stringify(next)); } catch (_) {}
      return next;
    });
  };

  const isEnfantFavorite = (activityId) => enfantFavoritesIds.some(id => String(id) === String(activityId));
  const toggleEnfantFavorite = (activity) => {
    const id = activity?.id ?? activity?._id;
    if (!id) return;
    const key = `enfantFavorites_${favoritesStorageSuffix}`;
    setEnfantFavoritesIds(prev => {
      const next = prev.some(i => String(i) === String(id)) ? prev.filter(i => String(i) !== String(id)) : [...prev, id];
      if (favoritesStorageSuffix === 'guest') try { localStorage.setItem(key, JSON.stringify(next)); } catch (_) {}
      return next;
    });
  };

  // Favoris films (watchlist) — mémoïsés pour limiter les re-renders de MainContent/FavoritesPage
  const myWatchlist = useMemo(
    () => moviesAndSeries.filter(item => watchlist.includes(item.id)),
    [moviesAndSeries, watchlist]
  );

  const magazineFavoritesArticles = useMemo(
    () => magazineArticles.filter(a => magazineFavoritesIds.some(id => String(id) === String(a.id ?? a._id))),
    [magazineArticles, magazineFavoritesIds]
  );

  const enfantFavoritesActivities = useMemo(
    () => enfantActivities.filter(a => enfantFavoritesIds.some(id => String(id) === String(a.id))),
    [enfantActivities, enfantFavoritesIds]
  );

  useEffect(() => {
    if (page === 'restaurant') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [page]);

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#264FFF] to-[#264FFF]">
      <AnimatePresence mode="wait">
        {!conditionsAccepted ? (
          <ConditionsGate
            t={t}
            onAccept={() => {
              setConditionsAccepted(true);
              setPage('home');
              navigate('/', { replace: true });
            }}
          />
        ) : (
          <motion.div
            key="app"
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            className="min-h-screen w-full max-w-full flex flex-col relative bg-gray-50 px-2 sm:px-3 overflow-x-hidden pb-[max(3rem,calc(3rem+env(safe-area-inset-bottom,0px)))] sm:pb-12"
          >
            <AppHeader page={page} setPage={setPage} t={t} />

            <OfflineBanner isOnline={isOnline} t={t} />

            {/* Main with page transitions + ErrorBoundary pour isoler les erreurs de page */}
            <main className={`flex-1 p-2 sm:p-3 md:p-4 overflow-y-auto overflow-x-hidden ${!isOnline ? 'pt-[calc(7rem+env(safe-area-inset-top,0px))] sm:pt-[7.5rem] md:pt-[8rem]' : 'pt-[calc(5rem+env(safe-area-inset-top,0px))] sm:pt-[80px] md:pt-[84px]'}`}>
              <BannersCarousel
                banners={banners.homeBanners}
                bannerIndex={banners.bannerIndex}
                setBannerIndex={banners.setBannerIndex}
                getBannerImageUrl={banners.getBannerImageUrl}
                bannerViewWidth={banners.bannerViewWidth}
                backendOrigin={banners.backendOrigin}
                t={t}
                onBannerClick={banners.handleBannerClick}
              />

              <ErrorBoundary t={t} onRetry onGoHome={() => setPage('home')}>
                <MainContent
                page={page}
                setPage={setPage}
                t={t}
                language={language}
                pageTitles={pageTitles}
                homePromosCombined={homePromosCombined}
                getPromoTitle={getPromoTitle}
                getPromoDescription={getPromoDescription}
                setSelectedRestaurant={setSelectedRestaurant}
                radioStations={radioStations}
                currentRadio={currentRadio}
                toggleRadio={toggleRadio}
                isPlaying={isPlaying}
                volume={volume}
                handleVolumeChange={handleVolumeChange}
                isFavorite={isFavorite}
                toggleFavorite={toggleFavorite}
                radioLoading={radioLoading}
                getRadioLogoUrl={getRadioLogoUrl}
                radioPlaylistTracks={radioPlaylistTracks}
                getRadioStreamProgress={getRadioStreamProgress}
                moviesAndSeries={moviesAndSeries}
                moviesLoading={moviesLoading}
                watchlist={watchlist}
                toggleWatchlist={toggleWatchlist}
                favoritesStorageSuffix={favoritesStorageSuffix}
                syncPlaybackToServer={syncPlaybackToServer}
                movieToOpenFromFavorites={movieToOpenFromFavorites}
                setMovieToOpenFromFavorites={setMovieToOpenFromFavorites}
                setIsMoviesVideoPlaying={setIsMoviesVideoPlaying}
                selectedChannelCategory={selectedChannelCategory}
                setSelectedChannelCategory={setSelectedChannelCategory}
                channelCategories={channelCategories}
                selectedChannel={selectedChannel}
                setSelectedChannel={setSelectedChannel}
                selectedWebtvProgram={selectedWebtvProgram}
                webtvVideoRefRef={webtvVideoRefRef}
                setWebtvVideoRef={setWebtvVideoRef}
                handleWebtvVideoEnded={handleWebtvVideoEnded}
                handleWebtvPlayByServerTime={handleWebtvPlayByServerTime}
                webtvVideoError={webtvVideoError}
                setWebtvVideoError={setWebtvVideoError}
                webtvPlaySyncing={webtvPlaySyncing}
                setIsWebtvVideoPlaying={setIsWebtvVideoPlaying}
                webtvLoading={webtvLoading}
                filteredChannels={filteredChannels}
                getWebtvCategoryLabel={getWebtvCategoryLabel}
                magazineLoading={magazineLoading}
                magazineError={magazineError}
                setMagazineRetryTrigger={setMagazineRetryTrigger}
                selectedCategory={selectedCategory}
                setSelectedCategory={setSelectedCategory}
                magazineCategories={magazineCategories}
                filteredArticles={filteredArticles}
                featuredArticles={featuredArticles}
                breakingNews={breakingNews}
                selectedArticle={selectedArticle}
                setSelectedArticle={setSelectedArticle}
                isMagazineFavorite={isMagazineFavorite}
                toggleMagazineFavorite={toggleMagazineFavorite}
                currentShipName={currentShipName}
                restaurants={restaurants}
                restaurantSearchQuery={restaurantSearchQuery}
                setRestaurantSearchQuery={setRestaurantSearchQuery}
                selectedRestaurantCategory={selectedRestaurantCategory}
                setSelectedRestaurantCategory={setSelectedRestaurantCategory}
                restaurantCategories={restaurantCategories}
                allPromotions={allPromotions}
                filteredRestaurants={filteredRestaurants}
                restaurantsLoading={restaurantsLoading}
                selectedRestaurant={selectedRestaurant}
                DEFAULT_RESTAURANT_IMAGE={DEFAULT_RESTAURANT_IMAGE}
                isRestaurantFavorite={isRestaurantFavorite}
                toggleRestaurantFavorite={toggleRestaurantFavorite}
                cart={cart}
                addToCart={addToCart}
                enfantActivities={enfantActivities}
                enfantLoading={enfantLoading}
                selectedEnfantCategory={selectedEnfantCategory}
                setSelectedEnfantCategory={setSelectedEnfantCategory}
                enfantCategories={enfantCategories}
                enfantHighlights={enfantHighlights}
                filteredEnfantActivities={filteredEnfantActivities}
                selectedActivity={selectedActivity}
                setSelectedActivity={setSelectedActivity}
                isEnfantFavorite={isEnfantFavorite}
                toggleEnfantFavorite={toggleEnfantFavorite}
                {...shipmap}
                notificationsList={notificationsList}
                notificationsLoading={notificationsLoading}
                shopFavorites={shopFavorites}
                myWatchlist={myWatchlist}
                magazineFavoritesArticles={magazineFavoritesArticles}
                enfantFavoritesActivities={enfantFavoritesActivities}
                restaurantFavoritesList={restaurantFavoritesList}
                shopCategories={shopCategories}
                setShopFavorites={setShopFavorites}
                removeFromShopFavorites={removeFromShopFavorites}
                getPosterUrl={getPosterUrl}
              />
              </ErrorBoundary>
            </main>
          </motion.div>
        )}
      </AnimatePresence>

      <BottomNav
        page={page}
        setPage={setPage}
        t={t}
        notificationsUnreadCount={notificationsUnreadCount}
        hidden={!conditionsAccepted}
      />
    </div>
  );
}

export default App;
