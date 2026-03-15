import React, { useState, useEffect, useRef, useMemo, useCallback, lazy, Suspense } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Ship, Mail, Lock, ArrowRight, Home, Info, Radio, Clapperboard, Tv, BookOpen, Utensils, Baby, Map, ShoppingBag, Clock, Anchor, ThermometerSun, Wind, Flag, ArrowLeft, ChevronDown, Play, Pause, Volume2, Music, Heart, MoreHorizontal, Shuffle, Repeat, Mic, Star, Plus, Search, Filter, ChevronRight, ChevronLeft, Award, Calendar, Clock3, Users, User, Phone, Video, X, MapPin, Wifi, Grid3X3, ShoppingCart, Minus, Trash2, Bookmark, Image, Paperclip, Smile, Send, Pin, Check, CheckCheck, Globe, Eye, EyeOff, RefreshCw } from "lucide-react";
import { apiService, getStreamingVideoUrl, getRadioLogoUrl, getRadioStreamUrl, getPosterUrl, BACKEND_ORIGIN } from "./services/apiService";
import { attachVideoSource } from "./utils/hlsVideo";
import { getMediaUrlForPlayback, clearOfflineCache } from "./services/offlineMedia";
import { getPlaybackStorageKey } from "./hooks/useMoviePlayback";
import { io } from "socket.io-client";
import { useLanguage } from "./contexts/LanguageContext";
import LanguageSelector from "./components/LanguageSelector";
import NotificationsPage from "./pages/NotificationsPage";
const ShipmapPage = lazy(() => import("./components/ShipmapPage"));
import RadioPage from "./components/RadioPage";
import MoviesPage from "./components/MoviesPage";
import { gnvShipsList, currentShip } from "./data/ships";

const DEFAULT_RESTAURANT_IMAGE = 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&h=400&fit=crop';

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
  const CONDITIONS_ACCEPTED_KEY = 'gnv_conditions_accepted';
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
  useEffect(() => {
    const p = (location.pathname || '').replace(/^\/+|\/+$/g, '');
    if (p === 'feedback' || p === 'profile' || p === 'signup') {
      navigate('/', { replace: true });
      if (p === 'profile' || p === 'signup') setPageState('home');
    }
  }, [location.pathname, navigate]);

  // Bannières d'accueil : chargées depuis l'API (position home-top ou home), toutes affichées
  const [homeBanners, setHomeBanners] = useState([]);
  // Largeur fenêtre pour choisir image responsive (mobile / tablette / desktop) par bannière
  const [bannerViewWidth, setBannerViewWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);
  const [bannerIndex, setBannerIndex] = useState(0);

  /** URL d’image d’une bannière selon la largeur (mobile / tablette / desktop) */
  const getBannerImageUrl = (banner, w) => {
    const resolve = (u) => {
      if (!u) return undefined;
      if (u.startsWith('data:') || u.startsWith('http')) return u;
      return `${BACKEND_ORIGIN || ''}${u.startsWith('/') ? '' : '/'}${u}`;
    };
    if (w < 768) return resolve(banner.imageMobile) || resolve(banner.image);
    if (w < 1024) return resolve(banner.imageTablet) || resolve(banner.image);
    return resolve(banner.image);
  };

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

  // === Movies & Series state (liste + favoris pour Favoris page) ===
  const [moviesAndSeries, setMoviesAndSeries] = useState([]);
  const [watchlist, setWatchlist] = useState([]);
  const [movieToOpenFromFavorites, setMovieToOpenFromFavorites] = useState(null);
  const [moviesLoading, setMoviesLoading] = useState(true);
  const [moviesRefreshKey, setMoviesRefreshKey] = useState(0);

  // === Magazine state ===
  const [magazineArticles, setMagazineArticles] = useState([]);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [magazineSearchQuery, setMagazineSearchQuery] = useState('');
  const [magazineLoading, setMagazineLoading] = useState(true);
  const [magazineError, setMagazineError] = useState(null);
  const [magazineRetryTrigger, setMagazineRetryTrigger] = useState(0);
  const [magazineFavoritesIds, setMagazineFavoritesIds] = useState([]);

    // === Notifications (page passagers) ===
  const [notificationsList, setNotificationsList] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsUnreadCount, setNotificationsUnreadCount] = useState(0);

  // Charger les notifications quand on ouvre la page (avec cache-bust pour voir les nouvelles envoyées du dashboard)
  const NOTIFICATIONS_LAST_OPEN_KEY = 'gnv_notifications_last_open';
  useEffect(() => {
    if (page !== 'notifications') return;
    setNotificationsLoading(true);
    setNotificationsUnreadCount(0);
    try {
      localStorage.setItem(NOTIFICATIONS_LAST_OPEN_KEY, String(Date.now()));
    } catch (_) {}
    const lang = language === 'fr' ? 'fr' : language === 'en' ? 'en' : 'fr';
    apiService.getNotifications(`limit=30&lang=${lang}&_=${Date.now()}`)
      .then((r) => {
        const raw = r?.data;
        const list = Array.isArray(raw)
          ? raw
          : Array.isArray(raw?.data)
            ? raw.data
            : Array.isArray(raw?.notifications)
              ? raw.notifications
              : [];
        setNotificationsList(list);
      })
      .catch(() => setNotificationsList([]))
      .finally(() => setNotificationsLoading(false));
  }, [page, language]);

  // Point rouge : afficher dès qu'il y a au moins une notification (ou plus récentes que la dernière ouverture)
  useEffect(() => {
    if (page === 'notifications') return;
    const lang = language === 'fr' ? 'fr' : language === 'en' ? 'en' : 'fr';
    const fetchUnread = () => {
      apiService.getNotifications(`limit=50&lang=${lang}&_=${Date.now()}`)
        .then((r) => {
          const raw = r?.data;
          const list = Array.isArray(raw)
            ? raw
            : Array.isArray(raw?.data)
              ? raw.data
              : Array.isArray(raw?.notifications)
                ? raw.notifications
                : [];
          let lastOpen = 0;
          try {
            lastOpen = parseInt(localStorage.getItem(NOTIFICATIONS_LAST_OPEN_KEY) || '0', 10);
          } catch (_) {}
          let count;
          if (list.length === 0) {
            count = 0;
          } else if (lastOpen <= 0) {
            count = list.length;
          } else {
            count = list.filter((n) => {
              const t = n.createdAt != null ? new Date(n.createdAt).getTime() : 0;
              return !Number.isNaN(t) && t > lastOpen;
            }).length;
          }
          setNotificationsUnreadCount(count);
        })
        .catch(() => setNotificationsUnreadCount(0));
    };
    fetchUnread();
    const t1 = setTimeout(fetchUnread, 800);
    const interval = setInterval(fetchUnread, 5 * 1000); // 5 s pour que le point rouge apparaisse vite après envoi depuis le dashboard
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') fetchUnread();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      clearTimeout(t1);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [page, language]);

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

  // Initialize Socket.io connection (with error handling)
  useEffect(() => {
    let newSocket = null;
    let connectTimeout;
    // En dev : même origine pour passer par le proxy Vite (/socket.io → backend). En prod : VITE_SOCKET_URL ou origine API.
    const socketUrl = import.meta.env.DEV
      ? ''
      : (import.meta.env.VITE_SOCKET_URL || (import.meta.env.VITE_API_URL || '').replace(/\/api\/?$/, '') || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'));

    try {
      const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
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
      console.log('Connected to chat server');
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

  // Bannière : charger depuis l'API pour la page courante (position home-top ou home), affichée sur toutes les pages
  // Mapping page front → id page API/dashboard (ex: restaurant → restaurants)
  const bannerPageId = page === 'restaurant' ? 'restaurants' : page;
  useEffect(() => {
    let cancelled = false;
    apiService.getBanners(`lang=${language}&page=${bannerPageId}`)
      .then((res) => {
        if (cancelled || !res?.data) return;
        const list = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
        const homePositions = ['home-top', 'home'];
        const active = list
          .filter((b) => {
            if (b.isActive === false) return false;
            const pos = String(b.position || '').toLowerCase().replace(/\s+/g, '-');
            return homePositions.includes(pos);
          })
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || new Date(b.startDate || 0) - new Date(a.startDate || 0));
        setHomeBanners(active);
      })
      .catch(() => { setHomeBanners([]); });
    return () => { cancelled = true; };
  }, [language, bannerPageId]);

  // Mettre à jour la largeur pour l’image responsive des bannières
  useEffect(() => {
    const update = () => setBannerViewWidth(window.innerWidth);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // Rotation automatique des bannières (toutes les 5 s)
  useEffect(() => {
    const n = homeBanners.length;
    if (n <= 1) return;
    const t = setInterval(() => {
      setBannerIndex((i) => (i + 1) % n);
    }, 5000);
    return () => clearInterval(t);
  }, [homeBanners.length]);

  // Réinitialiser l’index si la liste change
  useEffect(() => {
    if (homeBanners.length > 0 && bannerIndex >= homeBanners.length) setBannerIndex(0);
  }, [homeBanners.length, bannerIndex]);

  // Statistiques : enregistrer une impression quand une bannière est affichée (changement de slide ou au chargement)
  useEffect(() => {
    if (homeBanners.length === 0) return;
    const banner = homeBanners[bannerIndex];
    const id = banner != null ? (banner._id ?? banner.id) : null;
    if (id != null) apiService.recordBannerImpression(String(id));
  }, [bannerIndex, homeBanners]);

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

  // === Shop state ===
  const [shopProducts, setShopProducts] = useState([]);
  const [shopPromotions, setShopPromotions] = useState([]);
  const [shopSearchQuery, setShopSearchQuery] = useState('');
  const [selectedShopCategory, setSelectedShopCategory] = useState('all');
  const [shopFavorites, setShopFavorites] = useState([]);
  const [shopLoading, setShopLoading] = useState(true);
  const [shopError, setShopError] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedProductImageIndex, setSelectedProductImageIndex] = useState(0);

  // === Restaurant state ===
  const [restaurants, setRestaurants] = useState([]);
  const [restaurantsLoading, setRestaurantsLoading] = useState(true);
  const [restaurantSearchQuery, setRestaurantSearchQuery] = useState('');
  const [selectedRestaurantCategory, setSelectedRestaurantCategory] = useState('all');
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [cart, setCart] = useState([]);
  const [restaurantFavoritesIds, setRestaurantFavoritesIds] = useState([]);

  // === Plan du navire state (page dédiée à un seul navire) ===
  const SHIPMAP_SHIP_ID = 7; // GNV Excellent
  // === GNV Navires (depuis API MongoDB) — déclaré avant shipmapShip qui en dépend ===
  const [gnvShips, setGnvShips] = useState(gnvShipsList);
  const [currentShipName, setCurrentShipName] = useState(currentShip.name);
  const shipmapShip = useMemo(() => {
    if (gnvShips.length > 0) {
      const s = gnvShips[0];
      return { id: s.id, name: s.name, route: s.route || '' };
    }
    return { name: 'GNV Excellent', route: 'Gênes - Palerme' };
  }, [gnvShips]);
  const [shipmapDecks, setShipmapDecks] = useState([]);
  const [shipmapLoading, setShipmapLoading] = useState(true);
  const [selectedDeck, setSelectedDeck] = useState(null);
  const [shipSearchQuery, setShipSearchQuery] = useState('');
  const [shipmapDeckTypeFilter, setShipmapDeckTypeFilter] = useState('all'); // all | cabin | service | vehicle | public
  const [showShipmapAddPlanModal, setShowShipmapAddPlanModal] = useState(false);

  // === Espace Enfant state ===
  const [enfantActivities, setEnfantActivities] = useState([]);
  const [enfantLoading, setEnfantLoading] = useState(true);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [enfantSearchQuery, setEnfantSearchQuery] = useState('');
  const [selectedEnfantCategory, setSelectedEnfantCategory] = useState('all');
  const [enfantFavoritesIds, setEnfantFavoritesIds] = useState([]);

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

  const userDataLoadedFromServerRef = useRef(false);
  const syncFavoritesToServerTimeoutRef = useRef(null);

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
      try {
        const d = await apiService.getServerTime();
        if (cancelled) return;
        if (d) radioServerTimeOffsetRef.current = d.getTime() - Date.now();
      } catch (_) {}
      if (cancelled) return;
      if (radioStations.length === 1 && !currentRadio && !radioAutoStartedRef.current) {
        const station = radioStations[0];
        if (station.programs && station.programs.length > 0) {
          radioAutoStartedRef.current = true;
          toggleRadio(station);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [page, radioStations, currentRadio]);

  // Chargement des navires GNV depuis l'API (MongoDB)
  useEffect(() => {
    let cancelled = false;
    const loadShips = async () => {
      try {
        const res = await apiService.getGNVShips();
        if (cancelled) return;
        const data = res?.data?.data;
        if (Array.isArray(data) && data.length > 0) {
          setGnvShips(data.map((s) => ({
            id: s.id || s._id,
            name: s.name,
            route: s.route || (s.routes?.[0] ? `${s.routes[0].from} - ${s.routes[0].to}` : '')
          })));
          setCurrentShipName(data[0].name);
        }
      } catch (_) {
        // Garde la liste statique gnvShipsList déjà en state
      }
    };
    loadShips();
    return () => { cancelled = true; };
  }, []);

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
      const handleErrorOrStalled = () => {
        if (radioRetryCountRef.current >= maxRetries) {
          console.error('Stream radio: échec après', maxRetries, 'tentatives');
          setIsPlaying(false);
          return;
        }
        radioRetryCountRef.current += 1;
        audioElement.removeEventListener('error', handleErrorOrStalled);
        audioElement.removeEventListener('stalled', handleErrorOrStalled);
        radioRetryTimeoutRef.current = setTimeout(() => {
          radioRetryTimeoutRef.current = null;
          audioElement.src = streamUrl;
          audioElement.load();
          audioElement.addEventListener('error', handleErrorOrStalled, { once: true });
          audioElement.addEventListener('stalled', handleErrorOrStalled, { once: true });
          audioElement.play().catch(() => setIsPlaying(false));
        }, retryDelayMs);
      };
      audioElement.addEventListener('error', handleErrorOrStalled, { once: true });
      audioElement.addEventListener('stalled', handleErrorOrStalled, { once: true });

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
        audioElement.removeEventListener('error', handleErrorOrStalled);
        audioElement.removeEventListener('stalled', handleErrorOrStalled);
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
    // Cas 2 : aucun startTime -> grille virtuelle depuis 00:00, bouclée sur 24h (ordre + durées)
    let totalAcc = 0;
    for (const { prog } of forToday) totalAcc += Math.max(0, Number(prog.duration) || 60);
    const nowInGrid = totalAcc > 0 ? now % totalAcc : 0;
    let acc = 0;
    for (let j = 0; j < forToday.length; j++) {
      const { prog, originalIndex: i } = forToday[j];
      const dur = Math.max(0, Number(prog.duration) || 60);
      const endAcc = acc + dur;
      if (nowInGrid >= acc && nowInGrid < endAcc) {
        const positionInSeconds = Math.min(nowInGrid - acc, dur);
        return { index: i, positionInSeconds, matched: true };
      }
      acc = endAcc;
    }
    if (forToday.length > 0 && nowInGrid >= acc) {
      const last = forToday[forToday.length - 1];
      return { index: last.originalIndex, positionInSeconds: 0, matched: true };
    }
    return { index: 0, positionInSeconds: 0, matched: false };
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
          try {
            const d = await apiService.getServerTime();
            if (d) radioServerTimeOffsetRef.current = d.getTime() - Date.now();
          } catch (_) {}
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
        try {
          const d = await apiService.getServerTime();
          if (d) radioServerTimeOffsetRef.current = d.getTime() - Date.now();
        } catch (_) {}
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

  // Load movies and series from API (contenu selon langue) — cache-busting pour voir tout de suite les modifs faites dans le dashboard
  useEffect(() => {
    let cancelled = false;
    const loadMovies = async () => {
      try {
        setMoviesLoading(true);
        const response = await apiService.getMovies(`lang=${language}&_=${Date.now()}`);
        if (cancelled) return;
        const list = Array.isArray(response.data) ? response.data : (response.data?.data || []);
        if (list.length > 0) {
          const TMDB_POSTER_BASE = 'https://image.tmdb.org/t/p/w500';
          const transformed = list.map(movie => {
            const rawType = (movie.type || "movie").toLowerCase();
            const type = rawType === "series" ? "serie" : rawType === "movie" ? "film" : rawType;
            let poster = movie.poster;
            if (!poster && movie.tmdbPosterPath) {
              const p = String(movie.tmdbPosterPath);
              poster = TMDB_POSTER_BASE + (p.startsWith('/') ? p : `/${p}`);
            }
            if (!poster) poster = '';
            return {
              id: movie.id || movie._id,
              title: movie.title,
              type,
              genre: movie.genre?.toLowerCase() || "drame",
              year: movie.year || 2024,
              duration: movie.duration || "2h",
              rating: movie.rating || 4.0,
              description: movie.description || "",
              thumbnail: "🎬",
              poster,
              banner: "from-blue-600 to-cyan-500",
              isNew: movie.year >= 2024,
              isFeatured: movie.isPopular || false,
              videoUrl: movie.videoUrl || "",
              translations: movie.translations || undefined,
              episodes: Array.isArray(movie.episodes)
                ? movie.episodes
                    .slice()
                    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                    .map((ep) => ({
                      title: ep.title || "",
                      duration: ep.duration || "",
                      description: ep.description || "",
                      videoUrl: ep.videoUrl || "",
                      order: ep.order ?? 0
                    }))
                : []
            };
          });
          if (cancelled) return;
          setMoviesAndSeries(transformed);
        } else {
          if (cancelled) return;
          setMoviesAndSeries([]);
        }
      } catch (error) {
        console.warn('Erreur chargement films:', error);
        if (!cancelled) setMoviesAndSeries([]);
      } finally {
        if (!cancelled) setMoviesLoading(false);
      }
    };
    loadMovies();
    return () => { cancelled = true; };
  }, [language, moviesRefreshKey]);

  // Recharger les films quand l’utilisateur revient sur l’onglet (ex. après avoir modifié une vidéo dans le dashboard)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') setMoviesRefreshKey((k) => k + 1);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  // === Magazine data (catégories multilingues via t()) ===
  const magazineCategoryIds = [
    { id: 'all', icon: '📰' },
    { id: 'actualites', icon: '📢' },
    { id: 'voyage', icon: '✈️' },
    { id: 'gastronomie', icon: '🍽️' },
    { id: 'culture', icon: '🎭' },
    { id: 'divertissement', icon: '🎬' },
    { id: 'sport', icon: '⚽' },
    { id: 'lifestyle', icon: '✨' },
    { id: 'technologie', icon: '💻' }
  ];
  const magazineCategories = useMemo(
    () => magazineCategoryIds.map(({ id, icon }) => ({ id, name: t('magazine.categories.' + id), icon })),
    [t]
  );

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

  // Mapping catégories backend (Actualités, Voyage, …) vers ids frontend (actualites, voyage, …)
  const magazineCategoryBackendToId = useMemo(() => ({
    'Actualités': 'actualites', 'Voyage': 'voyage', 'Culture': 'culture', 'Gastronomie': 'gastronomie',
    'Divertissement': 'divertissement', 'Sport': 'sport', 'Lifestyle': 'lifestyle'
  }), []);

  // Load Magazine articles from API — contenu multilingue depuis la base uniquement (pas de traduction en ligne)
  useEffect(() => {
    let cancelled = false;
    const loadMagazineArticles = async () => {
      try {
        setMagazineLoading(true);
        setMagazineError(null);
        const response = await apiService.getArticles(`lang=${language}`);
        if (cancelled) return;
        const list = response.data?.data ?? (Array.isArray(response.data) ? response.data : []);
        if (list.length > 0) {
          const transformed = list.map(article => {
            try {
              const cat = magazineCategoryBackendToId[article.category] || (article.category && String(article.category).toLowerCase().normalize('NFD').replace(/\u0300/g, '').replace(/\s+/g, '')) || 'actualites';
              const locale = ({ fr: 'fr-FR', en: 'en-GB', es: 'es-ES', it: 'it-IT', de: 'de-DE', ar: 'ar-EG' }[language] || 'fr-FR');
              const publishDate = article.createdAt ? new Date(article.createdAt).toLocaleDateString(locale, { day: 'numeric', month: 'short' }) : '';
              return {
                id: article._id || article.id,
                title: article.title || '',
                category: cat,
                author: article.author || 'Auteur',
                publishDate,
                readTime: article.readTime ? `${article.readTime} min` : (article.readingTime ? `${article.readingTime} min` : '5 min'),
                image: article.imageUrl || '',
                excerpt: article.excerpt || '',
                content: article.content || article.excerpt || '',
                isFeatured: article.isFeatured || article.featured || false,
                isBreaking: article.isBreaking || false,
                tags: article.tags || [],
                views: article.views || 0,
                likes: article.likes || 0
              };
            } catch (e) {
              console.warn('Article ignoré (transformation):', article._id, e);
              return null;
            }
          }).filter(Boolean);
          if (cancelled) return;
          setMagazineArticles(transformed);
          // Mettre à jour l'article sélectionné avec la version localisée (même langue)
          const prevId = selectedArticle?.id || selectedArticle?._id;
          if (prevId) {
            const updated = transformed.find(a => String(a.id || a._id) === String(prevId));
            if (updated) setSelectedArticle({ ...updated });
            else {
              // Recharger l'article par ID avec la langue courante pour le détail
              try {
                const artRes = await apiService.getArticle(prevId, `lang=${language}`);
                const data = artRes.data?.data ?? artRes.data;
                if (data) {
                  const a = data;
                  if (cancelled) return;
                  setSelectedArticle({
                    id: a._id || a.id,
                    title: a.title,
                    category: magazineCategoryBackendToId[a.category] || (a.category && String(a.category).toLowerCase().normalize('NFD').replace(/\u0300/g, '').replace(/\s+/g, '')) || 'actualites',
                    author: a.author || 'Auteur',
                    publishDate: a.createdAt ? new Date(a.createdAt).toLocaleDateString({ fr: 'fr-FR', en: 'en-GB', es: 'es-ES', it: 'it-IT', de: 'de-DE', ar: 'ar-EG' }[language] || 'fr-FR', { day: 'numeric', month: 'short' }) : '',
                    readTime: a.readTime ? `${a.readTime} min` : (a.readingTime ? `${a.readingTime} min` : '5 min'),
                    image: a.imageUrl || selectedArticle?.image || '',
                    excerpt: a.excerpt || '',
                    content: a.content || a.excerpt || '',
                    isFeatured: a.isFeatured ?? a.featured ?? false,
                    isBreaking: a.isBreaking ?? false,
                    tags: a.tags || [],
                    views: a.views || 0,
                    likes: a.likes || 0
                  });
                }
              } catch (_) { /* garder l’article actuel en cas d’erreur */ }
            }
          }
        } else {
          if (cancelled) return;
          setMagazineArticles([]);
          setSelectedArticle(null);
        }
      } catch (error) {
        console.warn('Erreur chargement articles magazine:', error);
        if (!cancelled) setMagazineArticles([]);
        if (!cancelled) {
        const status = error?.response?.status;
        if (status === 429) {
          setMagazineError('Trop de requêtes. Veuillez réessayer dans un moment.');
        } else if (status === 404 || error?.code === 'ERR_NETWORK') {
          setMagazineError('Serveur inaccessible. Démarrez le backend (npm run dev dans backend/, port 3000).');
        } else {
          setMagazineError(error?.response?.data?.message || error?.message || 'Erreur de chargement');
        }
        }
      } finally {
        if (!cancelled) setMagazineLoading(false);
      }
    };
    loadMagazineArticles();
    return () => { cancelled = true; };
  }, [language, magazineCategoryBackendToId, magazineRetryTrigger]);

  // === Restaurant data ===
  // Catégories restaurants — libellés selon la langue
  const restaurantCategories = useMemo(() => [
    { id: 'all', name: t('restaurants.categoryAll'), icon: '🍽️' },
    { id: 'favoris', name: t('restaurants.favoris'), icon: '❤️' },
    { id: 'a-la-carte', name: t('restaurants.categoryALaCarte'), icon: '🍷' },
    { id: 'self-service', name: t('restaurants.categorySelfService'), icon: '🍲' },
    { id: 'snack-bar', name: t('restaurants.categorySnackBar'), icon: '☕' },
    { id: 'pizzeria', name: t('restaurants.categoryPizzeria'), icon: '🍕' }
  ], [t]);

  // Load restaurants from API (contenu selon langue)
  useEffect(() => {
    let cancelled = false;
    const loadRestaurants = async () => {
      try {
        setRestaurantsLoading(true);
        const response = await apiService.getRestaurants(`lang=${language}`);
        if (cancelled) return;
        const list = Array.isArray(response.data) ? response.data : (response.data?.data || []);
        const transformed = (list || []).map(r => ({
          id: r._id || r.id,
          name: r.name,
          type: r.type,
          category: (r.category || '').toLowerCase().replace(/\s+/g, '-'),
          location: r.location,
          rating: r.rating ?? 0,
          priceRange: r.priceRange || '€€',
          image: r.image,
          description: r.description || '',
          gallery: r.gallery || [],
          isOpen: r.isOpen !== false,
          openingHours: r.openingHours || '',
          specialties: Array.isArray(r.specialties) ? r.specialties : [],
          promotions: Array.isArray(r.promotions) ? r.promotions : [],
          menu: Array.isArray(r.menu) ? r.menu : []
        }));
        if (cancelled) return;
        setRestaurants(transformed);
      } catch (error) {
        console.warn('Erreur chargement restaurants:', error);
        if (!cancelled) setRestaurants([]);
      } finally {
        if (!cancelled) setRestaurantsLoading(false);
      }
    };
    loadRestaurants();
    return () => { cancelled = true; };
  }, [language]);

  // Quand la langue ou la liste restaurants change, mettre à jour selectedRestaurant
  // avec la version localisée (même id) pour que nom, description, spécialités et menu s'affichent dans la bonne langue
  useEffect(() => {
    if (!selectedRestaurant || !restaurants.length) return;
    const updated = restaurants.find(r => String(r.id) === String(selectedRestaurant.id));
    if (updated && updated !== selectedRestaurant) {
      setSelectedRestaurant(updated);
    }
  }, [language, restaurants, selectedRestaurant]);
  const enfantCategories = useMemo(() => [
    { id: 'all', name: t('enfant.categories.all'), icon: '🎯' },
    { id: 'favoris', name: t('enfant.favoris'), icon: '❤️' },
    { id: 'games', name: t('enfant.categories.games'), icon: '🎮' },
    { id: 'activities', name: t('enfant.categories.activities'), icon: '🎨' },
    { id: 'education', name: t('enfant.categories.education'), icon: '📚' },
    { id: 'entertainment', name: t('enfant.categories.entertainment'), icon: '🎪' }
  ], [t]);

  // Load Espace Enfant activities from API (contenu selon langue)
  useEffect(() => {
    let cancelled = false;
    const loadEnfantActivities = async () => {
      try {
        setEnfantLoading(true);
        const response = await apiService.getEnfantActivities(`lang=${language}`);
        if (cancelled) return;
        const list = Array.isArray(response.data) ? response.data : (response.data?.data || []);
        const transformed = (list || []).map(a => {
          const rawCat = (a.category || 'Jeux').trim();
          const categoryMap = { 'Jeux': 'games', 'Arts & Créativité': 'activities', 'Sport': 'activities', 'Créatif': 'activities', 'Éducation': 'education', 'Divertissement': 'entertainment', 'Musique': 'entertainment', 'Danse': 'entertainment', 'Lecture': 'entertainment' };
          const frontendCategory = categoryMap[rawCat] || rawCat.toLowerCase().replace(/\s+/g, '-').replace(/&/g, '-');
          return {
          id: a._id || a.id,
          name: a.name,
          type: a.type || '',
          category: frontendCategory,
          isHighlight: a.isHighlight || a.isFeatured || false,
          location: a.location || '',
          ageRange: a.ageRange || '',
          image: a.imageUrl || a.image || '',
          description: a.description || '',
          isOpen: a.isOpen !== false,
          openingHours: a.schedule || a.openingHours || '',
          features: Array.isArray(a.features) ? a.features : [],
          activities: Array.isArray(a.activities) ? a.activities : []
        };
        });
        if (cancelled) return;
        setEnfantActivities(transformed);
      } catch (error) {
        console.warn('Erreur chargement activités enfant:', error);
        if (!cancelled) setEnfantActivities([]);
      } finally {
        if (!cancelled) setEnfantLoading(false);
      }
    };
    loadEnfantActivities();
    return () => { cancelled = true; };
  }, [language]);

  // === Shop data (catégories selon la langue) ===
  const shopCategories = useMemo(() => [
    { id: 'all', name: t('shop.categories.all'), icon: '🛍️' },
    { id: 'souvenirs', name: t('shop.categories.souvenirs'), icon: '🎁' },
    { id: 'dutyfree', name: t('shop.categories.dutyfree'), icon: '🍷' },
    { id: 'fashion', name: t('shop.categories.fashion'), icon: '👕' },
    { id: 'electronics', name: t('shop.categories.electronics'), icon: '📱' },
    { id: 'food', name: t('shop.categories.food'), icon: '🍯' }
  ], [t]);

  // Libellé traduit pour le type de produit (Type / Catégorie / Produit, etc.)
  const getProductTypeLabel = useCallback((type) => {
    if (!type) return '';
    const v = String(type).trim().toLowerCase();
    if (v === 'catégorie' || v === 'category') return t('shop.typeCategory');
    if (v === 'produit' || v === 'product') return t('shop.typeProduct');
    const catIds = ['all', 'souvenirs', 'dutyfree', 'fashion', 'electronics', 'food'];
    if (catIds.includes(v)) return t('shop.categories.' + v);
    return type;
  }, [t]);

  // Load shop products from API (contenu selon langue)
  useEffect(() => {
    let cancelled = false;
    const loadShopProducts = async () => {
      try {
        setShopLoading(true);
        setShopError(null);
        const response = await apiService.getProducts(`lang=${language}`);
        if (cancelled) return;
        const productsData = Array.isArray(response.data) ? response.data : (response.data?.products || response.data?.data || []);
        if (productsData.length > 0) {
          const transformed = productsData.map(product => ({
            id: product.id || (product._id && typeof product._id === 'object' && product._id.toString ? product._id.toString() : product._id),
            name: product.name,
            type: product.type || "Produit",
            category: product.category || "souvenirs",
            price: product.price || 0,
            originalPrice: product.originalPrice || product.price || 0,
            discount: product.discount || 0,
            image: product.image || product.imageUrl || '',
            description: product.description || "",
            gallery: product.gallery || [],
            isAvailable: product.isAvailable !== false,
            stock: product.stock || 0,
            isFeatured: product.isFeatured || false,
            tag: product.tag || "",
            features: product.features || [],
            specifications: product.specifications || {}
          }));
          if (cancelled) return;
          setShopProducts(transformed);
          // Mettre à jour le produit sélectionné avec la version localisée (même langue)
          setSelectedProduct(prev => {
            if (!prev?.id) return prev;
            const updated = transformed.find(p => (p.id || p._id) === (prev.id || prev._id));
            return updated ? { ...updated } : null;
          });
        } else {
          if (cancelled) return;
          setShopProducts([]);
          setSelectedProduct(null);
        }
      } catch (error) {
        console.warn('Erreur chargement boutique:', error);
        if (!cancelled) setShopProducts([]);
        if (!cancelled) {
        const msg = error?.response?.data?.message || error?.message;
        const hint = error?.response?.status === 503
          ? 'Démarrez MongoDB (ex: docker run -d -p 27017:27017 mongo) puis redémarrez le backend.'
          : (error?.response?.status === 404 || error?.code === 'ERR_NETWORK' ? 'Démarrez le backend (npm run dev dans backend/, port 3000).' : null);
        setShopError(msg + (hint ? ` ${hint}` : ''));
        }
      } finally {
        if (!cancelled) setShopLoading(false);
      }
    };
    const loadShopPromotions = async () => {
      try {
        const response = await apiService.getPromotions();
        const data = response.data;
        const list = Array.isArray(data) ? data : (data?.promotions || data?.data || []);
        setShopPromotions(list.filter(p => p.isActive !== false));
      } catch (_) {
        setShopPromotions([]);
      }
    };
    loadShopProducts();
    loadShopPromotions();
    return () => { cancelled = true; };
  }, [language]);

  const refetchShipmap = async () => {
    setShipmapLoading(true);
    try {
      const res = await apiService.getShipmapDecks(`shipId=${SHIPMAP_SHIP_ID}&lang=${language}`);
      const list = Array.isArray(res?.data) ? res.data : res?.data?.decks || [];
      setShipmapDecks(list);
      if (list.length > 0) {
        setSelectedDeck((prev) => {
          if (!prev || !list.some(d => (d._id || d.id) === prev)) return list[0]._id || list[0].id;
          return prev;
        });
      }
    } catch (e) {
      setShipmapDecks([]);
    } finally {
      setShipmapLoading(false);
    }
  };

  // Chargement du plan du navire (API) — navire Excellence / GNV Excellent (selon langue)
  useEffect(() => {
    refetchShipmap();
  }, [language]);

  const deckTypeToIcon = (type) => {
    const t = (type || '').toLowerCase();
    if (t === 'vehicle') return '🚗';
    if (t === 'cabin') return '🛏️';
    if (t === 'service') return '🍽️';
    if (t === 'public') return '☀️';
    return '📋';
  };

  const shipDecks = useMemo(() => shipmapDecks.map((d) => ({
    id: d._id || d.id,
    name: d.name || '',
    label: (d.description || '').slice(0, 40),
    icon: deckTypeToIcon(d.type),
    type: (d.type || '').toLowerCase(),
    color: d.type === 'vehicle' ? 'bg-slate-100' : d.type === 'cabin' ? 'bg-blue-100' : d.type === 'service' ? 'bg-teal-100' : 'bg-amber-100'
  })), [shipmapDecks]);
  const shipDecksFiltered = useMemo(() => {
    if (shipmapDeckTypeFilter === 'all') return shipDecks;
    return shipDecks.filter((d) => d.type === shipmapDeckTypeFilter);
  }, [shipDecks, shipmapDeckTypeFilter]);
  const selectedDeckInfo = useMemo(() => shipDecks.find((d) => d.id === selectedDeck), [shipDecks, selectedDeck]);

  useEffect(() => {
    if (shipDecksFiltered.length > 0 && selectedDeck && !shipDecksFiltered.some((d) => d.id === selectedDeck)) {
      setSelectedDeck(shipDecksFiltered[0].id);
    }
  }, [shipmapDeckTypeFilter, shipDecksFiltered]);

  const deckServices = useMemo(() => {
    const openLabel = t('shipmap.serviceOpen');
    const closedLabel = t('shipmap.serviceClosed');
    const o = {};
    shipmapDecks.forEach((d) => {
      const id = d._id || d.id;
      o[id] = {
        title: d.name || t('shipmap.deckNumber', { number: id }),
        summary: d.description || '',
        services: (d.services || []).map((s) => {
          const name = typeof s === 'string' ? s : (s?.name ?? '');
          const icon = typeof s === 'object' && s?.icon ? s.icon : '•';
          const details = typeof s === 'object' && s?.openingHours ? s.openingHours : '';
          const isOpen = typeof s === 'object' && s?.isOpen !== undefined ? s.isOpen : true;
          return { title: name, type: 'Service', icon, status: isOpen ? openLabel : closedLabel, details };
        }),
      };
    });
    return o;
  }, [shipmapDecks, t]);

  const deckRooms = useMemo(() => {
    const o = {};
    shipmapDecks.filter((d) => d.type === 'cabin').forEach((d) => { o[d._id || d.id] = '—'; });
    return o;
  }, [shipmapDecks]);

  // === Movies & Series functions ===
  const toggleWatchlist = (movieId) => {
    const key = `watchlist_${favoritesStorageSuffix}`;
    setWatchlist(prev => {
      const next = prev.includes(movieId) ? prev.filter(id => id !== movieId) : [...prev, movieId];
      if (favoritesStorageSuffix === 'guest') try { localStorage.setItem(key, JSON.stringify(next)); } catch (_) {}
      return next;
    });
  };

  // === Magazine functions ===
  const filteredArticles = magazineArticles.filter(article => {
    // Normaliser les catégories pour la comparaison
    const articleCategory = article.category?.toLowerCase() || '';
    const selectedCat = selectedCategory?.toLowerCase() || 'all';
    
    // Mapping des catégories
    const categoryMap = {
      'actualites': ['actualités', 'actualites', 'news'],
      'voyage': ['voyage', 'travel', 'destination'],
      'gastronomie': ['gastronomie', 'cuisine', 'food'],
      'culture': ['culture', 'arts', 'festival'],
      'technologie': ['technologie', 'tech', 'innovation']
    };
    
    const matchesCategory = selectedCat === 'all' || 
      articleCategory === selectedCat ||
      (categoryMap[selectedCat] && categoryMap[selectedCat].some(cat => articleCategory.includes(cat)));
    
    const matchesSearch = magazineSearchQuery === '' || 
      article.title.toLowerCase().includes(magazineSearchQuery.toLowerCase()) ||
      article.excerpt.toLowerCase().includes(magazineSearchQuery.toLowerCase()) ||
      (article.tags && article.tags.some(tag => tag.toLowerCase().includes(magazineSearchQuery.toLowerCase())));
    
    return matchesCategory && matchesSearch;
  });

  const featuredArticles = magazineArticles.filter(article => article.isFeatured);
  const breakingNews = magazineArticles.filter(article => article.isBreaking);

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
  const restaurantFavoritesList = restaurants.filter(r => restaurantFavoritesIds.some(id => String(id) === String(r.id)));
  const filteredRestaurants = restaurants.filter(restaurant => {
    const matchesCategory = selectedRestaurantCategory === 'all'
      ? true
      : selectedRestaurantCategory === 'favoris'
        ? restaurantFavoritesIds.some(id => String(id) === String(restaurant.id))
        : restaurant.category === selectedRestaurantCategory;
    const specialties = Array.isArray(restaurant.specialties) ? restaurant.specialties : [];
    const matchesSearch = !restaurantSearchQuery.trim() ||
                         (restaurant.name || '').toLowerCase().includes(restaurantSearchQuery.toLowerCase()) ||
                         (restaurant.description || '').toLowerCase().includes(restaurantSearchQuery.toLowerCase()) ||
                         specialties.some(s => String(s).toLowerCase().includes(restaurantSearchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const allPromotions = restaurants.flatMap(restaurant =>
    (Array.isArray(restaurant.promotions) ? restaurant.promotions : []).map(promo => ({
      ...promo,
      restaurantName: restaurant.name,
      restaurantImage: restaurant.image,
      restaurantCategory: restaurant.category,
      restaurant
    }))
  );

  /** Promos : 1 resto + 1 boutique, tirés au hasard, ordre aléatoire. */
  const homePromosCombined = useMemo(() => {
    const restAll = (allPromotions || []).map((p) => ({ ...p, _promoType: 'restaurant', _promoKey: `rest-${p.restaurant?.id ?? ''}-${p.id ?? ''}` }));
    const shopAll = (shopPromotions || []).map((p) => ({ ...p, _promoType: 'shop', _promoKey: `shop-${p.id ?? p._id ?? ''}` }));
    const oneRest = restAll.length > 0 ? [restAll[Math.floor(Math.random() * restAll.length)]] : [];
    const oneShop = shopAll.length > 0 ? [shopAll[Math.floor(Math.random() * shopAll.length)]] : [];
    const pair = [...oneRest, ...oneShop];
    return pair.sort(() => Math.random() - 0.5);
  }, [restaurants, shopPromotions]);

  // Titre/description d'une promotion selon la langue (translations ou fallback)
  const getPromoTitle = (promo) =>
    (promo.translations && promo.translations[language] && promo.translations[language].title)
      ? promo.translations[language].title
      : (promo.title || '');
  const getPromoDescription = (promo) =>
    (promo.translations && promo.translations[language] && promo.translations[language].description)
      ? promo.translations[language].description
      : (promo.description || '');

  const addToCart = (item) => {
    setCart(prev => [...prev, { ...item, id: Date.now(), quantity: 1 }]);
  };

  const removeFromCart = (itemId) => {
    setCart(prev => prev.filter(item => item.id !== itemId));
  };

  const updateCartQuantity = (itemId, quantity) => {
    if (quantity <= 0) {
      removeFromCart(itemId);
    } else {
      setCart(prev => prev.map(item => 
        item.id === itemId ? { ...item, quantity } : item
      ));
    }
  };

  const getCartTotal = () => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  // === Espace Enfant functions ===
  const filteredEnfantActivities = enfantActivities.filter(activity => {
    const matchesCategory = selectedEnfantCategory === 'all'
      ? true
      : selectedEnfantCategory === 'favoris'
        ? enfantFavoritesIds.some(id => String(id) === String(activity.id))
        : activity.category === selectedEnfantCategory;
    const features = Array.isArray(activity.features) ? activity.features : [];
    const matchesSearch = !enfantSearchQuery.trim() ||
      (activity.name || '').toLowerCase().includes(enfantSearchQuery.toLowerCase()) ||
      (activity.description || '').toLowerCase().includes(enfantSearchQuery.toLowerCase()) ||
      features.some(f => String(f).toLowerCase().includes(enfantSearchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const enfantHighlights = (enfantActivities.filter(activity => activity.isHighlight) || enfantActivities).slice(0, 3);

  const currentDeck = useMemo(() => {
    if (!selectedDeck) return { title: '', summary: '', services: [] };
    return deckServices[selectedDeck] || { title: '', summary: '', services: [] };
  }, [selectedDeck, deckServices]);
  const filteredDeckServices = currentDeck.services.filter((service) => {
    if (!shipSearchQuery) return true;
    const query = shipSearchQuery.toLowerCase();
    return (
      service.title.toLowerCase().includes(query) ||
      service.type.toLowerCase().includes(query) ||
      (service.details && service.details.toLowerCase().includes(query))
    );
  });

  // === Shop functions ===
  const filteredShopProducts = shopProducts.filter(product => {
    const matchesCategory = selectedShopCategory === 'all' || product.category === selectedShopCategory;
    const matchesSearch = shopSearchQuery === '' || 
      product.name.toLowerCase().includes(shopSearchQuery.toLowerCase()) ||
      product.description.toLowerCase().includes(shopSearchQuery.toLowerCase()) ||
      product.features.some(feature => feature.toLowerCase().includes(shopSearchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

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

  // Favoris films (watchlist)
  const myWatchlist = moviesAndSeries.filter(item => watchlist.includes(item.id));

  // Articles magazine en favoris
  const magazineFavoritesArticles = magazineArticles.filter(a => magazineFavoritesIds.some(id => String(id) === String(a.id ?? a._id)));

  // Activités enfant en favoris (même source que la page Espace Enfant)
  const enfantFavoritesActivities = enfantActivities.filter(a => enfantFavoritesIds.some(id => String(id) === String(a.id)));

  useEffect(() => {
    if (page === 'restaurant') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [page]);

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#264FFF] to-[#264FFF]">
      <AnimatePresence mode="wait">
        {!conditionsAccepted ? (
          <>
            <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 md:px-6 py-3 md:py-4 safe-area-top">
              <div className="flex items-center gap-2 text-white">
                <img src="/logo-gnv.png" alt="GNV" className="h-6 md:h-7 w-auto object-contain" />
                <span className="font-bold text-lg md:text-xl">GNV OnBoard</span>
              </div>
              <LanguageSelector variant="light" />
            </header>
            <div className="relative z-10 min-h-screen w-full flex flex-col items-center overflow-y-auto overflow-x-hidden p-3 sm:p-4 md:p-6 pt-20 md:pt-24 pb-[max(2.5rem,calc(2.5rem+env(safe-area-inset-bottom,0px)))] md:pb-16">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md md:max-w-lg lg:max-w-xl rounded-2xl md:rounded-3xl bg-white/95 md:bg-white p-5 sm:p-6 md:p-8 shadow-xl md:shadow-2xl backdrop-blur-md border border-slate-100/50 md:my-auto shrink-0"
              >
                <h1 className="text-2xl md:text-3xl font-bold text-slate-900">{t('conditions.title')}</h1>
                <p className="text-sm md:text-base text-slate-600 mt-1 md:mt-2">{t('conditions.subtitle')}</p>
                <div className="mt-5 md:mt-6 max-h-[50vh] overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/50 p-4 md:p-5 text-sm md:text-base text-slate-700 space-y-3">
                  <p>{t('conditions.paragraph1')}</p>
                  <p>{t('conditions.paragraph2')}</p>
                  <p>{t('conditions.paragraph3')}</p>
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!e.target.querySelector('#accept-conditions')?.checked) return;
                    try {
                      localStorage.setItem(CONDITIONS_ACCEPTED_KEY, 'true');
                    } catch (_) {}
                    setConditionsAccepted(true);
                    setPage('home');
                    navigate('/', { replace: true });
                  }}
                  className="mt-5 md:mt-6 space-y-4"
                >
                  <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4 cursor-pointer has-[:checked]:border-[#264FFF] has-[:checked]:bg-blue-50/30 transition-all">
                    <input
                      type="checkbox"
                      id="accept-conditions"
                      name="accept-conditions"
                      required
                      className="mt-1 rounded border-slate-300 text-[#264FFF] focus:ring-[#264FFF]"
                    />
                    <span className="text-sm md:text-base text-slate-700">{t('conditions.acceptLabel')}</span>
                  </label>
                  <motion.button
                    type="submit"
                    whileTap={{ scale: 0.98 }}
                    className="w-full rounded-xl md:rounded-2xl bg-[#264FFF] px-4 py-3 md:py-4 text-sm md:text-base font-medium text-white hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-[#264FFF] focus:ring-offset-2"
                  >
                    {t('conditions.acceptButton')} <ArrowRight size={18} className="inline-block ml-1 md:w-5 md:h-5" />
                  </motion.button>
                </form>
              </motion.div>
            </div>
          </>
        ) : (
          <motion.div
            key="app"
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            className="min-h-screen w-full max-w-full flex flex-col relative bg-gray-50 px-2 sm:px-3 overflow-x-hidden pb-[max(3rem,calc(3rem+env(safe-area-inset-bottom,0px)))] sm:pb-12"
          >
            {/* Header - bandeau GNV : gauche (logo + retour si besoin) | droite (actions) — en plein écran z-index élevé pour rester visible */}
            <header
              className={`fixed top-0 left-0 right-0 z-[100] flex items-center justify-between gap-2 sm:gap-4 px-4 sm:px-5 py-3.5 sm:py-3 text-white shadow-lg rounded-b-2xl min-h-[60px] sm:min-h-[56px] max-w-[768px] mx-auto bg-[#264FFF] safe-area-top`}
              style={{ paddingLeft: 'max(1rem, env(safe-area-inset-left))', paddingRight: 'max(1rem, env(safe-area-inset-right))' }}
            >
              {/* Gauche : logo GNV (+ bouton retour si pas sur home) */}
              <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0 min-w-0">
                {page !== 'home' && (
                  <button
                    onClick={() => setPage('home')}
                    className="flex items-center justify-center h-9 w-9 sm:h-10 sm:w-10 rounded-full transition-all hover:opacity-90 active:scale-95 touch-manipulation flex-shrink-0"
                    style={{ backgroundColor: 'rgba(255, 255, 255, 0.25)' }}
                    aria-label={t('common.back')}
                  >
                    <ArrowLeft size={22} className="text-white sm:w-6 sm:h-6" />
                  </button>
                )}
                <button
                  onClick={() => setPage('home')}
                  className="outline-none focus:ring-0 flex items-center min-w-0"
                  aria-label={t('common.home')}
                >
                  <img src="/logo-gnv.png" alt="GNV" className="h-7 sm:h-8 w-auto object-contain" />
                </button>
              </div>

              {/* Droite : langue uniquement */}
              <div className="flex items-center justify-end gap-1.5 sm:gap-3 flex-shrink-0">
                <LanguageSelector variant="light" />
              </div>
            </header>

            {/* Bandeau hors ligne — contenu en cache */}
            {!isOnline && (
              <div
                className="fixed left-0 right-0 z-[99] max-w-[768px] mx-auto flex items-center justify-center gap-2 px-4 py-2 bg-amber-500 text-white text-sm font-medium shadow-md safe-area-top"
                style={{ top: 'calc(60px + env(safe-area-inset-top, 0px))' }}
                role="status"
                aria-live="polite"
              >
                <Wifi size={18} className="flex-shrink-0 opacity-90" />
                <span>{t('common.offlineBanner')}</span>
              </div>
            )}

            {/* Main with page transitions (pt pour ne pas passer sous le header fixe + safe area) */}
            <main className={`flex-1 p-2 sm:p-3 md:p-4 overflow-y-auto overflow-x-hidden ${!isOnline ? 'pt-[calc(7rem+env(safe-area-inset-top,0px))] sm:pt-[7.5rem] md:pt-[8rem]' : 'pt-[calc(5rem+env(safe-area-inset-top,0px))] sm:pt-[80px] md:pt-[84px]'}`}>
              {/* Carousel de bannières : une bannière visible, rotation automatique + flèches et points */}
              {homeBanners.length > 0 ? (
                <section className="px-1 sm:px-3 md:px-4 mt-3 sm:mt-6 md:mt-6">
                  <div className="relative">
                    <AnimatePresence mode="wait" initial={false}>
                      {(() => {
                        const banner = homeBanners[bannerIndex];
                        if (!banner) return null;
                        const src = getBannerImageUrl(banner, bannerViewWidth) || banner.image;
                        const url = src && (src.startsWith('data:') || src.startsWith('http')) ? src : src ? `${BACKEND_ORIGIN || ''}${src.startsWith('/') ? '' : '/'}${src}` : null;
                        return (
                          <motion.div
                            key={banner._id || banner.id || banner.title || bannerIndex}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.35 }}
                            className="relative rounded-xl sm:rounded-2xl overflow-hidden shadow-lg sm:shadow-xl"
                          >
                            <div
                              className="relative min-h-[160px] sm:min-h-[140px] sm:h-52 md:min-h-[200px] md:h-72 w-full bg-gradient-to-br from-blue-400 via-cyan-500 to-blue-600 bg-cover bg-center"
                              style={{ backgroundImage: url ? `url(${url})` : undefined }}
                            >
                              <div className="absolute inset-0 p-3 sm:p-4 md:p-5 flex flex-col justify-start">
                                <div className="max-w-md w-full">
                                  {banner.description ? (
                                    <div className="bg-orange-400/90 backdrop-blur-sm rounded-xl px-2 sm:px-3 py-1.5 sm:py-2 mb-2 sm:mb-3 inline-block max-w-full">
                                      <p className="text-[10px] sm:text-xs font-semibold text-white leading-snug">
                                        {banner.description}
                                      </p>
                                    </div>
                                  ) : null}
                                  {banner.link ? (
                                    <a
                                      href={banner.link}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={() => {
                                        const id = banner._id || banner.id;
                                        if (id) apiService.recordBannerClick(id);
                                      }}
                                      className="text-[10px] sm:text-xs text-white/90 underline cursor-pointer hover:text-white"
                                    >
                                      {t('common.seeDetails')}
                                    </a>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })()}
                    </AnimatePresence>

                    {/* Flèches précédent / suivant */}
                    {homeBanners.length > 1 ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setBannerIndex((i) => (i - 1 + homeBanners.length) % homeBanners.length)}
                          className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-colors z-10"
                          aria-label="Bannière précédente"
                        >
                          <ChevronLeft size={24} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setBannerIndex((i) => (i + 1) % homeBanners.length)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-colors z-10"
                          aria-label="Bannière suivante"
                        >
                          <ChevronRight size={24} />
                        </button>

                        {/* Points indicateurs */}
                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                          {homeBanners.map((_, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => setBannerIndex(i)}
                              className={`w-2.5 h-2.5 rounded-full transition-colors ${i === bannerIndex ? 'bg-white scale-110' : 'bg-white/50 hover:bg-white/80'}`}
                              aria-label={`Bannière ${i + 1}`}
                              aria-current={i === bannerIndex ? 'true' : undefined}
                            />
                          ))}
                        </div>
                      </>
                    ) : null}
                  </div>
                </section>
              ) : null}

              {page === 'home' ? (
                <div>
                    {/* Menu Services — sans en-tête, boutons uniquement */}
                    <section className="px-3 sm:px-4 md:px-5 mt-4 sm:mt-6 md:mt-6 pb-3 sm:pb-3 md:pb-4">
                      <div className="rounded-2xl bg-white border border-slate-200/90 shadow-sm overflow-hidden max-w-2xl md:max-w-4xl mx-auto">
                        <div className="p-3 sm:p-4 md:p-5">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 md:gap-5 max-w-full">
                            {[
                              { key: 'radio', icon: Mic, titleKey: 'common.radio', glow: 'from-violet-500/10 to-transparent', bgLight: 'bg-violet-50', iconColor: 'text-violet-600' },
                              { key: 'movies', icon: Clapperboard, titleKey: 'common.movies', glow: 'from-amber-500/10 to-transparent', bgLight: 'bg-amber-50', iconColor: 'text-amber-600' },
                              { key: 'magazine', icon: BookOpen, titleKey: 'common.magazine', glow: 'from-sky-500/10 to-transparent', bgLight: 'bg-sky-50', iconColor: 'text-sky-600' },
                              { key: 'webtv', icon: Tv, titleKey: 'common.webtv', glow: 'from-rose-500/10 to-transparent', bgLight: 'bg-rose-50', iconColor: 'text-rose-600' },
                              { key: 'restaurant', icon: Utensils, titleKey: 'common.restaurants', glow: 'from-emerald-500/10 to-transparent', bgLight: 'bg-emerald-50', iconColor: 'text-emerald-600' },
                              { key: 'enfant', icon: Baby, titleKey: 'common.enfant', glow: 'from-pink-500/10 to-transparent', bgLight: 'bg-pink-50', iconColor: 'text-pink-600' },
                              { key: 'shop', icon: ShoppingBag, titleKey: 'common.shop', glow: 'from-slate-500/10 to-transparent', bgLight: 'bg-slate-100', iconColor: 'text-slate-700' },
                              { key: 'shipmap', icon: Map, titleKey: 'common.shipmap', glow: 'from-blue-500/10 to-transparent', bgLight: 'bg-blue-50', iconColor: 'text-blue-600' }
                            ].map((service, index) => {
                              const IconComponent = service.icon;
                              return (
                                <motion.button
                                  key={service.key}
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: index * 0.04, duration: 0.25 }}
                                  onClick={() => setPage(service.key)}
                                  whileHover={{ scale: 1.03, y: -2 }}
                                  whileTap={{ scale: 0.98 }}
                                  className="group relative min-h-[88px] sm:min-h-[96px] md:min-h-[100px] rounded-2xl p-4 flex flex-col items-center justify-center gap-3 focus:outline-none focus:ring-2 focus:ring-[#264FFF]/40 focus:ring-offset-2 touch-manipulation bg-slate-50/80 border border-slate-200/80 hover:border-slate-300 hover:bg-white hover:shadow-lg hover:shadow-slate-200/50 active:bg-slate-100 transition-all duration-200 overflow-hidden"
                                  aria-label={t(service.titleKey)}
                                >
                                  {/* Lueur discrète au hover */}
                                  <span className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-br ${service.glow} pointer-events-none`} aria-hidden />
                                  <div className={`relative flex items-center justify-center flex-shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-2xl ${service.bgLight} border border-white/80 shadow-sm group-hover:shadow-md group-hover:scale-110 transition-all duration-200`}>
                                    <IconComponent className={`w-7 h-7 sm:w-8 sm:h-8 ${service.iconColor}`} strokeWidth={1.75} />
                                  </div>
                                  <span className="relative text-slate-700 font-semibold text-xs sm:text-sm text-center leading-tight line-clamp-2 group-hover:text-slate-900 transition-colors">
                                    {t(service.titleKey)}
                                  </span>
                                </motion.button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </section>

                    {/* Promos — visible sur tablette et plus (1 resto + 1 boutique) */}
                    <section className="hidden md:block px-3 sm:px-4 md:px-5 mt-2 md:mt-3 pb-8 md:pb-12 max-w-4xl mx-auto">
                      {homePromosCombined.length === 0 ? (
                        <p className="text-sm text-slate-500 text-center py-8">{t('common.noResults')}</p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {homePromosCombined.map((promo, index) => {
                            if (promo._promoType === 'restaurant') {
                              const promoTitle = getPromoTitle(promo);
                              const hasDiscount = promo.discount != null && !isNaN(promo.discount);
                              return (
                                <motion.button
                                  key={promo.id != null ? promo.id : `home-promo-rest-${index}`}
                                  type="button"
                                  whileHover={{ scale: 1.02, y: -2 }}
                                  whileTap={{ scale: 0.98 }}
                                  onClick={() => {
                                    setPage('restaurant');
                                    if (promo.restaurant) setSelectedRestaurant(promo.restaurant);
                                  }}
                                  className="w-full min-w-0 min-h-[180px] rounded-2xl overflow-hidden border-2 border-orange-200/80 hover:border-orange-400 hover:shadow-xl hover:shadow-orange-200/30 transition-all duration-200 text-left bg-gradient-to-br from-orange-500 via-orange-600 to-red-600 text-white px-5 py-5 shadow-lg flex flex-col"
                                  aria-label={promoTitle}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <Utensils size={20} className="text-white/70 flex-shrink-0 mt-0.5" strokeWidth={2} />
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/90 truncate flex-1 min-w-0 text-right">{promo.restaurantName}</p>
                                  </div>
                                  <p className="font-bold text-base mt-2 line-clamp-2 leading-snug">{promoTitle}</p>
                                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                                    <span className="text-lg font-bold">{Number(promo.price) != null && !isNaN(promo.price) ? `${promo.price}€` : '—'}</span>
                                    {promo.originalPrice != null && !isNaN(promo.originalPrice) && (
                                      <span className="text-sm opacity-90 line-through">{promo.originalPrice}€</span>
                                    )}
                                    {hasDiscount && (
                                      <span className="text-xs font-bold bg-white/30 backdrop-blur px-2.5 py-1 rounded-full">-{promo.discount}%</span>
                                    )}
                                  </div>
                                  <p className="text-xs text-white/90 mt-auto pt-4 flex items-center gap-1 font-medium">
                                    {t('restaurants.viewRestaurant')}
                                    <ArrowRight size={14} className="flex-shrink-0" strokeWidth={2.5} />
                                  </p>
                                </motion.button>
                              );
                            }
                            // Shop promo
                            const promoTitle = (promo.translations && promo.translations[language] && promo.translations[language].title) ? promo.translations[language].title : (promo.title || '');
                            const promoDesc = (promo.translations && promo.translations[language] && promo.translations[language].description) ? promo.translations[language].description : (promo.description || '');
                            const discountLabel = promo.discountType === 'percentage' ? `-${promo.discountValue || 0}%` : `-${promo.discountValue || 0}€`;
                            return (
                              <motion.button
                                key={promo.id || promo._id || `home-promo-shop-${index}`}
                                type="button"
                                whileHover={{ scale: 1.02, y: -2 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => setPage('shop')}
                                className="w-full min-w-0 min-h-[180px] rounded-2xl overflow-hidden border-2 border-emerald-200/80 hover:border-emerald-400 hover:shadow-xl hover:shadow-emerald-200/30 transition-all duration-200 text-left bg-gradient-to-br from-emerald-500 via-emerald-600 to-green-700 text-white px-5 py-5 shadow-lg flex flex-col"
                                aria-label={promoTitle}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <ShoppingBag size={20} className="text-white/70 flex-shrink-0 mt-0.5" strokeWidth={2} />
                                </div>
                                <p className="text-sm font-bold uppercase tracking-wide text-white/90 line-clamp-1 mt-1">{promoTitle}</p>
                                {promoDesc ? <p className="text-xs text-white/90 mt-2 line-clamp-2 leading-relaxed flex-1 min-h-0">{promoDesc}</p> : <span className="flex-1" />}
                                <div className="mt-3">
                                  <span className="inline-flex text-sm font-bold bg-white/25 backdrop-blur px-2.5 py-1 rounded-full">{discountLabel}</span>
                                </div>
                                <p className="text-xs text-white/90 mt-auto pt-4 flex items-center gap-1 font-medium">
                                  {t('common.seeDetails')}
                                  <ArrowRight size={14} className="flex-shrink-0" strokeWidth={2.5} />
                                </p>
                              </motion.button>
                            );
                          })}
                        </div>
                      )}
                    </section>

                    {/* Accès rapide — visible tablette uniquement, pour combler le vide */}
                    <section className="hidden md:block px-3 sm:px-4 md:px-5 mt-4 md:mt-6 pb-8 md:pb-12 max-w-4xl mx-auto">
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        {[
                          { key: 'movies', icon: Clapperboard, labelKey: 'common.movies', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
                          { key: 'magazine', icon: BookOpen, labelKey: 'common.magazine', bg: 'bg-sky-50', border: 'border-sky-200', text: 'text-sky-700' },
                          { key: 'webtv', icon: Tv, labelKey: 'common.webtv', bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700' },
                          { key: 'restaurant', icon: Utensils, labelKey: 'common.restaurants', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' }
                        ].map(({ key, icon: Icon, labelKey, bg, border, text }) => (
                          <motion.button
                            key={key}
                            type="button"
                            onClick={() => setPage(key)}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className={`flex items-center gap-3 rounded-xl border-2 ${border} ${bg} px-4 py-3.5 text-left transition-all hover:shadow-md`}
                            aria-label={t(labelKey)}
                          >
                            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${bg} border border-white/80 shadow-sm`}>
                              <Icon size={20} className={text} strokeWidth={2} />
                            </span>
                            <span className={`font-semibold text-sm ${text}`}>{t(labelKey)}</span>
                            <ChevronRight size={18} className={`ml-auto ${text} opacity-70`} />
                          </motion.button>
                        ))}
                      </div>
                    </section>

                </div>
              ) : (
              <AnimatePresence mode="wait">
                {page === 'radio' ? (
                  <motion.div
                    key="radio"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.25 }}
                  >
                  <RadioPage
                    t={t}
                    radioStations={radioStations}
                    currentRadio={currentRadio}
                    toggleRadio={toggleRadio}
                    isPlaying={isPlaying}
                    volume={volume}
                    onVolumeChange={handleVolumeChange}
                    isFavorite={isFavorite}
                    toggleFavorite={toggleFavorite}
                    loading={radioLoading}
                    getRadioLogoUrl={getRadioLogoUrl}
                    isDirectStream={!!(currentRadio && radioPlaylistTracks.length === 0)}
                    getRadioStreamProgress={getRadioStreamProgress}
                  />
                  </motion.div>
                ) : page === 'movies' ? (
                  <motion.div
                    key="movies"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.25 }}
                  >
                  <MoviesPage
                    t={t}
                    language={language}
                    moviesAndSeries={moviesAndSeries}
                    moviesLoading={moviesLoading}
                    watchlist={watchlist}
                    toggleWatchlist={toggleWatchlist}
                    playbackStorageSuffix={favoritesStorageSuffix}
                    onSyncPlaybackToServer={syncPlaybackToServer}
                    initialSelectedMovie={movieToOpenFromFavorites}
                    initialAutoPlay={!!movieToOpenFromFavorites}
                    onClearInitialMovie={() => setMovieToOpenFromFavorites(null)}
                    onVideoPlayStart={() => setIsMoviesVideoPlaying(true)}
                    onVideoPlayEnd={() => setIsMoviesVideoPlaying(false)}
                  />
                  </motion.div>
                ) : page === 'webtv' ? (
                  <motion.div
                    key="webtv"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.25 }}
                    className="min-h-screen bg-slate-50"
                  >
                    <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-6 sm:space-y-8 pb-32">
                      {/* En-tête */}
                      <header className="space-y-4">
                        <div className="rounded-2xl p-3 sm:p-4 shadow-md border border-blue-200/50" style={{ backgroundColor: '#264FFF' }}>
                          <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl bg-white/20 border border-white/30 flex-shrink-0 backdrop-blur-sm">
                              <Tv size={20} className="text-white sm:w-5 sm:h-5" strokeWidth={1.75} />
                            </div>
                            <div className="flex-1 min-w-0 pt-0.5">
                              <h1 className="text-base sm:text-lg font-bold text-white tracking-tight">{t('webtv.titlePage')}</h1>
                              <p className="text-xs text-blue-100 mt-0.5 max-w-xl">{t('webtv.subtitle')}</p>
                            </div>
                          </div>
                        </div>

                      </header>

                      {/* Filtres catégories — menu déroulant (tous écrans) */}
                      <div className="w-full max-w-xs">
                        <select
                          value={selectedChannelCategory}
                          onChange={(e) => setSelectedChannelCategory(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl text-sm font-semibold border border-slate-200/80 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-200 focus:border-sky-300"
                          aria-label={t('webtv.filterByCategory') || 'Filtrer par catégorie'}
                        >
                          {channelCategories.map((category) => (
                            <option key={category.id} value={category.id}>
                              {t(category.nameKey)}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Contenu : chaîne sélectionnée OU liste */}
                      {selectedChannel ? (
                      <div className="rounded-2xl overflow-hidden bg-white border border-slate-200 shadow-lg">
                          <div className="flex flex-col">
                            {/* Barre retour + infos chaîne — bandeau bleu */}
                            <div className="flex items-center gap-3 px-4 sm:px-6 py-4 sm:py-5 bg-[#264FFF]">
                              <button
                                onClick={() => { setPage('home'); setSelectedChannel(null); }}
                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white/90 hover:bg-white/20 transition-colors"
                                aria-label={t('common.back')}
                              >
                                <ArrowLeft size={22} strokeWidth={2} />
                              </button>
                              <div className="flex-1 min-w-0">
                                <h2 className="text-lg sm:text-xl font-bold text-white truncate">{selectedChannel.name}</h2>
                              </div>
                            </div>
                            {/* Lecteur vidéo (streaming) ou bannière chaîne */}
                            <div className="relative aspect-video max-h-52 sm:max-h-72 bg-slate-900">
                              {selectedWebtvProgram ? (
                                <>
                                  <video
                                    key={selectedWebtvProgram.streamUrl || selectedWebtvProgram.videoFile || 'webtv'}
                                    ref={(el) => {
                                      webtvVideoRefRef.current = el;
                                      setWebtvVideoRef(el);
                                    }}
                                    className="absolute inset-0 w-full h-full object-contain bg-black webtv-video-no-progress"
                                    controls
                                    playsInline
                                    preload="auto"
                                    crossOrigin="anonymous"
                                    onPlay={() => setIsWebtvVideoPlaying(true)}
                                    onPause={() => setIsWebtvVideoPlaying(false)}
                                    onEnded={handleWebtvVideoEnded}
                                    onError={() => setWebtvVideoError(true)}
                                  />
                                  {webtvVideoError && (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 text-white p-4 text-center">
                                      <p className="text-sm font-medium mb-1">{t('webtv.loadError') || 'Impossible de charger la vidéo'}</p>
                                      <p className="text-xs text-white/80">{t('webtv.loadErrorHint') || 'Vérifiez votre connexion ou réessayez.'}</p>
                                      <button
                                        type="button"
                                        onClick={() => { setWebtvVideoError(false); handleWebtvPlayByServerTime(); }}
                                        className="mt-3 px-4 py-2 rounded-lg bg-[#264FFF] text-white text-sm font-medium"
                                      >
                                        {t('webtv.retry') || 'Réessayer'}
                                      </button>
                                    </div>
                                  )}
                                </>
                              ) : (
                                <>
                                  <img
                                    src={selectedChannel.image}
                                    alt={selectedChannel.name}
                                    className="absolute inset-0 w-full h-full object-cover object-center"
                                    loading="lazy"
                                    decoding="async"
                                    onError={(e) => {
                                      e.target.style.display = 'none';
                                      e.target.nextElementSibling?.style && (e.target.nextElementSibling.style.display = 'flex');
                                    }}
                                  />
                                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                                  <div className="absolute inset-0 hidden items-center justify-center text-4xl text-white bg-slate-700">{selectedChannel.logo}</div>
                                </>
                              )}
                            </div>
                            {selectedChannel.programs?.some(p => (p.streamUrl && p.streamUrl.trim()) || (p.videoFile && String(p.videoFile).trim())) && (
                              <div className="px-4 sm:px-6 py-3 bg-white border-b border-slate-200">
                                <button
                                  type="button"
                                  onClick={handleWebtvPlayByServerTime}
                                  disabled={webtvPlaySyncing}
                                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#264FFF] text-white font-semibold text-sm hover:bg-[#1e3ed8] disabled:opacity-70 disabled:cursor-not-allowed transition-colors"
                                  aria-label={t('webtv.playNow')}
                                >
                                  {webtvPlaySyncing ? (
                                    <>
                                      <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" aria-hidden />
                                      {t('webtv.syncing') || 'Synchronisation…'}
                                    </>
                                  ) : (
                                    <>
                                      <Play size={18} className="fill-current" strokeWidth={2} />
                                      {t('webtv.playNow')}
                                    </>
                                  )}
                                </button>
                              </div>
                            )}
                            {/* Programme du jour — horaires */}
                            {(() => {
                              const dbSchedule = selectedChannel.schedule && Array.isArray(selectedChannel.schedule) ? selectedChannel.schedule : [];
                              const hasPrograms = selectedChannel.programs && selectedChannel.programs.length > 0;
                              const buildFromPrograms = dbSchedule.length === 0 && hasPrograms && selectedChannel.programs.some(p => (p.startTime || p.endTime) && (p.title || p.program));
                              const toProgramLabel = (val) => {
                                if (val == null) return '';
                                if (typeof val === 'string') return val;
                                if (typeof val === 'object' && val !== null && typeof val.title === 'string') return val.title;
                                return '';
                              };
                              const displaySchedule = dbSchedule.length > 0
                                ? dbSchedule.map(s => ({ time: s.time || '', program: toProgramLabel(s.program) || toProgramLabel(s.title) || '' }))
                                : buildFromPrograms
                                  ? selectedChannel.programs
                                      .filter(p => p.startTime || p.endTime)
                                      .map(p => ({
                                          time: [p.startTime, p.endTime].filter(Boolean).join(' - ').trim() || '00:00',
                                          program: toProgramLabel(p.title) || toProgramLabel(p.program) || ''
                                        }))
                                  : [];
                              if (displaySchedule.length === 0) return null;
                              return (
                                <div className="border-t border-slate-200 bg-white px-4 sm:px-6 py-4">
                                  <p className="text-xs font-bold text-slate-700 uppercase tracking-widest">{t('webtv.daySchedule')}</p>
                                  <div className="rounded-2xl border border-slate-200 overflow-hidden divide-y divide-slate-200/80 mt-2">
                                    {displaySchedule.map((item, index) => {
                                      const timeStr = (item.time || '').trim();
                                      const parts = timeStr.includes(' - ') ? timeStr.split(' - ').map(p => p.trim()) : [timeStr];
                                      const toMins = (t) => {
                                        if (!t) return 0;
                                        const [h, m] = t.split(':').map(n => parseInt(n, 10) || 0);
                                        return h * 60 + m;
                                      };
                                      const startMins = toMins(parts[0]);
                                      let endMins = parts[1] ? toMins(parts[1]) : startMins + 180;
                                      if (endMins <= startMins) endMins += 24 * 60;
                                      const now = new Date();
                                      const nowMins = now.getHours() * 60 + now.getMinutes();
                                      const isCurrent = nowMins >= startMins && nowMins < endMins;
                                      const isStreaming = selectedWebtvProgram && (item.program === selectedWebtvProgram.title || item.program === (selectedWebtvProgram.program || ''));
                                      return (
                                        <div key={index} className={`flex items-center gap-4 px-4 sm:px-5 py-4 transition-colors ${isCurrent ? 'bg-sky-100/90 border-l-4 border-l-[#264FFF]' : 'bg-slate-50/70 hover:bg-slate-100/80'}`}>
                                          <span className={`text-xs font-semibold tabular-nums shrink-0 flex items-center gap-2 min-w-[7rem] ${isCurrent ? 'text-[#264FFF]' : 'text-sky-600'}`}>
                                            {isStreaming ? (
                                              <span className="flex items-center gap-1.5 text-red-600">
                                                <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" aria-hidden />
                                                <span className="text-[10px] font-bold uppercase">{t('webtv.live')}</span>
                                              </span>
                                            ) : isCurrent ? (
                                              <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" aria-hidden />
                                            ) : null}
                                            {item.time}
                                          </span>
                                          <span className={`text-sm flex-1 font-medium ${isCurrent ? 'text-slate-900' : 'text-slate-700'}`}>{item.program}</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                        ) : (
                          <>
                            {webtvLoading ? (
                              <div className="flex items-center justify-center min-h-[300px] rounded-2xl bg-white border border-slate-200 shadow-sm">
                                <div className="flex flex-col items-center gap-4">
                                  <div className="animate-spin rounded-full h-10 w-10 border-2 border-slate-200 border-t-slate-500" />
                                  <p className="text-sm text-slate-500">Chargement…</p>
                                </div>
                              </div>
                            ) : filteredChannels.length === 0 ? (
                              <div className="rounded-2xl bg-white border border-slate-200 shadow-sm px-6 py-16 text-center">
                                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-100 text-slate-500 mb-5">
                                  <Tv size={32} strokeWidth={1.5} />
                                </div>
                                <p className="text-slate-800 font-semibold text-sm">{t('webtv.availableChannels')}</p>
                                <p className="text-sm text-slate-500 mt-2 max-w-sm mx-auto">{t('webtv.noChannelMatch')}</p>
                              </div>
                            ) : (
                              <section className="space-y-4">
                                <div className="flex items-baseline justify-between gap-3 mb-1">
                                  <div>
                                    <h2 className="text-sm font-semibold text-slate-500 tracking-widest uppercase">
                                      {t('webtv.availableChannels')}
                                    </h2>
                                    <p className="text-xs text-slate-500 mt-1">{t('webtv.selectChannelToWatch')}</p>
                                  </div>
                                  <span className="shrink-0 text-xs font-medium text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full">
                                    {filteredChannels.length} {filteredChannels.length !== 1 ? t('webtv.channels') : t('webtv.channel')}
                                  </span>
                                </div>

                                <div className="space-y-3">
                                  {filteredChannels.map((channel, chIndex) => (
                                    <motion.button
                                      key={`channel-${channel.id}-${chIndex}`}
                                      type="button"
                                      whileTap={{ scale: 0.99 }}
                                      onClick={() => setSelectedChannel(channel)}
                                      className="w-full text-left rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm transition-all flex gap-4 sm:gap-5 items-center group bg-white hover:shadow-md hover:border-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2"
                                    >
                                      <div className="relative h-16 w-16 sm:h-20 sm:w-20 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0 border border-slate-100">
                                        <img
                                          src={channel.image}
                                          alt=""
                                          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                          loading="lazy"
                                          decoding="async"
                                          onError={(e) => {
                                            e.target.style.display = 'none';
                                            const wrap = e.target.closest('div');
                                            const fallback = wrap?.querySelector('[data-fallback]');
                                            if (fallback) fallback.classList.remove('hidden');
                                          }}
                                        />
                                        <div data-fallback className="absolute inset-0 hidden items-center justify-center bg-slate-200 text-2xl">
                                          {channel.logo || '📺'}
                                        </div>
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                          {channel.category && (
                                            <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">
                                              {getWebtvCategoryLabel(channel.category, t)}
                                            </span>
                                          )}
                                          {channel.isLive && (
                                            <span className="text-[10px] font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded flex items-center gap-1">
                                              <span className="w-1 h-1 bg-red-500 rounded-full animate-pulse" />
                                              {t('webtv.live')}
                                            </span>
                                          )}
                                        </div>
                                        <h3 className="text-sm font-semibold text-slate-900 line-clamp-2 leading-snug">
                                          {channel.name || t('webtv.channelFallback')}
                                        </h3>
                                        <p className="text-xs text-slate-500 truncate mt-0.5">
                                          {channel.description || t('webtv.channelsOnDemand')}
                                          {channel.quality ? ` • ${channel.quality}` : ''}
                                          {channel.viewers != null ? ` • ${channel.viewers} ${t('webtv.viewers')}` : ''}
                                        </p>
                                      </div>
                                      <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                                        <div className="p-2 rounded-xl bg-slate-100 text-slate-600 group-hover:bg-slate-200 group-hover:text-slate-700 transition-colors">
                                          <Play size={18} className="fill-current ml-0.5" strokeWidth={1.75} />
                                        </div>
                                        <ChevronRight size={18} className="text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all" />
                                      </div>
                                    </motion.button>
                                  ))}
                                </div>
                              </section>
                            )}
                          </>
                        )}
                    </div>
                  </motion.div>
                ) : page === 'magazine' ? (
                  <motion.div
                    key="magazine"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.25 }}
                    className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100/80"
                  >
                    <div className="mx-auto w-full max-w-4xl px-4 sm:px-5 lg:px-6 py-5 sm:py-6 space-y-6 sm:space-y-7">
                      {/* Header - compact et lisible */}
                      <header className="rounded-2xl overflow-hidden shadow-lg bg-[#264FFF] px-5 py-4 sm:px-6 sm:py-5 text-white">
                        <div className="flex items-center gap-4">
                          <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm border border-white/30 flex-shrink-0">
                            <BookOpen size={24} className="text-white sm:w-7 sm:h-7" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h1 className="text-lg sm:text-xl font-bold tracking-tight">{t('magazine.title')}</h1>
                            <p className="text-xs sm:text-sm text-white/90 mt-0.5 line-clamp-2">{t('magazine.description')}</p>
                          </div>
                        </div>
                      </header>

                      {/* Loading State - squelette */}
                      {magazineLoading && (
                        <div className="rounded-2xl bg-white/80 backdrop-blur border border-slate-100 shadow-sm overflow-hidden" role="status" aria-live="polite" aria-label={t('magazine.loading')}>
                          <div className="p-5 sm:p-6 space-y-4">
                            <div className="flex gap-3">
                              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-slate-200 animate-pulse shrink-0" />
                              <div className="flex-1 space-y-2">
                                <div className="h-4 bg-slate-200 rounded animate-pulse w-3/4" />
                                <div className="h-3 bg-slate-100 rounded animate-pulse w-full" />
                                <div className="h-3 bg-slate-100 rounded animate-pulse w-2/3" />
                              </div>
                            </div>
                            {[1, 2, 3].map((i) => (
                              <div key={i} className="flex gap-3">
                                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-slate-200 animate-pulse shrink-0" />
                                <div className="flex-1 space-y-2">
                                  <div className="h-4 bg-slate-200 rounded animate-pulse w-4/5" />
                                  <div className="h-3 bg-slate-100 rounded animate-pulse w-full" />
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="flex items-center justify-center py-8 border-t border-slate-100">
                            <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#264FFF]/20 border-t-[#264FFF]" />
                            <p className="ml-3 text-slate-600 text-sm">{t('magazine.loading')}</p>
                          </div>
                        </div>
                      )}

                      {/* Erreur API */}
                      {!magazineLoading && magazineError && (
                        <div className="rounded-2xl bg-amber-50 border border-amber-200 px-5 py-6 sm:py-8 text-center shadow-sm" role="alert">
                          <p className="text-amber-800 font-semibold">{t('magazine.unableToLoad')}</p>
                          <p className="text-sm text-amber-700 mt-2">{magazineError}</p>
                          {!magazineError.includes('Trop de requêtes') && (
                            <p className="text-xs text-amber-600 mt-3 max-w-md mx-auto">{t('magazine.checkBackend')}</p>
                          )}
                          <button
                            type="button"
                            onClick={() => setMagazineRetryTrigger(t => t + 1)}
                            className="mt-4 px-5 py-2.5 rounded-xl bg-amber-200 text-amber-900 font-medium text-sm hover:bg-amber-300 transition-colors min-h-[44px]"
                          >
                            {t('magazine.retry')}
                          </button>
                        </div>
                      )}

                      {/* Urgent / Breaking - plus visible */}
                      {breakingNews.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setSelectedArticle(breakingNews[0])}
                          className="w-full rounded-2xl bg-gradient-to-r from-rose-500 to-orange-500 text-white shadow-lg hover:shadow-xl hover:scale-[1.01] active:scale-[0.99] transition-all px-5 py-4 text-left min-h-[80px] flex flex-col justify-center"
                        >
                          <p className="text-xs font-semibold uppercase tracking-widest opacity-95">{t('magazine.urgent')}</p>
                          <p className="mt-1.5 text-sm font-bold leading-snug line-clamp-2">{breakingNews[0].title}</p>
                          <p className="mt-1 text-xs text-white/85">{breakingNews[0].publishDate} · {breakingNews[0].readTime}</p>
                        </button>
                      )}

                      {/* Catégories — menu déroulant (tous écrans) */}
                      <div className="w-full max-w-xs">
                        <select
                          value={selectedCategory}
                          onChange={(e) => setSelectedCategory(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl text-sm font-medium bg-white border border-slate-200/80 text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#264FFF]/25 focus:border-[#264FFF]"
                        >
                          {magazineCategories.map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.icon} {category.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Article à la une */}
                      {!selectedArticle && featuredArticles[0] && (
                        <article className="rounded-2xl bg-white shadow-md border border-slate-100 overflow-hidden">
                          <div className="flex flex-col">
                            <div className="relative aspect-[16/9] sm:aspect-[2/1] bg-slate-200 overflow-hidden">
                              <img
                                src={getPosterUrl(featuredArticles[0].image) || featuredArticles[0].image}
                                alt={featuredArticles[0].title}
                                loading="lazy"
                                decoding="async"
                                className="absolute inset-0 w-full h-full object-cover object-center"
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                  e.target.nextElementSibling?.style && (e.target.nextElementSibling.style.display = 'flex');
                                }}
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
                              <div className="absolute inset-0 hidden items-center justify-center text-4xl text-white bg-slate-300">
                                <BookOpen size={32} />
                              </div>
                            </div>
                            <div className="px-4 sm:px-5 py-4 sm:py-5 space-y-3">
                              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                <span className="px-2.5 py-1 rounded-full bg-[#264FFF]/10 text-[#264FFF] font-semibold uppercase tracking-wide">
                                  {magazineCategories.find(cat => cat.id === featuredArticles[0].category)?.name || featuredArticles[0].category}
                                </span>
                                <span>{featuredArticles[0].publishDate}</span>
                                <span>·</span>
                                <span>{featuredArticles[0].readTime}</span>
                              </div>
                              <h2 className="text-lg sm:text-xl font-bold text-slate-900 leading-snug">{featuredArticles[0].title}</h2>
                              <p className="text-sm text-slate-600 leading-relaxed line-clamp-2">{featuredArticles[0].excerpt}</p>
                              <div className="flex items-center justify-between pt-1 gap-3">
                                <span className="text-xs font-medium text-slate-500 truncate">{t('magazine.by')} {featuredArticles[0].author}</span>
                                <button
                                  type="button"
                                  onClick={() => setSelectedArticle(featuredArticles[0])}
                                  className="shrink-0 text-sm font-semibold text-[#264FFF] hover:text-[#264FFF] hover:underline transition-colors py-1"
                                >
                                  {t('magazine.readArticle')}
                                </button>
                              </div>
                            </div>
                          </div>
                        </article>
                      )}

                      {/* Liste des articles */}
                      {!selectedArticle && !magazineLoading && (
                        <section className="space-y-4">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                            <h2 className="text-base font-bold text-slate-800">
                              {filteredArticles.length > 0 ? `${t('magazine.articles')} (${filteredArticles.length})` : t('magazine.noArticles')}
                            </h2>
                            {filteredArticles.length > 0 && featuredArticles.length > 0 && (
                              <span className="text-xs text-slate-500">{featuredArticles.length} {t('magazine.featuredCount')}</span>
                            )}
                          </div>
                          {filteredArticles.length === 0 ? (
                            <div className="text-center py-14 sm:py-16 bg-white rounded-2xl border border-slate-100 shadow-sm px-4">
                              <BookOpen size={40} className="text-slate-300 mx-auto mb-3" />
                              <p className="text-slate-600 font-medium">{magazineError ? t('magazine.loadFailed') : t('magazine.noArticles')}</p>
                              <p className="text-sm text-slate-500 mt-1">{magazineError ? t('magazine.checkBackend') : t('magazine.modifySearch')}</p>
                            </div>
                          ) : (
                            <motion.div
                              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
                              initial="hidden"
                              animate="visible"
                              variants={{ visible: { transition: { staggerChildren: 0.05 } }, hidden: {} }}
                            >
                              {filteredArticles.map((article) => (
                                <motion.button
                                  key={article.id ?? article._id}
                                  type="button"
                                  variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}
                                  whileHover={{ y: -4, boxShadow: '0 12px 24px -8px rgba(15,23,42,0.12)' }}
                                  whileTap={{ scale: 0.99 }}
                                  onClick={() => setSelectedArticle(article)}
                                  className="w-full text-left rounded-2xl bg-white border border-slate-100 overflow-hidden shadow-sm hover:border-slate-200 transition-all duration-200"
                                >
                                  {/* Image en haut - format carte magazine */}
                                  <div className="relative aspect-[16/10] w-full bg-slate-100 overflow-hidden">
                                    <img
                                      src={getPosterUrl(article.image) || article.image}
                                      alt=""
                                      className="absolute inset-0 w-full h-full object-cover object-center"
                                      loading="lazy"
                                      decoding="async"
                                      onError={(e) => {
                                        e.target.style.display = 'none';
                                        e.target.nextElementSibling?.style && (e.target.nextElementSibling.style.display = 'flex');
                                      }}
                                    />
                                    <div className="absolute inset-0 hidden items-center justify-center text-slate-500 bg-slate-50">
                                      <BookOpen size={32} strokeWidth={1.5} />
                                    </div>
                                    {/* Badge catégorie sur l'image */}
                                    <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/95 text-slate-700 text-xs font-medium shadow-sm backdrop-blur-sm">
                                      <BookOpen size={12} className="text-slate-500" strokeWidth={2} />
                                      {magazineCategories.find(cat => cat.id === article.category)?.name || article.category}
                                    </span>
                                  </div>
                                  <div className="p-4">
                                    <h3 className="text-base sm:text-lg font-bold text-slate-900 line-clamp-2 leading-snug">{article.title}</h3>
                                    <p className="text-sm text-slate-500 mt-2 line-clamp-2">{article.excerpt}</p>
                                    <div className="flex flex-wrap items-center gap-2 mt-3 text-xs text-slate-500">
                                      <span className="inline-flex items-center gap-1">
                                        <Calendar size={12} strokeWidth={2} />
                                        {article.publishDate}
                                      </span>
                                      <span className="inline-flex items-center gap-1">
                                        <Clock size={12} strokeWidth={2} />
                                        {article.readTime}
                                      </span>
                                      {article.isFeatured && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-medium">
                                          <Star size={12} className="text-amber-600" strokeWidth={2} />
                                          {t('magazine.featuredBadge')}
                                        </span>
                                      )}
                                      {article.isBreaking && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
                                          {t('magazine.urgent')}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </motion.button>
                              ))}
                            </motion.div>
                          )}
                        </section>
                      )}

                      {selectedArticle && (
                        <article className="rounded-2xl bg-white shadow-xl border border-slate-100 overflow-hidden" role="article" aria-label={selectedArticle.title}>
                          {/* Hero image + bouton retour */}
                          <div className="relative aspect-[16/9] sm:aspect-[2/1] bg-slate-200 overflow-hidden">
                            <img
                              src={getPosterUrl(selectedArticle.image) || selectedArticle.image}
                              alt={selectedArticle.title}
                              loading="lazy"
                              decoding="async"
                              className="absolute inset-0 w-full h-full object-cover object-center"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextElementSibling?.style && (e.target.nextElementSibling.style.display = 'flex');
                              }}
                            />
                            <div className="absolute inset-0 hidden items-center justify-center bg-slate-300 text-slate-500">
                              <BookOpen size={48} />
                            </div>
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />
                            <button
                              type="button"
                              onClick={() => { setPage('home'); setSelectedArticle(null); }}
                              className="absolute top-4 left-4 z-10 flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-white text-slate-800 shadow-lg ring-2 ring-black/10 hover:bg-slate-50 hover:shadow-xl transition-all duration-200 active:scale-95"
                              aria-label={t('magazine.backToList')}
                            >
                              <ArrowLeft size={24} className="sm:w-7 sm:h-7" strokeWidth={2.5} />
                            </button>
                          </div>

                          {/* En-tête article */}
                          <div className="px-4 sm:px-6 lg:px-8 pt-5 pb-4">
                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mb-3">
                              <span className="px-2.5 py-1 rounded-full bg-[#264FFF]/10 text-[#264FFF] font-semibold uppercase tracking-wide">
                                {magazineCategories.find(cat => cat.id === selectedArticle.category)?.name || selectedArticle.category}
                              </span>
                              {selectedArticle.isFeatured && (
                                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold">⭐ {t('magazine.featuredBadge')}</span>
                              )}
                              {selectedArticle.isBreaking && (
                                <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold">{t('magazine.urgent')}</span>
                              )}
                              <span>{selectedArticle.publishDate}</span>
                              <span>·</span>
                              <span>{selectedArticle.readTime}</span>
                              {selectedArticle.views > 0 && (
                                <span className="flex items-center gap-1">
                                  <Eye size={14} />
                                  {selectedArticle.views}
                                </span>
                              )}
                              {selectedArticle.likes > 0 && (
                                <span className="flex items-center gap-1">
                                  <Heart size={14} />
                                  {selectedArticle.likes}
                                </span>
                              )}
                            </div>
                            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 leading-tight tracking-tight">
                              {selectedArticle.title}
                            </h1>
                            <p className="mt-2 text-sm font-medium text-slate-500">
                              {t('magazine.by')} {selectedArticle.author}
                            </p>
                            {selectedArticle.excerpt && (
                              <p className="mt-2 text-sm text-slate-600 italic border-l-2 border-slate-200 pl-4">
                                {selectedArticle.excerpt}
                              </p>
                            )}
                          </div>

                          {/* Contenu - largeur de lecture confortable (HTML pour images/vidéos insérées) */}
                          <div className="px-4 sm:px-6 lg:px-8 pb-6">
                            <div className="max-w-[65ch] article-content text-[15px] sm:text-base text-slate-600 leading-[1.7]">
                              {selectedArticle.content && /<(?:\w+|figure|video|iframe)/i.test(selectedArticle.content) ? (
                                <div className="whitespace-pre-line [&_.article-inline-image]:my-4 [&_.article-inline-video]:my-4 [&_video]:max-w-full [&_iframe]:max-w-full [&_img]:rounded-lg" dangerouslySetInnerHTML={{ __html: selectedArticle.content }} />
                              ) : (
                                <p className="whitespace-pre-line">{selectedArticle.content}</p>
                              )}
                            </div>
                          </div>

                          {/* Tags + Favoris */}
                          <div className="px-4 sm:px-6 lg:px-8 pb-6 space-y-4 border-t border-slate-100 pt-5">
                            {selectedArticle.tags && selectedArticle.tags.length > 0 && (
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs font-medium text-slate-500 mr-1">{t('magazine.tagsLabel')}</span>
                                {selectedArticle.tags.map((tag) => (
                                  <span
                                    key={tag}
                                    className="px-3 py-1 rounded-full bg-[#264FFF]/10 text-[#264FFF] text-xs font-medium"
                                  >
                                    #{tag}
                                  </span>
                                ))}
                              </div>
                            )}
                            <div className="flex gap-3">
                              <button
                                type="button"
                                onClick={() => toggleMagazineFavorite(selectedArticle)}
                                className={`flex-1 flex items-center justify-center gap-2 rounded-xl border py-3.5 text-sm font-semibold transition-colors min-h-[48px] ${isMagazineFavorite(selectedArticle?.id ?? selectedArticle?._id) ? 'border-rose-200 text-rose-600 bg-rose-50 hover:bg-rose-100' : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}
                              >
                                <Heart size={20} className={isMagazineFavorite(selectedArticle?.id ?? selectedArticle?._id) ? 'fill-current' : ''} />
                                {isMagazineFavorite(selectedArticle?.id ?? selectedArticle?._id) ? t('magazine.removeFromFavorites') : t('magazine.addToFavorites')}
                              </button>
                            </div>
                          </div>
                        </article>
                      )}
                    </div>
                  </motion.div>
                ) : page === 'restaurant' ? (
                  <motion.div
                    key="restaurant"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.25 }}
                    className="min-h-screen bg-slate-50"
                  >
                    <div className="mx-auto w-full max-w-full px-3 py-6 space-y-6">
                      <div className="rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow px-4 py-4 space-y-3">
                          <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
                            <Ship size={22} className="text-white" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold tracking-[0.2em] uppercase text-white/70">{currentShipName}</p>
                            <p className="text-base font-semibold">{t('restaurants.deckVillage')}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs text-white/80">
                          <div className="flex items-center gap-1">
                            <Utensils size={14} />
                            <span>{restaurants.length} {restaurants.length === 1 ? t('restaurants.space') : t('restaurants.spaces')}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock size={14} />
                            <span>{t('restaurants.continuousService')}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Star size={14} className="text-yellow-300" />
                            <span>{t('restaurants.averageRating')}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <MapPin size={14} />
                            <span>{t('restaurants.loungeAccess')}</span>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl bg-white shadow px-4 py-3 flex items-center gap-3">
                        <div className="relative flex-1">
                          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                              <input
                                type="text"
                                placeholder={t('restaurants.searchPlaceholder')}
                                value={restaurantSearchQuery}
                                onChange={(e) => setRestaurantSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-10 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
                              />
                          {(restaurantSearchQuery || selectedRestaurantCategory !== 'all') && (
                            <button
                              type="button"
                              onClick={() => { setRestaurantSearchQuery(''); setSelectedRestaurantCategory('all'); }}
                              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-500 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                              aria-label={t('common.clearSearchAndFilters')}
                            >
                              <X size={18} />
                            </button>
                          )}
                            </div>
                        <button className="relative h-10 w-10 flex items-center justify-center rounded-xl border border-slate-200 text-slate-500">
                          <ShoppingBag size={18} />
                              {cart.length > 0 && (
                            <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-[10px] font-semibold rounded-full px-1.5">
                                  {cart.length}
                                </span>
                              )}
                            </button>
                      </div>

                      {/* Catégories — liste déroulante mobile, boutons desktop */}
                      <div className="md:hidden w-full">
                        <select
                          value={selectedRestaurantCategory}
                          onChange={(e) => setSelectedRestaurantCategory(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl text-sm font-medium bg-white border border-slate-200/80 text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-300"
                        >
                          {restaurantCategories.map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.icon} {category.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {selectedRestaurant ? (
                        // Vue détaillée du restaurant avec menu complet
                        <motion.div
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="space-y-6"
                        >
                          {/* Header avec bouton retour + favori */}
                          <div className="flex items-center gap-3 sm:gap-4">
                            <button
                              onClick={() => { setPage('home'); setSelectedRestaurant(null); }}
                              className="flex-shrink-0 flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-white/90 sm:bg-slate-100 text-slate-600 hover:text-slate-800 hover:bg-slate-200 active:scale-95 transition-all shadow-sm border border-slate-200/80"
                              aria-label={t('common.back')}
                            >
                              <ArrowLeft size={20} className="sm:w-5 sm:h-5" strokeWidth={2.25} />
                            </button>
                            <div className="flex-1 min-w-0">
                              <h2 className="text-xl font-bold text-slate-900 truncate">{selectedRestaurant.name}</h2>
                              <p className="text-sm text-slate-500 truncate">{selectedRestaurant.location}</p>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); toggleRestaurantFavorite(selectedRestaurant.id); }}
                              className={`rounded-full p-2 transition-colors ${isRestaurantFavorite(selectedRestaurant.id) ? 'bg-rose-100 text-rose-500' : 'bg-slate-100 text-slate-500 hover:text-rose-500 hover:bg-rose-50'}`}
                              aria-label={isRestaurantFavorite(selectedRestaurant.id) ? t('common.removeFromFavorites') : t('common.addToFavorites')}
                            >
                              <Heart size={20} className={isRestaurantFavorite(selectedRestaurant.id) ? 'fill-current' : ''} />
                            </button>
                          </div>

                          {/* Image du restaurant */}
                          <div className="relative h-48 bg-slate-200 rounded-2xl overflow-hidden">
                            <img
                              src={getRadioLogoUrl(selectedRestaurant.image) || selectedRestaurant.image || DEFAULT_RESTAURANT_IMAGE}
                              alt={selectedRestaurant.name}
                              loading="lazy"
                              decoding="async"
                              className="absolute inset-0 w-full h-full object-cover object-center"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextElementSibling.style.display = 'flex';
                              }}
                            />
                            <div className="absolute inset-0 hidden items-center justify-center text-white bg-gradient-to-br from-orange-500/70 to-rose-500/70">
                              <Utensils size={32} />
                            </div>
                            <div className="absolute top-4 left-4 flex items-center gap-2">
                              <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-700">
                                {selectedRestaurant.type}
                              </span>
                              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                selectedRestaurant.isOpen ? 'bg-green-500 text-white' : 'bg-rose-500 text-white'
                              }`}>
                                {selectedRestaurant.isOpen ? t('shipmap.serviceOpen') : t('shipmap.serviceClosed')}
                              </span>
                            </div>
                            <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full flex items-center gap-1">
                              <Star size={14} className="text-yellow-400 fill-current" />
                              <span className="text-sm font-semibold text-slate-700">{selectedRestaurant.rating}</span>
                            </div>
                          </div>

                          {/* Informations du restaurant */}
                          <div className="bg-white rounded-2xl shadow p-4 space-y-4">
                            <div>
                              <h3 className="text-lg font-bold text-slate-900 mb-2">{t('restaurants.about')}</h3>
                              <p className="text-sm text-slate-600 leading-relaxed">{selectedRestaurant.description}</p>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200">
                              <div>
                                <p className="text-xs text-slate-500 mb-1">{t('restaurants.price')}</p>
                                <p className="text-base font-semibold text-orange-500">{selectedRestaurant.priceRange}</p>
                              </div>
                              <div>
                                <p className="text-xs text-slate-500 mb-1">{t('restaurants.hours')}</p>
                                <p className="text-sm font-medium text-slate-700">{selectedRestaurant.openingHours}</p>
                              </div>
                            </div>

                            <div>
                              <p className="text-xs text-slate-500 mb-2">{t('restaurants.specialties')}</p>
                              <div className="flex flex-wrap gap-2">
                                {selectedRestaurant.specialties.map((specialty) => (
                                  <span key={specialty} className="px-3 py-1 rounded-full bg-orange-50 text-orange-600 text-xs font-medium">
                                    {specialty}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Promotions */}
                          {selectedRestaurant.promotions && selectedRestaurant.promotions.length > 0 && (
                            <div className="space-y-3">
                              <h3 className="text-lg font-bold text-slate-900">{t('restaurants.promotions')}</h3>
                              <div className="space-y-3">
                                {selectedRestaurant.promotions.map((promo, idx) => (
                                  <div
                                    key={promo.id != null ? promo.id : `promo-detail-${idx}`}
                                    className="rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 text-white px-4 py-4 shadow flex items-center justify-between"
                                  >
                                    <div className="flex-1">
                                      <p className="text-base font-semibold">{getPromoTitle(promo)}</p>
                                      <p className="text-sm text-white/80 mt-1">{getPromoDescription(promo)}</p>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-2xl font-bold">{promo.price}€</p>
                                      {promo.originalPrice != null && !isNaN(promo.originalPrice) && (
                                        <p className="text-sm line-through text-white/70">{promo.originalPrice}€</p>
                                      )}
                                      {promo.discount != null && !isNaN(promo.discount) && (
                                        <p className="text-xs font-semibold bg-white/20 px-2 py-1 rounded-full mt-2">
                                          -{promo.discount}%
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Menu complet */}
                          <div className="space-y-4">
                            <h3 className="text-lg font-bold text-slate-900">{t('restaurants.fullMenu')}</h3>
                            {(() => {
                              const menuByCategory = (selectedRestaurant.menu || []).reduce((acc, item) => {
                                const category = item.category || 'other';
                                if (!acc[category]) acc[category] = [];
                                acc[category].push(item);
                                return acc;
                              }, {});
                              const getCategoryLabel = (cat) => {
                                const key = 'restaurants.categories.' + (cat && typeof cat === 'string' ? cat.toLowerCase() : 'other');
                                const out = t(key);
                                return (out && out !== key) ? out : (cat || t('restaurants.categories.other'));
                              };

                              return Object.entries(menuByCategory).map(([category, items]) => (
                                <div key={category} className="bg-white rounded-2xl shadow p-4 space-y-4">
                                  <h4 className="text-base font-bold text-slate-900 border-b border-slate-200 pb-2">
                                    {getCategoryLabel(category)}
                                  </h4>
                                  <div className="space-y-4">
                                    {items.map((item) => (
                                      <div key={item.id} className="flex gap-4 pb-4 border-b border-slate-100 last:border-0 last:pb-0">
                                        <div className="relative h-24 w-24 rounded-xl overflow-hidden bg-slate-200 flex-shrink-0">
                                          <img
                                            src={getPosterUrl(item.image) || item.image}
                                            alt={item.name}
                                            loading="lazy"
                                            decoding="async"
                                            className="absolute inset-0 w-full h-full object-cover object-center"
                                            onError={(e) => {
                                              e.target.style.display = 'none';
                                              e.target.nextElementSibling.style.display = 'flex';
                                            }}
                                          />
                                          <div className="absolute inset-0 hidden items-center justify-center text-slate-500 bg-white">
                                            <Utensils size={20} />
                                          </div>
                                        </div>
                                        <div className="flex-1 space-y-2">
                                          <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1">
                                              <div className="flex items-center gap-2">
                                                <h5 className="text-base font-semibold text-slate-900">{item.name}</h5>
                                                {item.isPopular && (
                                                  <span className="px-2 py-0.5 bg-orange-100 text-orange-600 text-[10px] font-semibold rounded-full">
                                                    {t('restaurants.popular')}
                                                  </span>
                                                )}
                                              </div>
                                              {item.description && (
                                                <p className="text-sm text-slate-500 mt-1">{item.description}</p>
                                              )}
                                            </div>
                                            <div className="text-right">
                                              {item.price && (
                                                <p className="text-lg font-bold text-orange-500">{item.price}€</p>
                                              )}
                                            </div>
                                          </div>
                                          {item.allergens && item.allergens.length > 0 && (
                                            <p className="text-xs text-slate-500">
                                              {t('restaurants.allergens')} : {item.allergens.join(', ')}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ));
                            })()}
                          </div>
                        </motion.div>
                      ) : (
                        // Liste des restaurants
                        <>
                      {/* Module Promotions — 3 colonnes (3 blocs par ligne), bloc orange, sans image */}
                      <section className="space-y-3">
                        <h2 className="text-lg font-bold text-slate-900">{t('restaurants.promotions')}</h2>
                        {allPromotions.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {allPromotions.map((promo, idx) => {
                              const restaurant = promo.restaurant;
                              const promoTitle = getPromoTitle(promo);
                              const hasDiscount = promo.discount != null && !isNaN(promo.discount);
                              return (
                                <motion.button
                                  key={promo.id != null ? promo.id : `promo-${restaurant?.id ?? idx}-${idx}`}
                                  type="button"
                                  whileTap={{ scale: 0.98 }}
                                  onClick={() => restaurant && setSelectedRestaurant(restaurant)}
                                  className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md border border-orange-400/30 px-4 py-3 text-left hover:from-orange-600 hover:to-red-600 transition-colors"
                                >
                                  <p className="text-[10px] font-semibold uppercase tracking-widest text-white/80">{promo.restaurantName}</p>
                                  <p className="text-sm font-semibold mt-1 line-clamp-2">{promoTitle}</p>
                                  <div className="mt-2 flex items-center justify-between gap-2 flex-wrap">
                                    <span className="text-base font-bold">
                                      {Number(promo.price) != null && !isNaN(promo.price) ? `${promo.price}€` : '—'}
                                      {promo.originalPrice != null && !isNaN(promo.originalPrice) && (
                                        <span className="text-xs font-normal opacity-80 line-through ml-1">{promo.originalPrice}€</span>
                                      )}
                                    </span>
                                    {hasDiscount && (
                                      <span className="text-xs font-bold bg-white/25 px-2 py-0.5 rounded-full">-{promo.discount}%</span>
                                    )}
                                  </div>
                                  <p className="text-[10px] text-white/80 mt-2 flex items-center gap-0.5">
                                    {t('restaurants.viewRestaurant')}
                                    <ChevronRight size={12} />
                                  </p>
                                </motion.button>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="rounded-xl bg-gradient-to-r from-orange-500/90 to-red-500/90 text-white px-4 py-4 text-center border border-orange-400/30">
                            <p className="text-sm font-medium">{t('restaurants.noPromotions')}</p>
                          </div>
                        )}
                      </section>

                      <section className="space-y-3">
                        <h2 className="text-lg font-semibold text-slate-900">{t('restaurants.gnvSelection')}</h2>
                        <div className="space-y-3">
                          {restaurantsLoading ? (
                            <div className="rounded-2xl bg-white border border-slate-200 p-6 text-center">
                              <p className="text-slate-500">{t('common.loading') || 'Chargement...'}</p>
                            </div>
                          ) : filteredRestaurants.length === 0 ? (
                            <div className="rounded-2xl bg-white border border-slate-200 p-6 text-center text-slate-500">
                              <Utensils size={40} className="mx-auto mb-2 opacity-50" />
                              <p className="font-medium">{t('restaurants.noRestaurantsToShow')}</p>
                              <p className="text-sm mt-1">{t('restaurants.checkFiltersHint')}</p>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {filteredRestaurants.map((restaurant) => (
                                <motion.div
                            key={restaurant.id}
                                  whileHover={{ scale: 1.01 }}
                                  className="w-full rounded-2xl bg-white shadow border border-slate-200 overflow-hidden"
                                >
                                <button
                                  type="button"
                                  onClick={() => setSelectedRestaurant(restaurant)}
                                  className="w-full text-left"
                                >
                                <div className="relative h-36 bg-slate-200">
                              <img
                                src={getRadioLogoUrl(restaurant.image) || restaurant.image || DEFAULT_RESTAURANT_IMAGE}
                                alt={restaurant.name}
                                loading="lazy"
                                decoding="async"
                                    className="absolute inset-0 w-full h-full object-cover object-center"
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                  e.target.nextElementSibling.style.display = 'flex';
                                }}
                              />
                                  <div className="absolute inset-0 hidden items-center justify-center text-white bg-gradient-to-br from-orange-500/70 to-rose-500/70">
                                    <Utensils size={28} />
                              </div>
                                  <div className="absolute top-3 left-3 flex items-center gap-2">
                                    <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                                      {restaurant.type}
                                    </span>
                                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                      restaurant.isOpen ? 'bg-green-500 text-white' : 'bg-rose-500 text-white'
                                }`}>
                                  {restaurant.isOpen ? t('shipmap.serviceOpen') : t('shipmap.serviceClosed')}
                                    </span>
                                </div>
                                  <div className="absolute top-3 right-3 flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); e.preventDefault(); toggleRestaurantFavorite(restaurant.id); }}
                                      className={`rounded-full p-1.5 transition-colors ${isRestaurantFavorite(restaurant.id) ? 'bg-rose-100 text-rose-500' : 'bg-white/85 backdrop-blur-sm text-slate-600 hover:text-rose-500'}`}
                                      aria-label={isRestaurantFavorite(restaurant.id) ? t('common.removeFromFavorites') : t('common.addToFavorites')}
                                    >
                                      <Heart size={14} className={isRestaurantFavorite(restaurant.id) ? 'fill-current' : ''} />
                                    </button>
                                    <div className="bg-white/85 backdrop-blur-sm px-2 py-0.5 rounded-full flex items-center gap-1">
                                      <Star size={12} className="text-yellow-400 fill-current" />
                                      <span className="text-[11px] font-semibold text-slate-700">{restaurant.rating}</span>
                                    </div>
                                  </div>
                              </div>
                                  <div className="p-4 space-y-3">
                                  <div className="flex items-start justify-between gap-3">
                                      <div className="flex-1">
                                      <p className="text-xs text-slate-500 uppercase tracking-[0.3em]">{restaurant.location}</p>
                                      <h3 className="text-lg font-semibold text-slate-900">{restaurant.name}</h3>
                                        <p className="text-xs text-slate-500 mt-1 leading-relaxed line-clamp-2">{restaurant.description}</p>
                                </div>
                                    <div className="text-right text-slate-500 text-xs">
                                      <p className="font-semibold text-orange-500">{restaurant.priceRange}</p>
                                      <p>{restaurant.location}</p>
                                </div>
                              </div>
                                <div className="flex flex-wrap gap-1">
                                      {restaurant.specialties.slice(0, 3).map((specialty) => (
                                      <span key={specialty} className="px-2 py-1 rounded-full bg-slate-100 text-slate-600 text-[11px] font-medium">
                                      {specialty}
                                    </span>
                                  ))}
                              </div>
                                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                                      <p className="text-xs text-slate-500">{restaurant.openingHours}</p>
                                      <ChevronRight size={16} className="text-slate-500" />
                                </div>
                                </div>
                                </button>
                                </motion.div>
                              ))}
                            </div>
                          )}
                        </div>
                          </section>
                        </>
                      )}
                          </div>
                  </motion.div>
                ) : page === 'enfant' ? (
                  <motion.div
                    key="enfant"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.25 }}
                    className="min-h-screen bg-gradient-to-br from-slate-50 via-pink-50/30 to-slate-100/80"
                  >
                    <div className="mx-auto w-full max-w-full md:max-w-2xl lg:max-w-4xl px-4 sm:px-5 lg:px-6 py-5 sm:py-6 space-y-6 sm:space-y-7">
                      {/* Header - même style que magazine */}
                      <header className="rounded-2xl overflow-hidden shadow-lg bg-gradient-to-br from-pink-500 via-purple-500 to-indigo-500 px-5 py-4 sm:px-6 sm:py-5 text-white">
                        <div className="flex items-center gap-4">
                          <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm border border-white/30 flex-shrink-0">
                            <Baby size={24} className="text-white sm:w-7 sm:h-7" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h1 className="text-lg sm:text-xl font-bold tracking-tight">{t('enfant.title')}</h1>
                            <p className="text-xs sm:text-sm text-white/90 mt-0.5 line-clamp-2">
                              {t('enfant.zoneFamilies')} — {t('enfant.zoneFamiliesSubtitle')}
                            </p>
                            {enfantActivities.length > 0 && (
                              <p className="text-xs text-white/80 mt-1.5">
                                {enfantActivities.length} {t('enfant.activities').toLowerCase()}
                              </p>
                            )}
                          </div>
                        </div>
                      </header>

                      {/* Loading State - squelette comme magazine */}
                      {enfantLoading && (
                        <div className="rounded-2xl bg-white/80 backdrop-blur border border-slate-100 shadow-sm overflow-hidden">
                          <div className="p-5 sm:p-6 space-y-4">
                            <div className="flex gap-3">
                              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-slate-200 animate-pulse shrink-0" />
                              <div className="flex-1 space-y-2">
                                <div className="h-4 bg-slate-200 rounded animate-pulse w-3/4" />
                                <div className="h-3 bg-slate-100 rounded animate-pulse w-full" />
                                <div className="h-3 bg-slate-100 rounded animate-pulse w-2/3" />
                              </div>
                            </div>
                            {[1, 2, 3].map((i) => (
                              <div key={i} className="flex gap-3">
                                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-slate-200 animate-pulse shrink-0" />
                                <div className="flex-1 space-y-2">
                                  <div className="h-4 bg-slate-200 rounded animate-pulse w-4/5" />
                                  <div className="h-3 bg-slate-100 rounded animate-pulse w-full" />
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="flex items-center justify-center py-8 border-t border-slate-100">
                            <div className="animate-spin rounded-full h-8 w-8 border-2 border-pink-500/20 border-t-pink-500" />
                            <p className="ml-3 text-slate-600 text-sm">{t('magazine.loading')}</p>
                          </div>
                        </div>
                      )}

                      {!enfantLoading && (
                        <>
                          {/* Catégories — menu déroulant (tous écrans) */}
                          <div className="w-full max-w-xs">
                            <select
                              value={selectedEnfantCategory}
                              onChange={(e) => setSelectedEnfantCategory(e.target.value)}
                              className="w-full px-4 py-3 rounded-xl text-sm font-medium bg-white border border-slate-200/80 text-slate-700 focus:outline-none focus:ring-2 focus:ring-pink-500/25 focus:border-pink-500"
                            >
                              {enfantCategories.map((category) => (
                                <option key={category.id} value={category.id}>
                                  {category.icon} {category.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* À la une */}
                          {enfantHighlights.length > 0 && (
                            <section className="space-y-3">
                              <div className="flex items-center justify-between">
                                <h2 className="text-base sm:text-lg font-semibold text-slate-900">{t('enfant.featured')}</h2>
                                <span className="px-3 py-1 text-xs font-semibold rounded-full bg-pink-100 text-pink-600">
                                  {enfantHighlights.length} {t('enfant.programs')}
                                </span>
                              </div>
                              <div className="space-y-3">
                                {enfantHighlights.map((highlight) => {
                                  const categoryLabel = enfantCategories.find((cat) => cat.id === highlight.category)?.name || highlight.category;
                                  const featureSummary = highlight.features?.slice(0, 2).join(' • ');
                                  return (
                                    <motion.button
                                      key={highlight.id}
                                      type="button"
                                      whileHover={{ scale: 1.01 }}
                                      whileTap={{ scale: 0.99 }}
                                      className="w-full flex gap-3 rounded-2xl border border-slate-200 bg-white p-3 sm:p-4 text-left shadow-sm hover:shadow-md transition-shadow"
                                      onClick={() => setSelectedActivity(highlight)}
                                    >
                                      <div className="relative h-20 w-20 sm:h-24 sm:w-24 rounded-xl overflow-hidden bg-slate-200 flex-shrink-0">
                                        <img
                                          src={highlight.image}
                                          alt={highlight.name}
                                          loading="lazy"
                                          decoding="async"
                                          className="absolute inset-0 w-full h-full object-cover object-center"
                                          onError={(e) => {
                                            e.target.style.display = 'none';
                                            e.target.nextElementSibling?.style && (e.target.nextElementSibling.style.display = 'flex');
                                          }}
                                        />
                                        <div className="absolute inset-0 hidden items-center justify-center text-white bg-pink-500/70">
                                          <Baby size={24} />
                                        </div>
                                        <button
                                          type="button"
                                          onClick={(e) => { e.stopPropagation(); toggleEnfantFavorite(highlight); }}
                                          className="absolute top-1.5 right-1.5 p-1.5 rounded-full bg-white/90 text-slate-500 hover:bg-white shadow border border-slate-100"
                                          aria-label={isEnfantFavorite(highlight.id) ? t('common.removeFromFavorites') : t('common.addToFavorites')}
                                        >
                                          <Heart size={16} className={isEnfantFavorite(highlight.id) ? 'text-rose-500 fill-rose-500' : ''} strokeWidth={1.75} />
                                        </button>
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-xs uppercase tracking-wider text-pink-500 font-semibold">{categoryLabel}</p>
                                        <h3 className="text-sm sm:text-base font-semibold text-slate-900 mt-0.5 line-clamp-2">{highlight.name}</h3>
                                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">{highlight.description}</p>
                                        <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-2 flex-wrap">
                                          <span>🕒 {highlight.openingHours}</span>
                                          {highlight.ageRange && <span>👶 {highlight.ageRange}</span>}
                                          {featureSummary && <span>{featureSummary}</span>}
                                        </div>
                                      </div>
                                      <ChevronRight size={20} className="text-slate-300 flex-shrink-0 mt-1" />
                                    </motion.button>
                                  );
                                })}
                              </div>
                            </section>
                          )}

                          {/* Toutes les activités - grille cartes */}
                          <section className="space-y-3">
                            <div className="flex items-center justify-between">
                              <h2 className="text-base sm:text-lg font-semibold text-slate-900">{t('enfant.allActivities')}</h2>
                              <span className="text-xs font-semibold text-slate-500">
                                {filteredEnfantActivities.length} {t('enfant.activities').toLowerCase()}
                              </span>
                            </div>
                            {filteredEnfantActivities.length > 0 ? (
                              <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {filteredEnfantActivities.map((activity) => (
                                  <motion.button
                                    key={activity.id}
                                    type="button"
                                    layout
                                    initial={{ opacity: 0, y: 12 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    className="rounded-2xl bg-white shadow-md border border-slate-100 overflow-hidden text-left hover:shadow-lg transition-shadow"
                                    onClick={() => setSelectedActivity(activity)}
                                  >
                                    <div className="relative aspect-[16/10] sm:aspect-video bg-slate-200">
                                      <img
                                        src={activity.image}
                                        alt={activity.name}
                                        loading="lazy"
                                        decoding="async"
                                        className="absolute inset-0 w-full h-full object-cover object-center"
                                        onError={(e) => {
                                          e.target.style.display = 'none';
                                          e.target.nextElementSibling?.style && (e.target.nextElementSibling.style.display = 'flex');
                                        }}
                                      />
                                      <div className="absolute inset-0 hidden items-center justify-center text-4xl text-white bg-pink-500/60">
                                        <Baby size={40} />
                                      </div>
                                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                                      <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                                        <span className="px-2 py-1 rounded-lg bg-pink-500 text-white text-xs font-semibold">
                                          {activity.ageRange}
                                        </span>
                                        <div className="flex items-center gap-1">
                                          {activity.isOpen !== false && (
                                            <span className="px-2 py-1 rounded-lg bg-green-500/90 text-white text-xs font-semibold">{t('shipmap.serviceOpen')}</span>
                                          )}
                                          <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); toggleEnfantFavorite(activity); }}
                                            className="p-1.5 rounded-full bg-white/90 text-slate-500 hover:bg-white shadow border border-slate-100"
                                            aria-label={isEnfantFavorite(activity.id) ? t('common.removeFromFavorites') : t('common.addToFavorites')}
                                          >
                                            <Heart size={16} className={isEnfantFavorite(activity.id) ? 'text-rose-500 fill-rose-500' : ''} strokeWidth={1.75} />
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="p-4">
                                      <h3 className="text-sm sm:text-base font-semibold text-slate-900 line-clamp-2">{activity.name}</h3>
                                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">{activity.description}</p>
                                      <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                                        <Clock size={14} className="text-pink-500 flex-shrink-0" />
                                        <span>{activity.openingHours}</span>
                                      </div>
                                      {activity.features && activity.features.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-2">
                                          {activity.features.slice(0, 3).map((f, i) => (
                                            <span key={i} className="px-2 py-0.5 rounded-full bg-pink-50 text-pink-600 text-[11px] font-medium">
                                              {f}
                                            </span>
                                          ))}
                                          {activity.features.length > 3 && (
                                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[11px]">+{activity.features.length - 3}</span>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </motion.button>
                                ))}
                              </motion.div>
                            ) : (
                              <div className="rounded-2xl bg-white border border-slate-100 px-5 py-10 text-center">
                                <Baby size={48} className="mx-auto text-slate-300" />
                                <p className="text-slate-500 font-medium mt-3">
                                  {selectedEnfantCategory === 'favoris' ? t('enfant.noFavorites') : t('enfant.noActivitiesInCategory')}
                                </p>
                                <p className="text-sm text-slate-500 mt-1">
                                  {selectedEnfantCategory === 'favoris' ? t('enfant.noFavoritesHint') : t('enfant.noActivitiesInCategoryHint')}
                                </p>
                              </div>
                            )}
                          </section>
                        </>
                      )}
                    </div>

                    {/* Activity Detail Modal */}
                    {selectedActivity && (
                      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
                        <motion.div
                          initial={{ opacity: 0, y: 30 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -20 }}
                          className="w-full flex justify-center max-w-full sm:max-w-2xl md:max-w-xl"
                        >
                          <div className="w-full flex-shrink-0 max-w-full">
                          <div className="rounded-2xl bg-white shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
                            <div className="relative h-48 sm:h-56 bg-slate-200 flex-shrink-0">
                              <img
                                src={selectedActivity.image}
                                alt={selectedActivity.name}
                                loading="lazy"
                                decoding="async"
                                className="absolute inset-0 w-full h-full object-cover object-center"
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                  e.target.nextElementSibling?.style && (e.target.nextElementSibling.style.display = 'flex');
                                }}
                              />
                              <div className="absolute inset-0 hidden items-center justify-center text-4xl text-white bg-pink-500/60">
                                <Baby size={48} />
                              </div>
                              <button
                                type="button"
                                onClick={() => setSelectedActivity(null)}
                                className="absolute top-4 right-4 p-2 rounded-full bg-white/90 text-slate-600 hover:bg-white shadow"
                              >
                                <X size={20} />
                              </button>
                              <button
                                type="button"
                                onClick={() => selectedActivity && toggleEnfantFavorite(selectedActivity)}
                                className="absolute top-4 right-14 p-2 rounded-full bg-white/90 text-slate-600 hover:bg-white shadow"
                                aria-label={selectedActivity && isEnfantFavorite(selectedActivity.id) ? t('common.removeFromFavorites') : t('common.addToFavorites')}
                              >
                                <Heart size={20} className={selectedActivity && isEnfantFavorite(selectedActivity.id) ? 'text-rose-500 fill-rose-500' : ''} strokeWidth={1.75} />
                              </button>
                              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/70 to-transparent text-white">
                                <p className="text-xs uppercase tracking-wider text-white/80">{enfantCategories.find(c => c.id === selectedActivity.category)?.name || selectedActivity.category}</p>
                                <h2 className="text-xl sm:text-2xl font-bold leading-tight mt-1">{selectedActivity.name}</h2>
                                <div className="flex items-center gap-3 text-xs text-white/90 mt-2">
                                  <MapPin size={14} />
                                  <span>{selectedActivity.location}</span>
                                  <span>·</span>
                                  <span>👶 {selectedActivity.ageRange}</span>
                                </div>
                              </div>
                            </div>
                            <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
                              <p className="text-sm text-slate-600 leading-relaxed">{selectedActivity.description}</p>
                              {selectedActivity.activities && selectedActivity.activities.length > 0 && (
                                <div className="space-y-2">
                                  <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">Animations proposées</h3>
                                  <div className="space-y-2">
                                    {selectedActivity.activities.map((sub, idx) => (
                                      <div key={idx} className="flex gap-3 rounded-xl border border-slate-200 p-3">
                                        <div className="w-12 h-12 rounded-lg bg-slate-200 flex-shrink-0 flex items-center justify-center text-xl">🎨</div>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center justify-between gap-2">
                                            <h4 className="text-sm font-semibold text-slate-900">{sub.name}</h4>
                                            {sub.duration && <span className="text-xs font-semibold text-pink-500">{sub.duration}</span>}
                                          </div>
                                          {sub.description && <p className="text-xs text-slate-500 mt-0.5">{sub.description}</p>}
                                          {sub.ageRange && <p className="text-[11px] text-slate-500 mt-1">👶 {sub.ageRange}</p>}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-2">
                                <div className="flex items-start gap-3 text-sm text-slate-600">
                                  <Clock size={18} className="text-pink-500 mt-0.5 flex-shrink-0" />
                                  <div>
                                    <p className="font-semibold text-slate-900">Horaires</p>
                                    <p>{selectedActivity.openingHours}</p>
                                  </div>
                                </div>
                                {selectedActivity.features && selectedActivity.features.length > 0 && (
                                  <>
                                    <p className="text-sm font-semibold text-slate-900 mt-2">Équipements</p>
                                    <div className="flex flex-wrap gap-2 mt-1">
                                      {selectedActivity.features.map((feature, index) => (
                                        <span key={index} className="px-3 py-1 rounded-full bg-pink-100 text-pink-600 text-xs font-medium">
                                          {feature}
                                        </span>
                                      ))}
                                    </div>
                                    </>
                                )}
                              </div>
                            </div>
                          </div>
                          </div>
                        </motion.div>
                      </div>
                    )}
                  </motion.div>
                ) : page === 'shipmap' ? (
                  <>
                    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-50"><span className="text-slate-500">{t('common.loading')}</span></div>}>
                      <ShipmapPage
                      t={t}
                      shipmapShip={shipmapShip}
                      shipmapLoading={shipmapLoading}
                      refetchShipmap={refetchShipmap}
                      shipDecks={shipDecks}
                      shipDecksFiltered={shipDecksFiltered}
                      selectedDeck={selectedDeck}
                      setSelectedDeck={setSelectedDeck}
                      shipmapDeckTypeFilter={shipmapDeckTypeFilter}
                      setShipmapDeckTypeFilter={setShipmapDeckTypeFilter}
                      shipSearchQuery={shipSearchQuery}
                      setShipSearchQuery={setShipSearchQuery}
                      deckServices={deckServices}
                      selectedDeckInfo={selectedDeckInfo}
                      filteredDeckServices={filteredDeckServices}
                      deckRooms={deckRooms}
                    />
                    </Suspense>
                    {showShipmapAddPlanModal && (
                      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="shipmap-add-plan-title">
                        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-gray-200">
                          <h2 id="shipmap-add-plan-title" className="text-lg font-semibold text-gray-900 mb-3">{t('shipmap.addPlanModalTitle')}</h2>
                          <p className="text-gray-600 text-sm mb-5">{t('shipmap.addPlanModalMessage')}</p>
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() => setShowShipmapAddPlanModal(false)}
                              className="px-4 py-2 bg-[#264FFF] text-white rounded-xl hover:bg-[#1e3fe6] transition-colors"
                            >
                              {t('common.close')}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                ) : page === 'notifications' ? (
                  <NotificationsPage
                    notificationsList={notificationsList}
                    notificationsLoading={notificationsLoading}
                    t={t}
                    language={language}
                    onBack={() => setPage('home')}
                  />
                ) : page === 'favorites' ? (
                  <motion.div
                    key="favorites"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.25 }}
                    className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-cyan-50/20"
                  >
                    <div className="mx-auto w-full max-w-3xl px-4 sm:px-5 py-6 sm:py-8 space-y-6">
                      {/* Header Favoris */}
                      <div className="relative rounded-2xl overflow-hidden shadow-xl" style={{ backgroundColor: '#264FFF' }}>
                        <div className="px-5 py-6 flex items-center gap-4">
                          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 flex-shrink-0">
                            <Heart size={28} className="text-white fill-white" />
                          </div>
                          <div>
                            <h1 className="text-xl sm:text-2xl font-bold text-white">{pageTitles.favorites}</h1>
                            <p className="text-sm text-white/90 mt-0.5">
                              {shopFavorites.length + myWatchlist.length + magazineFavoritesArticles.length + enfantFavoritesActivities.length + restaurantFavoritesList.length} élément{(shopFavorites.length + myWatchlist.length + magazineFavoritesArticles.length + enfantFavoritesActivities.length + restaurantFavoritesList.length) !== 1 ? 's' : ''} en favori{(shopFavorites.length + myWatchlist.length + magazineFavoritesArticles.length + enfantFavoritesActivities.length + restaurantFavoritesList.length) !== 1 ? 's' : ''}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Favoris par catégorie */}
                      <div className="space-y-8">
                        {/* Catégorie Boutique */}
                        {shopFavorites.length > 0 && (
                          <section className="rounded-2xl bg-white shadow-lg border border-slate-100 overflow-hidden">
                            <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2" style={{ backgroundColor: '#264FFF' }}>
                              <ShoppingBag size={20} className="text-white" />
                              <h2 className="text-lg font-bold text-white">{t('shop.title')}</h2>
                            </div>
                            <div className="p-4 space-y-6">
                              {shopCategories.filter(c => c.id !== 'all').map((cat) => {
                                const items = shopFavorites.filter(p => p.category === cat.id);
                                if (items.length === 0) return null;
                                return (
                                  <div key={cat.id}>
                                    <h3 className="text-sm font-semibold text-slate-500 mb-2 flex items-center gap-2">
                                      <span>{cat.icon}</span> {cat.name}
                                    </h3>
                                    <div className="space-y-2">
                                      {items.map((item) => (
                                        <motion.div
                                          key={item.id}
                                          layout
                                          className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100"
                                        >
                                          <div className="relative h-12 w-12 rounded-lg overflow-hidden bg-rose-100 flex-shrink-0">
                                            <img src={item.image} alt={item.name} className="w-full h-full object-cover" loading="lazy" decoding="async" onError={(e) => { e.target.style.display = 'none'; }} />
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-slate-900 line-clamp-1">{item.name}</p>
                                            <p className="text-sm font-bold text-rose-600">{item.price.toFixed(2)}€</p>
                                          </div>
                                          <button
                                            onClick={() => removeFromShopFavorites(item.id)}
                                            className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                          >
                                            <Trash2 size={18} />
                                          </button>
                                        </motion.div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                              {/* Produits sans catégorie ou catégorie "all" */}
                              {(() => {
                                const items = shopFavorites.filter(p => !p.category || p.category === 'all');
                                if (items.length === 0) return null;
                                return (
                                  <div>
                                    <h3 className="text-sm font-semibold text-slate-500 mb-2">{t('shop.categories.all')}</h3>
                                    <div className="space-y-2">
                                      {items.map((item) => (
                                        <motion.div key={item.id} layout className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                                          <div className="relative h-12 w-12 rounded-lg overflow-hidden bg-rose-100 flex-shrink-0">
                                            <img src={item.image} alt={item.name} className="w-full h-full object-cover" loading="lazy" decoding="async" onError={(e) => { e.target.style.display = 'none'; }} />
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-slate-900 line-clamp-1">{item.name}</p>
                                            <p className="text-sm font-bold text-rose-600">{item.price.toFixed(2)}€</p>
                                          </div>
                                          <button onClick={() => removeFromShopFavorites(item.id)} className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={18} /></button>
                                        </motion.div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          </section>
                        )}

                        {/* Catégorie Films & Séries */}
                        {myWatchlist.length > 0 && (
                          <section className="rounded-2xl bg-white shadow-lg border border-slate-100 overflow-hidden">
                            <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2" style={{ backgroundColor: '#264FFF' }}>
                              <Clapperboard size={20} className="text-white" />
                              <h2 className="text-lg font-bold text-white">{t('common.movies')}</h2>
                            </div>
                            <div className="p-4 space-y-2">
                              {myWatchlist.map((item) => (
                                <motion.div
                                  key={item.id}
                                  layout
                                  onClick={() => { setMovieToOpenFromFavorites(item); setPage('movies'); }}
                                  className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors"
                                >
                                  <div className="relative h-14 w-14 rounded-lg overflow-hidden bg-slate-200 flex-shrink-0">
                                    {item.poster ? (
                                      <img src={getPosterUrl(item.poster)} alt={(item.translations?.[language]?.title) ?? item.title} className="w-full h-full object-cover object-center" loading="lazy" decoding="async" />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center"><Clapperboard size={24} className="text-slate-500" /></div>
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-slate-900 line-clamp-1">{(item.translations?.[language]?.title) ?? item.title}</p>
                                    <p className="text-xs text-slate-500">{item.type === 'film' ? t('movies.films') : t('movies.series')} · {item.year}</p>
                                  </div>
                                  <ChevronRight size={18} className="text-slate-500 flex-shrink-0" />
                                </motion.div>
                              ))}
                            </div>
                          </section>
                        )}

                        {/* Catégorie Magazine */}
                        {magazineFavoritesArticles.length > 0 && (
                          <section className="rounded-2xl bg-white shadow-lg border border-slate-100 overflow-hidden">
                            <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2" style={{ backgroundColor: '#264FFF' }}>
                              <BookOpen size={20} className="text-white" />
                              <h2 className="text-lg font-bold text-white">{t('common.magazine')}</h2>
                            </div>
                            <div className="p-4 space-y-2">
                              {magazineFavoritesArticles.map((article) => (
                                <motion.div
                                  key={article.id ?? article._id}
                                  layout
                                  onClick={() => { setSelectedArticle(article); setPage('magazine'); }}
                                  className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors"
                                >
                                  <div className="relative h-14 w-14 rounded-lg overflow-hidden bg-slate-200 flex-shrink-0">
                                    {article.image ? (
                                      <img src={getPosterUrl(article.image) || article.image} alt={article.title} className="w-full h-full object-cover" loading="lazy" decoding="async" />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center"><BookOpen size={24} className="text-slate-500" /></div>
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-slate-900 line-clamp-1">{article.title}</p>
                                    <p className="text-xs text-slate-500">{magazineCategories.find(c => c.id === article.category)?.name || article.category}</p>
                                  </div>
                                  <ChevronRight size={18} className="text-slate-500 flex-shrink-0" />
                                </motion.div>
                              ))}
                            </div>
                          </section>
                        )}

                        {/* Catégorie Activités Enfant */}
                        {enfantFavoritesActivities.length > 0 && (
                          <section className="rounded-2xl bg-white shadow-lg border border-slate-100 overflow-hidden">
                            <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2" style={{ backgroundColor: '#264FFF' }}>
                              <Baby size={20} className="text-white" />
                              <h2 className="text-lg font-bold text-white">{t('enfant.title')}</h2>
                            </div>
                            <div className="p-4 space-y-2">
                              {enfantFavoritesActivities.map((activity) => (
                                <motion.div
                                  key={activity.id}
                                  layout
                                  onClick={() => { setSelectedActivity(activity); setPage('enfant'); }}
                                  className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors"
                                >
                                  <div className="relative h-14 w-14 rounded-lg overflow-hidden bg-slate-200 flex-shrink-0">
                                    {activity.image ? (
                                      <img src={activity.image} alt={activity.name} className="w-full h-full object-cover object-center" loading="lazy" decoding="async" onError={(e) => { e.target.style.display = 'none'; }} />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center"><Baby size={24} className="text-slate-500" /></div>
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-slate-900 line-clamp-1">{activity.name}</p>
                                    <p className="text-xs text-slate-500">{activity.ageRange}{activity.openingHours ? ` · ${activity.openingHours}` : ''}</p>
                                  </div>
                                  <ChevronRight size={18} className="text-slate-500 flex-shrink-0" />
                                </motion.div>
                              ))}
                            </div>
                          </section>
                        )}

                        {/* Catégorie Restaurants */}
                        {restaurantFavoritesList.length > 0 && (
                          <section className="rounded-2xl bg-white shadow-lg border border-slate-100 overflow-hidden">
                            <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2" style={{ backgroundColor: '#264FFF' }}>
                              <Utensils size={20} className="text-white" />
                              <h2 className="text-lg font-bold text-white">{t('restaurants.title')}</h2>
                            </div>
                            <div className="p-4 space-y-2">
                              {restaurantFavoritesList.map((restaurant) => (
                                <motion.div
                                  key={restaurant.id}
                                  layout
                                  onClick={() => { setSelectedRestaurant(restaurant); setPage('restaurant'); }}
                                  className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors"
                                >
                                  <div className="relative h-14 w-14 rounded-lg overflow-hidden bg-slate-200 flex-shrink-0">
                                    <img
                                      src={getRadioLogoUrl(restaurant.image) || restaurant.image || DEFAULT_RESTAURANT_IMAGE}
                                      alt={restaurant.name}
                                      className="w-full h-full object-cover object-center"
                                      loading="lazy"
                                      decoding="async"
                                      onError={(e) => { e.target.style.display = 'none'; }}
                                    />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-slate-900 line-clamp-1">{restaurant.name}</p>
                                    <p className="text-xs text-slate-500">{restaurant.location}{restaurant.priceRange ? ` · ${restaurant.priceRange}` : ''}</p>
                                  </div>
                                  <ChevronRight size={18} className="text-slate-500 flex-shrink-0" />
                                </motion.div>
                              ))}
                            </div>
                          </section>
                        )}

                        {shopFavorites.length === 0 && myWatchlist.length === 0 && magazineFavoritesArticles.length === 0 && enfantFavoritesActivities.length === 0 && restaurantFavoritesList.length === 0 && (
                          <div className="rounded-2xl bg-white shadow-lg border border-slate-100 p-8 text-center">
                            <Heart size={48} className="mx-auto text-slate-300 mb-3" />
                            <p className="text-slate-600 font-medium">{t('common.noFavoritesYet')}</p>
                            <p className="text-sm text-slate-500 mt-1">{t('shop.favoritesEmptyHint')}</p>
                            <div className="flex flex-wrap justify-center gap-3 mt-4">
                              <button onClick={() => setPage('shop')} className="px-4 py-2 rounded-xl font-medium text-white" style={{ backgroundColor: '#264FFF' }}>{t('common.shop')}</button>
                              <button onClick={() => setPage('movies')} className="px-4 py-2 rounded-xl font-medium text-white" style={{ backgroundColor: '#264FFF' }}>{t('common.movies')}</button>
                              <button onClick={() => setPage('magazine')} className="px-4 py-2 rounded-xl font-medium text-white" style={{ backgroundColor: '#264FFF' }}>{t('common.magazine')}</button>
                              <button onClick={() => setPage('restaurant')} className="px-4 py-2 rounded-xl font-medium text-white" style={{ backgroundColor: '#264FFF' }}>{t('restaurants.title')}</button>
                              <button onClick={() => setPage('enfant')} className="px-4 py-2 rounded-xl font-medium text-white" style={{ backgroundColor: '#264FFF' }}>{t('enfant.title')}</button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ) : page === 'shop' ? (
                  <motion.div
                    key="shop"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.25 }}
                    className="min-h-screen bg-slate-50"
                  >
                    <div className="mx-auto w-full max-w-5xl px-3 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-6 sm:space-y-8">
                      {/* En-tête shop — fin et moderne, dans un bloc bleu */}
                      <header className="space-y-4">
                        <div className="rounded-2xl p-4 sm:p-5 shadow-md border border-blue-200/50" style={{ backgroundColor: '#264FFF' }}>
                          <div className="flex items-start gap-3 sm:gap-4">
                            <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-white/20 border border-white/30 flex-shrink-0 backdrop-blur-sm">
                              <ShoppingBag size={24} className="text-white sm:w-6 sm:h-6" strokeWidth={1.75} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">{t('shop.pageTitle')}</h1>
                              <p className="text-sm text-blue-100 mt-0.5">{t('shop.subtitle')}</p>
                              <div className="flex flex-wrap items-center gap-2 mt-3">
                                <span className="inline-flex items-center gap-1.5 text-xs text-white bg-white/20 px-2.5 py-1 rounded-full border border-white/30">
                                  <Ship size={12} />
                                  {t('shop.deck')}
                                </span>
                                <span className="inline-flex items-center gap-1.5 text-xs text-white bg-white/20 px-2.5 py-1 rounded-full border border-white/30">
                                  <Clock size={12} />
                                  {t('shop.hours')}
                                </span>
                                <span className="inline-flex items-center gap-1.5 text-xs text-white bg-white/20 px-2.5 py-1 rounded-full border border-white/30">
                                  <Award size={12} />
                                  {t('shop.officialProducts')}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Recherche — barre claire, ergonomique */}
                        <div className="relative">
                          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                          <input
                            type="text"
                            placeholder={t('shop.searchPlaceholder')}
                            value={shopSearchQuery}
                            onChange={(e) => setShopSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white border border-slate-200/80 text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-300 transition-all shadow-sm"
                          />
                        </div>

                        {/* Catégories — menu déroulant */}
                        <div className="relative">
                          <label htmlFor="shop-category" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">{t('shop.categoryLabel')}</label>
                          <select
                            id="shop-category"
                            value={selectedShopCategory}
                            onChange={(e) => setSelectedShopCategory(e.target.value)}
                            className="w-full appearance-none pl-4 pr-10 py-3 rounded-2xl bg-white border border-slate-200/80 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-300 transition-all shadow-sm [&>option]:text-slate-800"
                          >
                            {shopCategories.map((category) => (
                              <option key={category.id} value={category.id}>
                                {category.icon} {category.name}
                              </option>
                            ))}
                          </select>
                          <ChevronDown size={20} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                        </div>
                      </header>

                      {/* Erreur chargement catalogue */}
                      {!shopLoading && shopError && (
                        <div className="rounded-2xl bg-amber-50/80 border border-amber-200/80 px-4 py-6 text-center">
                          <p className="text-amber-800 font-medium text-sm">{t('shop.loadError')}</p>
                          <p className="text-xs text-amber-700 mt-1.5">{shopError}</p>
                          <p className="text-xs text-amber-600 mt-2 max-w-md mx-auto">{t('shop.loadErrorHint')}</p>
                        </div>
                      )}

                      {/* Promotions boutique — depuis l'API */}
                      {shopPromotions.length > 0 && (
                        <section className="space-y-3">
                          <h2 className="text-sm font-semibold text-slate-500 tracking-widest uppercase">{t('shop.currentPromos')}</h2>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {shopPromotions.map((promo) => {
                              const promoTitle = (promo.translations && promo.translations[language] && promo.translations[language].title) ? promo.translations[language].title : (promo.title || '');
                              const promoDesc = (promo.translations && promo.translations[language] && promo.translations[language].description) ? promo.translations[language].description : (promo.description || '');
                              const discountLabel = promo.discountType === 'percentage' ? `-${promo.discountValue || 0}%` : `-${promo.discountValue || 0}€`;
                              const validFrom = promo.validFrom ? (typeof promo.validFrom === 'string' ? promo.validFrom.slice(0, 10) : promo.validFrom.toISOString?.()?.slice(0, 10)) : '';
                              const validUntil = promo.validUntil ? (typeof promo.validUntil === 'string' ? promo.validUntil.slice(0, 10) : promo.validUntil.toISOString?.()?.slice(0, 10)) : '';
                              return (
                                <div
                                  key={promo.id || promo._id}
                                  className="rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-md border border-emerald-400/30 px-4 py-3 text-left"
                                >
                                  <p className="text-sm font-semibold mt-0 line-clamp-2">{promoTitle}</p>
                                  {promoDesc ? <p className="text-xs text-white/90 mt-1.5 line-clamp-2">{promoDesc}</p> : null}
                                  <div className="mt-2 flex items-center justify-between gap-2 flex-wrap">
                                    <span className="text-sm font-bold bg-white/20 px-2 py-0.5 rounded-full">{discountLabel}</span>
                                    {validFrom && validUntil ? (
                                      <span className="text-[10px] text-white/80">
                                        {validFrom} → {validUntil}
                                      </span>
                                    ) : null}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </section>
                      )}

                      {/* Produits vedettes — cartes fines */}
                      {shopProducts.some((product) => product.isFeatured) && (
                        <section className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h2 className="text-sm font-semibold text-slate-500 tracking-widest uppercase">{t('shop.featuredTitle')}</h2>
                            <span className="text-xs text-slate-500">{t('shop.featuredSubtitle')}</span>
                          </div>
                          <div className="space-y-2.5">
                            {shopProducts.filter((product) => product.isFeatured).map((product, index) => (
                              <motion.button
                                key={product.id}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                                onClick={() => {
                                  setSelectedProduct(product);
                                  setSelectedProductImageIndex(0);
                                }}
                                whileTap={{ scale: 0.99 }}
                                className="w-full text-left rounded-2xl bg-white border border-slate-200/80 p-3 sm:p-4 shadow-sm hover:shadow hover:border-slate-300/80 transition-all flex gap-3 sm:gap-4 items-center group"
                              >
                                <div className="relative h-16 w-16 sm:h-20 sm:w-20 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0 border border-slate-100">
                                  <img
                                    src={product.image}
                                    alt={product.name}
                                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                    loading="lazy"
                                    decoding="async"
                                    onError={(e) => {
                                      e.target.style.display = 'none';
                                      e.target.nextElementSibling.style.display = 'flex';
                                    }}
                                  />
                                  <div className="absolute inset-0 hidden items-center justify-center bg-slate-200">
                                    <Ship size={24} className="text-slate-500" />
                                  </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                    <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">{getProductTypeLabel(product.type)}</span>
                                    {product.tag && (
                                      <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">{product.tag}</span>
                                    )}
                                  </div>
                                  <h3 className="text-sm font-semibold text-slate-900 line-clamp-2 leading-snug">{product.name}</h3>
                                  <div className="flex items-baseline gap-2 mt-1">
                                    <span className="text-base font-bold text-slate-900">{product.price.toFixed(2)}€</span>
                                    {product.originalPrice > product.price && (
                                      <span className="text-xs text-slate-500 line-through">{product.originalPrice.toFixed(2)}€</span>
                                    )}
                                    {product.discount > 0 && (
                                      <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">-{product.discount}%</span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); toggleShopFavorite(product); }}
                                    className={`p-2 rounded-xl transition-colors ${
                                      isShopFavorite(product.id) ? 'bg-rose-50 text-rose-500' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-600'
                                    }`}
                                  >
                                    <Heart size={18} className={isShopFavorite(product.id) ? 'fill-current' : ''} strokeWidth={1.75} />
                                  </button>
                                  <ChevronRight size={18} className="text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all" />
                                </div>
                              </motion.button>
                            ))}
                          </div>
                        </section>
                      )}

                      {/* Catalogue — grille produits, ergonomie mobile */}
                      <section className="space-y-4">
                        <div className="flex items-baseline justify-between gap-3">
                          <div>
                            <h2 className="text-sm font-semibold text-slate-500 tracking-widest uppercase">{t('shop.catalogueTitle')}</h2>
                            <p className="text-xs text-slate-500 mt-0.5">{t('shop.catalogueSubtitle')}</p>
                          </div>
                          <span className="shrink-0 text-xs font-medium text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full">
                            {shopLoading ? '…' : `${filteredShopProducts.length}`} produit{filteredShopProducts.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                        {shopLoading ? (
                          <div className="flex items-center justify-center min-h-[280px] rounded-2xl bg-white border border-slate-200/80">
                            <div className="flex flex-col items-center gap-3">
                              <div className="animate-spin rounded-full h-10 w-10 border-2 border-slate-200 border-t-slate-500" />
                              <p className="text-xs text-slate-500">{t('common.loading')}</p>
                            </div>
                          </div>
                        ) : filteredShopProducts.length === 0 ? (
                          <div className="rounded-2xl bg-white border border-slate-200/80 px-4 py-12 text-center">
                            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-100 text-slate-500 mb-4">
                              <ShoppingBag size={28} strokeWidth={1.5} />
                            </div>
                            <p className="text-slate-800 font-medium text-sm">{t('shop.catalogueEmpty') || 'Aucun produit'}</p>
                            <p className="text-xs text-slate-500 mt-1.5 max-w-sm mx-auto">{t('shop.catalogueEmptyHint')}</p>
                          </div>
                        ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                        {filteredShopProducts.map((product, index) => (
                          <motion.div
                            key={product.id}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: Math.min(index * 0.03, 0.2) }}
                            whileTap={{ scale: 0.98 }}
                            className="group bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow hover:border-slate-300/80 overflow-hidden transition-all duration-200"
                          >
                              <button
                                onClick={() => { setSelectedProduct(product); setSelectedProductImageIndex(0); }}
                                className="w-full text-left block"
                              >
                                <div className="relative aspect-[3/4] sm:aspect-[4/3] bg-slate-100 overflow-hidden">
                                  <img
                                    src={product.image}
                                    alt={product.name}
                                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                    loading="lazy"
                                    decoding="async"
                                    onError={(e) => {
                                      e.target.style.display = 'none';
                                      e.target.nextElementSibling.style.display = 'flex';
                                    }}
                                  />
                                  <div className="absolute inset-0 hidden items-center justify-center bg-slate-200">
                                    <Ship size={32} className="text-slate-500" />
                                  </div>
                                  <div className="absolute top-2 left-2 flex flex-col gap-1">
                                    <span className="rounded-md bg-white/95 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">{getProductTypeLabel(product.type)}</span>
                                    {product.tag && (
                                      <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">{product.tag}</span>
                                    )}
                                  </div>
                                  <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
                                    {product.discount > 0 && (
                                      <span className="rounded-md bg-red-500 text-white px-1.5 py-0.5 text-[10px] font-bold">-{product.discount}%</span>
                                    )}
                                    <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ${product.isAvailable ? 'bg-emerald-500/90 text-white' : 'bg-slate-600 text-white'}`}>
                                      {product.isAvailable ? 'Dispo' : 'Rupture'}
                                    </span>
                                  </div>
                                </div>
                              </button>
                              <div className="p-3 sm:p-4 space-y-2.5">
                                <h3 className="text-sm font-semibold text-slate-900 line-clamp-2 leading-snug min-h-[2.5em]">
                                  {product.name}
                                </h3>
                                <div className="flex items-baseline gap-1.5">
                                  <span className="text-base font-bold text-slate-900">{product.price.toFixed(2)}€</span>
                                  {product.originalPrice > product.price && (
                                    <span className="text-xs text-slate-500 line-through">{product.originalPrice.toFixed(2)}€</span>
                                  )}
                                </div>
                                {product.features && product.features.length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {product.features.slice(0, 2).map((feature, idx) => (
                                      <span key={idx} className="px-2 py-0.5 rounded-md bg-slate-50 text-slate-600 text-[10px] font-medium border border-slate-100">
                                        {feature}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                <button
                                  onClick={(e) => { e.stopPropagation(); toggleShopFavorite(product); }}
                                  className={`w-full py-2.5 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                                    isShopFavorite(product.id)
                                      ? 'bg-rose-50 text-rose-600 border border-rose-200'
                                      : 'bg-slate-100 text-slate-700 border border-slate-200/80 hover:bg-slate-200/80'
                                  }`}
                                >
                                  <Heart size={14} className={isShopFavorite(product.id) ? 'fill-current' : ''} strokeWidth={1.75} />
                                  {isShopFavorite(product.id) ? t('shop.removeFromFavorites') : t('shop.addToFavorites')}
                                </button>
                              </div>
                          </motion.div>
                        ))}
                      </div>
                        )}
                      </section>

                      {/* Favoris — mise en page fine */}
                      {shopFavorites.length > 0 && (
                        <section className="rounded-2xl bg-white border border-slate-200/80 shadow-sm overflow-hidden">
                          <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 border border-rose-100">
                              <Heart size={18} className="text-rose-500 fill-rose-500" strokeWidth={1.75} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="text-sm font-semibold text-slate-900">{t('shop.myFavorites')}</h3>
                              <p className="text-xs text-slate-500">{shopFavorites.length} produit{shopFavorites.length !== 1 ? 's' : ''}</p>
                            </div>
                          </div>
                          <div className="p-3 space-y-2">
                            {shopFavorites.map((item) => (
                              <motion.div
                                key={item.id}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="flex items-center gap-3 rounded-xl bg-slate-50/80 border border-slate-100 p-3"
                              >
                                <div className="relative h-12 w-12 rounded-lg overflow-hidden bg-slate-200 flex-shrink-0">
                                  <img
                                    src={item.image}
                                    alt={item.name}
                                    className="absolute inset-0 w-full h-full object-cover object-center"
                                    onError={(e) => {
                                      e.target.style.display = 'none';
                                      if (e.target.nextElementSibling) e.target.nextElementSibling.style.display = 'flex';
                                    }}
                                  />
                                  <div className="absolute inset-0 hidden items-center justify-center bg-slate-200">
                                    <Heart size={16} className="text-slate-500 fill-slate-400" />
                                  </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-slate-900 line-clamp-2">{item.name}</p>
                                  <p className="text-sm font-bold text-slate-700 mt-0.5">{item.price.toFixed(2)}€</p>
                                </div>
                                <button
                                  onClick={() => removeFromShopFavorites(item.id)}
                                  className="p-2 rounded-lg text-slate-500 hover:text-rose-500 hover:bg-rose-50 transition-colors flex-shrink-0"
                                  aria-label="Retirer des favoris"
                                >
                                  <Trash2 size={16} strokeWidth={1.75} />
                                </button>
                              </motion.div>
                            ))}
                          </div>
                        </section>
                      )}
                    </div>

                    {/* Modal détail produit — centré sur mobile et desktop */}
                    {selectedProduct && (
                      <div 
                        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4"
                        style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
                        onClick={(e) => { if (e.target === e.currentTarget) { setPage('home'); setSelectedProduct(null); setSelectedProductImageIndex(0); } }}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="product-detail-title"
                      >
                        <motion.div
                          initial={{ opacity: 0, scale: 0.96 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.96 }}
                          transition={{ type: "spring", damping: 30, stiffness: 300 }}
                          onClick={(e) => e.stopPropagation()}
                          className="bg-white rounded-2xl max-w-full w-full sm:max-w-lg max-h-[94vh] sm:max-h-[88vh] overflow-hidden shadow-xl border border-slate-200/80 flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] shop-product-detail-modal"
                        >
                          {/* Barre de tirage (mobile) */}
                          <div className="flex-shrink-0 flex justify-center pt-2 pb-1 sm:hidden">
                            <div className="w-10 h-1 rounded-full bg-slate-300" aria-hidden="true" />
                          </div>
                          <div className="relative flex-shrink-0">
                            <div className="relative h-56 sm:h-64 bg-slate-100 min-h-[220px]">
                              <img
                                src={selectedProduct.gallery && selectedProduct.gallery.length > 0 
                                  ? selectedProduct.gallery[selectedProductImageIndex] 
                                  : selectedProduct.image}
                                alt={selectedProduct.name}
                                className="w-full h-full object-cover object-center"
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                  e.target.nextElementSibling.style.display = 'flex';
                                }}
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent flex items-center justify-center text-white font-bold text-4xl hidden">
                                🛍️
                              </div>
                              
                              {selectedProduct.gallery && selectedProduct.gallery.length > 1 && (
                                <>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedProductImageIndex(prev => prev === 0 ? selectedProduct.gallery.length - 1 : prev - 1);
                                    }}
                                    className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 p-2.5 sm:p-2 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center bg-white/95 rounded-full text-slate-700 shadow-md hover:bg-white transition-colors"
                                    aria-label="Image précédente"
                                  >
                                    <ChevronLeft size={20} className="sm:w-[18px] sm:h-[18px]" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedProductImageIndex(prev => prev === selectedProduct.gallery.length - 1 ? 0 : prev + 1);
                                    }}
                                    className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 p-2.5 sm:p-2 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center bg-white/95 rounded-full text-slate-700 shadow-md hover:bg-white transition-colors"
                                    aria-label="Image suivante"
                                  >
                                    <ChevronRight size={20} className="sm:w-[18px] sm:h-[18px]" />
                                  </button>
                                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
                                    {selectedProduct.gallery.map((_, index) => (
                                      <button
                                        key={`gallery-dot-${index}`}
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); setSelectedProductImageIndex(index); }}
                                        className={`h-1.5 rounded-full transition-all flex-shrink-0 ${
                                          index === selectedProductImageIndex ? 'bg-white w-6' : 'bg-white/60 w-1.5 hover:bg-white/80'
                                        }`}
                                        aria-label={`Image ${index + 1}`}
                                      />
                                    ))}
                                  </div>
                                </>
                              )}
                              <button
                                type="button"
                                onClick={() => { setPage('home'); setSelectedProduct(null); setSelectedProductImageIndex(0); }}
                                className="absolute top-3 right-3 p-2.5 sm:p-2 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center bg-white/95 rounded-full text-slate-700 shadow-md hover:bg-white transition-colors"
                                aria-label="Fermer"
                              >
                                <X size={20} className="sm:w-[18px] sm:h-[18px]" />
                              </button>
                              <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-4 pt-6 sm:pt-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
                                <h2 id="product-detail-title" className="text-lg sm:text-lg font-semibold text-white mb-1.5 line-clamp-2 leading-snug drop-shadow-sm">
                                  {selectedProduct.name}
                                </h2>
                                <div className="flex flex-wrap items-center gap-2 text-white/95">
                                  <span className="text-base sm:text-base font-bold">{selectedProduct.price.toFixed(2)}€</span>
                                  {selectedProduct.originalPrice > selectedProduct.price && (
                                    <span className="text-sm line-through opacity-90">{selectedProduct.originalPrice.toFixed(2)}€</span>
                                  )}
                                  {selectedProduct.discount > 0 && (
                                    <span className="text-[10px] font-bold bg-red-500 text-white px-2 py-1 rounded">-{selectedProduct.discount}%</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            {selectedProduct.gallery && selectedProduct.gallery.length > 1 && (
                              <div className="flex gap-2 p-3 sm:p-3 bg-slate-50 overflow-x-auto overflow-y-hidden scrollbar-hide -webkit-overflow-scrolling-touch">
                                {selectedProduct.gallery.map((img, index) => (
                                  <button
                                    key={`gallery-thumb-${index}`}
                                    type="button"
                                    onClick={() => setSelectedProductImageIndex(index)}
                                    className={`shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-lg overflow-hidden border-2 transition-all ${
                                      index === selectedProductImageIndex ? 'border-slate-900 ring-2 ring-slate-300 ring-offset-1' : 'border-slate-200 hover:border-slate-300'
                                    }`}
                                  >
                                    <img src={img} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="p-4 sm:p-5 pb-8 sm:pb-5 overflow-y-auto flex-1 min-h-0 space-y-4 sm:space-y-5 overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
                            <div>
                              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Description</h3>
                              <p className="text-sm sm:text-sm text-slate-600 leading-relaxed">{selectedProduct.description}</p>
                            </div>
                            {selectedProduct.features && selectedProduct.features.length > 0 && (
                              <div>
                                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Caractéristiques</h4>
                                <div className="flex flex-wrap gap-1.5">
                                  {selectedProduct.features.map((feature, index) => (
                                    <span key={index} className="px-2.5 py-1.5 sm:py-1 bg-slate-100 text-slate-700 text-xs font-medium rounded-lg border border-slate-200/80">
                                      {feature}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {selectedProduct.specifications && Object.keys(selectedProduct.specifications).length > 0 && (
                              <div>
                                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Spécifications</h4>
                                <div className="space-y-1.5">
                                  {Object.entries(selectedProduct.specifications).map(([key, value]) => (
                                    <div key={key} className="flex justify-between text-sm py-2 sm:py-1.5 border-b border-slate-100 last:border-0 gap-2">
                                      <span className="text-slate-500 capitalize flex-shrink-0">{key}</span>
                                      <span className="font-medium text-slate-800 text-right break-words">{value}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            <div className="space-y-3 pt-2">
                              <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-4">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs font-medium text-slate-500">Prix</span>
                                  <span className="text-xl sm:text-2xl font-bold text-slate-900">{selectedProduct.price.toFixed(2)}€</span>
                                </div>
                                {selectedProduct.originalPrice > selectedProduct.price && (
                                  <p className="text-xs text-slate-500 line-through">{selectedProduct.originalPrice.toFixed(2)}€</p>
                                )}
                                <div className="flex items-center justify-between text-xs text-slate-500 mt-2 pt-2 border-t border-slate-200/80">
                                  <span className="flex items-center gap-1"><Ship size={12} /> Stock</span>
                                  <span className="font-medium text-slate-700">{selectedProduct.stock} unités</span>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => toggleShopFavorite(selectedProduct)}
                                className={`w-full py-3.5 sm:py-3.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all min-h-[48px] ${
                                  isShopFavorite(selectedProduct.id)
                                    ? 'bg-rose-50 text-rose-600 border-2 border-rose-200 hover:bg-rose-100'
                                    : 'bg-slate-900 text-white hover:bg-slate-800 border-2 border-slate-900'
                                }`}
                              >
                                <Heart size={18} className={isShopFavorite(selectedProduct.id) ? 'fill-current' : ''} strokeWidth={1.75} />
                                {isShopFavorite(selectedProduct.id) ? t('shop.removeFromFavorites') : t('shop.addToFavorites')}
                              </button>
                              <p className="flex items-center justify-center gap-1.5 text-xs text-slate-500">
                                <Award size={12} /> Produit officiel GNV
                              </p>
                            </div>
                          </div>
                        </motion.div>
                      </div>
                    )}

                    {/* Sidebar Favoris (desktop) — masqué */}
                    {false && shopFavorites.length > 0 && (
                      <div className="hidden md:block fixed right-4 top-1/2 transform -translate-y-1/2 z-40">
                        <motion.div
                          initial={{ opacity: 0, x: 8 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="bg-white rounded-2xl shadow-sm p-4 w-64 max-h-[80vh] overflow-y-auto border border-slate-200/80"
                        >
                          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
                            <h3 className="font-semibold text-slate-900 flex items-center gap-2 text-sm">
                              <Heart size={16} className="text-rose-500 fill-rose-500" strokeWidth={1.75} />
                              {t('common.favorites')} ({shopFavorites.length})
                            </h3>
                            <button
                              onClick={() => setShopFavorites([])}
                              className="text-slate-500 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                            >
                              <X size={14} />
                            </button>
                          </div>
                          <div className="space-y-2">
                            {shopFavorites.map((item) => (
                              <div key={item.id} className="flex items-center gap-2.5 p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                                <img
                                  src={item.image}
                                  alt={item.name}
                                  className="w-10 h-10 object-cover rounded-lg flex-shrink-0"
                                  loading="lazy"
                                  decoding="async"
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                    if (e.target.nextElementSibling) e.target.nextElementSibling.style.display = 'flex';
                                  }}
                                />
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-medium text-xs text-slate-900 line-clamp-2">{item.name}</h4>
                                  <div className="font-semibold text-slate-700 text-xs mt-0.5">{item.price.toFixed(2)}€</div>
                                </div>
                                <button
                                  onClick={() => removeFromShopFavorites(item.id)}
                                  className="text-slate-500 hover:text-rose-500 p-1.5 rounded-lg hover:bg-rose-50 transition-colors flex-shrink-0"
                                >
                                  <Trash2 size={14} strokeWidth={1.75} />
                                </button>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      </div>
                    )}
                  </motion.div>
                ) : page === 'favorites' ? (
                  <motion.div
                    key="favorites"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.25 }}
                    className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-cyan-50/20"
                  >
                    <div className="mx-auto w-full max-w-3xl px-4 sm:px-5 py-6 sm:py-8 space-y-6">
                      <div className="relative rounded-2xl overflow-hidden shadow-xl" style={{ backgroundColor: '#264FFF' }}>
                        <div className="px-5 py-6 flex items-center gap-4">
                          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 flex-shrink-0">
                            <Heart size={28} className="text-white fill-white" />
                          </div>
                          <div>
                            <h1 className="text-xl sm:text-2xl font-bold text-white">{pageTitles.favorites}</h1>
                            <p className="text-sm text-white/90 mt-0.5">
                              {shopFavorites.length + myWatchlist.length + magazineFavoritesArticles.length + enfantFavoritesActivities.length + restaurantFavoritesList.length} élément{(shopFavorites.length + myWatchlist.length + magazineFavoritesArticles.length + enfantFavoritesActivities.length + restaurantFavoritesList.length) !== 1 ? 's' : ''} en favori{(shopFavorites.length + myWatchlist.length + magazineFavoritesArticles.length + enfantFavoritesActivities.length + restaurantFavoritesList.length) !== 1 ? 's' : ''}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-8">
                        {shopFavorites.length > 0 && (
                          <section className="rounded-2xl bg-white shadow-lg border border-slate-100 overflow-hidden">
                            <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2" style={{ backgroundColor: '#264FFF' }}>
                              <ShoppingBag size={20} className="text-white" />
                              <h2 className="text-lg font-bold text-white">{t('shop.title')}</h2>
                            </div>
                            <div className="p-4 space-y-6">
                              {shopCategories.filter(c => c.id !== 'all').map((cat) => {
                                const items = shopFavorites.filter(p => p.category === cat.id);
                                if (items.length === 0) return null;
                                return (
                                  <div key={cat.id}>
                                    <h3 className="text-sm font-semibold text-slate-500 mb-2 flex items-center gap-2"><span>{cat.icon}</span> {cat.name}</h3>
                                    <div className="space-y-2">
                                      {items.map((item) => (
                                        <motion.div key={item.id} layout className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                                          <div className="relative h-12 w-12 rounded-lg overflow-hidden bg-rose-100 flex-shrink-0">
                                            <img src={item.image} alt={item.name} className="w-full h-full object-cover" loading="lazy" decoding="async" onError={(e) => { e.target.style.display = 'none'; }} />
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-slate-900 line-clamp-1">{item.name}</p>
                                            <p className="text-sm font-bold text-rose-600">{item.price.toFixed(2)}€</p>
                                          </div>
                                          <button onClick={() => removeFromShopFavorites(item.id)} className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={18} /></button>
                                        </motion.div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                              {(() => {
                                const items = shopFavorites.filter(p => !p.category || p.category === 'all');
                                if (items.length === 0) return null;
                                return (
                                  <div>
                                    <h3 className="text-sm font-semibold text-slate-500 mb-2">{t('shop.categories.all')}</h3>
                                    <div className="space-y-2">
                                      {items.map((item) => (
                                        <motion.div key={item.id} layout className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                                          <div className="relative h-12 w-12 rounded-lg overflow-hidden bg-rose-100 flex-shrink-0"><img src={item.image} alt={item.name} className="w-full h-full object-cover" loading="lazy" decoding="async" onError={(e) => { e.target.style.display = 'none'; }} /></div>
                                          <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-slate-900 line-clamp-1">{item.name}</p>
                                            <p className="text-sm font-bold text-rose-600">{item.price.toFixed(2)}€</p>
                                          </div>
                                          <button onClick={() => removeFromShopFavorites(item.id)} className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={18} /></button>
                                        </motion.div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          </section>
                        )}
                        {myWatchlist.length > 0 && (
                          <section className="rounded-2xl bg-white shadow-lg border border-slate-100 overflow-hidden">
                            <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2" style={{ backgroundColor: '#264FFF' }}>
                              <Clapperboard size={20} className="text-white" />
                              <h2 className="text-lg font-bold text-white">{t('common.movies')}</h2>
                            </div>
                            <div className="p-4 space-y-2">
                              {myWatchlist.map((item) => (
                                <motion.div key={item.id} layout onClick={() => { setMovieToOpenFromFavorites(item); setPage('movies'); }} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors">
                                  <div className="relative h-14 w-14 rounded-lg overflow-hidden bg-slate-200 flex-shrink-0">
                                    {item.poster ? <img src={getPosterUrl(item.poster)} alt={(item.translations?.[language]?.title) ?? item.title} className="w-full h-full object-cover object-center" loading="lazy" decoding="async" /> : <div className="w-full h-full flex items-center justify-center"><Clapperboard size={24} className="text-slate-500" /></div>}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-slate-900 line-clamp-1">{(item.translations?.[language]?.title) ?? item.title}</p>
                                    <p className="text-xs text-slate-500">{item.type === 'film' ? t('movies.films') : t('movies.series')} · {item.year}</p>
                                  </div>
                                  <ChevronRight size={18} className="text-slate-500 flex-shrink-0" />
                                </motion.div>
                              ))}
                            </div>
                          </section>
                        )}
                        {magazineFavoritesArticles.length > 0 && (
                          <section className="rounded-2xl bg-white shadow-lg border border-slate-100 overflow-hidden">
                            <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2" style={{ backgroundColor: '#264FFF' }}>
                              <BookOpen size={20} className="text-white" />
                              <h2 className="text-lg font-bold text-white">{t('common.magazine')}</h2>
                            </div>
                            <div className="p-4 space-y-2">
                              {magazineFavoritesArticles.map((article) => (
                                <motion.div key={article.id ?? article._id} layout onClick={() => { setSelectedArticle(article); setPage('magazine'); }} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors">
                                  <div className="relative h-14 w-14 rounded-lg overflow-hidden bg-slate-200 flex-shrink-0">
                                    {article.image ? <img src={getPosterUrl(article.image) || article.image} alt={article.title} className="w-full h-full object-cover" loading="lazy" decoding="async" /> : <div className="w-full h-full flex items-center justify-center"><BookOpen size={24} className="text-slate-500" /></div>}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-slate-900 line-clamp-1">{article.title}</p>
                                    <p className="text-xs text-slate-500">{magazineCategories.find(c => c.id === article.category)?.name || article.category}</p>
                                  </div>
                                  <ChevronRight size={18} className="text-slate-500 flex-shrink-0" />
                                </motion.div>
                              ))}
                            </div>
                          </section>
                        )}
                        {enfantFavoritesActivities.length > 0 && (
                          <section className="rounded-2xl bg-white shadow-lg border border-slate-100 overflow-hidden">
                            <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2" style={{ backgroundColor: '#264FFF' }}>
                              <Baby size={20} className="text-white" />
                              <h2 className="text-lg font-bold text-white">{t('enfant.title')}</h2>
                            </div>
                            <div className="p-4 space-y-2">
                              {enfantFavoritesActivities.map((activity) => (
                                <motion.div
                                  key={activity.id}
                                  layout
                                  onClick={() => { setSelectedActivity(activity); setPage('enfant'); }}
                                  className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors"
                                >
                                  <div className="relative h-14 w-14 rounded-lg overflow-hidden bg-slate-200 flex-shrink-0">
                                    {activity.image ? <img src={activity.image} alt={activity.name} className="w-full h-full object-cover object-center" loading="lazy" decoding="async" onError={(e) => { e.target.style.display = 'none'; }} /> : <div className="w-full h-full flex items-center justify-center"><Baby size={24} className="text-slate-500" /></div>}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-slate-900 line-clamp-1">{activity.name}</p>
                                    <p className="text-xs text-slate-500">{activity.ageRange}{activity.openingHours ? ` · ${activity.openingHours}` : ''}</p>
                                  </div>
                                  <ChevronRight size={18} className="text-slate-500 flex-shrink-0" />
                                </motion.div>
                              ))}
                            </div>
                          </section>
                        )}
                        {restaurantFavoritesList.length > 0 && (
                          <section className="rounded-2xl bg-white shadow-lg border border-slate-100 overflow-hidden">
                            <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2" style={{ backgroundColor: '#264FFF' }}>
                              <Utensils size={20} className="text-white" />
                              <h2 className="text-lg font-bold text-white">{t('restaurants.title')}</h2>
                            </div>
                            <div className="p-4 space-y-2">
                              {restaurantFavoritesList.map((restaurant) => (
                                <motion.div
                                  key={restaurant.id}
                                  layout
                                  onClick={() => { setSelectedRestaurant(restaurant); setPage('restaurant'); }}
                                  className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors"
                                >
                                  <div className="relative h-14 w-14 rounded-lg overflow-hidden bg-slate-200 flex-shrink-0">
                                    <img src={getRadioLogoUrl(restaurant.image) || restaurant.image || DEFAULT_RESTAURANT_IMAGE} alt={restaurant.name} className="w-full h-full object-cover object-center" loading="lazy" decoding="async" onError={(e) => { e.target.style.display = 'none'; }} />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-slate-900 line-clamp-1">{restaurant.name}</p>
                                    <p className="text-xs text-slate-500">{restaurant.location}{restaurant.priceRange ? ` · ${restaurant.priceRange}` : ''}</p>
                                  </div>
                                  <ChevronRight size={18} className="text-slate-500 flex-shrink-0" />
                                </motion.div>
                              ))}
                            </div>
                          </section>
                        )}
                        {shopFavorites.length === 0 && myWatchlist.length === 0 && magazineFavoritesArticles.length === 0 && enfantFavoritesActivities.length === 0 && restaurantFavoritesList.length === 0 && (
                          <div className="rounded-2xl bg-white shadow-lg border border-slate-100 p-8 text-center">
                            <Heart size={48} className="mx-auto text-slate-300 mb-3" />
                            <p className="text-slate-600 font-medium">{t('common.noFavoritesYet')}</p>
                            <p className="text-sm text-slate-500 mt-1">{t('shop.favoritesEmptyHint')}</p>
                            <div className="flex flex-wrap justify-center gap-3 mt-4">
                              <button onClick={() => setPage('shop')} className="px-4 py-2 rounded-xl font-medium text-white" style={{ backgroundColor: '#264FFF' }}>{t('common.shop')}</button>
                              <button onClick={() => setPage('movies')} className="px-4 py-2 rounded-xl font-medium text-white" style={{ backgroundColor: '#264FFF' }}>{t('common.movies')}</button>
                              <button onClick={() => setPage('magazine')} className="px-4 py-2 rounded-xl font-medium text-white" style={{ backgroundColor: '#264FFF' }}>{t('common.magazine')}</button>
                              <button onClick={() => setPage('restaurant')} className="px-4 py-2 rounded-xl font-medium text-white" style={{ backgroundColor: '#264FFF' }}>{t('restaurants.title')}</button>
                              <button onClick={() => setPage('enfant')} className="px-4 py-2 rounded-xl font-medium text-white" style={{ backgroundColor: '#264FFF' }}>{t('enfant.title')}</button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div key={page} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
                    <div className="mocha-bg">
                      <div className="mocha-logo">MOCHA</div>
                    </div>
                    <div className="relative z-10 mx-auto max-w-full rounded-2xl bg-white/95 backdrop-blur-md p-4 shadow-xl ring-1 ring-black/5 mt-4 mb-20">
                      <h1 className="text-xl font-bold text-slate-900">{pageTitles[page]}</h1>
                      <p className="mt-2 text-sm text-slate-600">Contenu de démo pour la section <span className="font-medium">{page}</span>.</p>
                      <div className="mt-6 flex gap-2">
                        <button onClick={()=>setPage('home')} className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50 transition-colors">Retour</button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              )}
            </main>
          </motion.div>
        )}
      </AnimatePresence>

      <nav
        aria-label="Navigation principale"
        className={`fixed bottom-0 left-0 right-0 z-50 w-full max-w-[768px] min-h-[44px] sm:min-h-[48px] mx-auto bg-gray-50 border-t border-gray-200 overflow-visible safe-area-bottom flex items-center ${!conditionsAccepted ? 'hidden' : ''}`}
        style={{ paddingLeft: 'max(1rem, env(safe-area-inset-left))', paddingRight: 'max(1rem, env(safe-area-inset-right))' }}
      >
        <div className="flex items-center justify-center sm:justify-start w-full py-1.5 px-2 sm:px-2 gap-0 sm:gap-1 min-h-[44px] sm:min-h-[48px] overflow-visible">
          {useMemo(() => [
            { key: 'home', icon: <Home size={26} />, label: t('common.home') },
            { key: 'radio', icon: <Radio size={26} />, label: t('common.radio') },
            { key: 'movies', icon: <Clapperboard size={26} />, label: t('common.movies') },
            { key: 'notifications', icon: <Bell size={26} />, label: t('notifications.title') },
            { key: 'favorites', icon: <Heart size={26} />, label: t('common.favorites') }
          ], [language, t]).map((item) => (
            <motion.button
              key={item.key}
              onClick={() => setPage(item.key)}
              whileTap={{ scale: 0.95 }}
              aria-label={item.label}
              className="relative flex flex-col items-center justify-center flex-1 min-w-0 min-h-[44px] sm:min-h-[48px] px-2 sm:px-4 py-1.5 transition-all touch-manipulation active:bg-gray-100 rounded-lg sm:rounded-none overflow-visible"
            >
              <div className={`relative transition-colors ${page === item.key ? 'text-blue-600' : 'text-gray-600'}`}>
                {item.icon}
              </div>
              {/* Badge point rouge : afficher uniquement s'il y a des notifications non lues */}
              {item.key === 'notifications' && notificationsUnreadCount > 0 && (
                <span
                  className="absolute top-0 right-1 h-3 w-3 rounded-full border-2 border-gray-50 pointer-events-none bg-red-500"
                  style={{ zIndex: 99, minWidth: 12, minHeight: 12 }}
                  aria-label={`${notificationsUnreadCount} non lue(s)`}
                />
              )}
              {page === item.key && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"
                  initial={false}
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
            </motion.button>
          ))}
        </div>
      </nav>
    </div>
  );
}

export default App;
