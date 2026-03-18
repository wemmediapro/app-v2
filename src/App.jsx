/**
 * Point d’entrée principal de l’app passagers.
 * Logique Radio/WebTV extraite dans src/hooks/useRadio.js et src/hooks/useWebtv.js.
 */
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
// Icônes Lucide : importées dans les composants enfants (BottomNav, AppHeader, pages) pour alléger le bundle racine
import { apiService, getStreamingVideoUrl, getPosterUrl, BACKEND_ORIGIN } from "./services/apiService";
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
import { useRadio } from "./hooks/useRadio";
import { useWebtv } from "./hooks/useWebtv";
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

  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));
  const videoPositionOnFullscreenExitRef = useRef(null);
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
    const raw = (pathname || '').replace(/^\/+|\/+$/g, '') || 'home';
    const p = raw === '' ? 'home' : raw.toLowerCase();
    const map = { shop: 'shop', radio: 'radio', movies: 'movies', webtv: 'webtv', magazine: 'magazine', restaurant: 'restaurant', restaurants: 'restaurant', enfant: 'enfant', shipmap: 'shipmap', 'plan-du-navire': 'shipmap', favorites: 'favorites', notifications: 'notifications' };
    return map[p] || (p === 'home' ? 'home' : null);
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

  // === WebTV (hook useWebtv) ===
  const [isMoviesVideoPlaying, setIsMoviesVideoPlaying] = useState(false);
  const {
    selectedChannelCategory,
    setSelectedChannelCategory,
    channelCategories,
    selectedChannel,
    setSelectedChannel,
    selectedWebtvProgram,
    webtvVideoRefRef,
    setWebtvVideoRef,
    handleWebtvVideoEnded,
    handleWebtvPlayByServerTime,
    webtvVideoError,
    setWebtvVideoError,
    webtvPlaySyncing,
    isWebtvVideoPlaying,
    setIsWebtvVideoPlaying,
    webtvLoading,
    filteredChannels,
    getWebtvCategoryLabel,
  } = useWebtv(language, page, t, videoPositionOnFullscreenExitRef);
  useEffect(() => {
    const onFullscreenChange = () => {
      const fullscreenEl = document.fullscreenElement || document.webkitFullscreenElement;
      if (fullscreenEl) {
        const el = fullscreenEl.nodeName === 'VIDEO' ? fullscreenEl : null;
        const webtvEl = webtvVideoRefRef?.current;
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
        const wEl = webtvVideoRefRef?.current;
        if (current?.type === 'webtv' && wEl) {
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
  }, [webtvVideoRefRef]);

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
  const userDataLoadedFromServerRef = useRef(false);
  const syncFavoritesToServerTimeoutRef = useRef(null);

  const isAnyVideoPlaying = isWebtvVideoPlaying || isMoviesVideoPlaying;
  const {
    radioStations,
    currentRadio,
    setCurrentRadio,
    toggleRadio,
    isPlaying,
    volume,
    handleVolumeChange,
    isFavorite,
    toggleFavorite,
    radioLoading,
    getRadioLogoUrl,
    radioPlaylistTracks,
    getRadioStreamProgress,
    setAudioElement,
    audioRef,
    repeatMode,
    toggleRepeat,
    isShuffle,
    toggleShuffle
  } = useRadio(language, page, isAnyVideoPlaying);

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

  // Récupérer le programme du jour depuis la base de données quand une chaîne est sélectionnée (avec cache du timeline)
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
