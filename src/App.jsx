/**
 * Point d’entrée principal de l’app passagers.
 * Domaines : useRadioLogic/useWebtv, useMoviesLogic, useMagazineLogic, useRestaurantsLogic, useShopLogic, useEnfantLogic, useChatLogic.
 */
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
// Icônes Lucide : importées dans les composants enfants (BottomNav, AppHeader, pages) pour alléger le bundle racine
import { apiService, getPosterUrl } from './services/apiService';
import { getPlaybackStorageKey } from './hooks/useMoviePlayback';
import { useLanguage } from './contexts/LanguageContext';
import { useMagazineLogic } from './hooks/useMagazineLogic';
import { useRestaurantsLogic } from './hooks/useRestaurantsLogic';
import { useShopLogic } from './hooks/useShopLogic';
import { useEnfantLogic } from './hooks/useEnfantLogic';
import { useNotifications } from './hooks/useNotifications';
import { useMoviesLogic } from './hooks/useMoviesLogic';
import { useBanners } from './hooks/useBanners';
import { useShipmap } from './hooks/useShipmap';
import { useRadioLogic } from './hooks/useRadioLogic';
import { useWebtv } from './hooks/useWebtv';
import { useChatLogic } from './hooks/useChatLogic';
import { useOfflineQueue } from './hooks/useOfflineQueue';
import { useOnline } from './hooks/useOnline';
import BottomNav from './components/BottomNav';
import AppHeader from './components/AppHeader';
import BannersCarousel from './components/BannersCarousel';
import OfflineBanner from './components/OfflineBanner';
import ConditionsGate, { CONDITIONS_ACCEPTED_KEY } from './components/ConditionsGate';
import ErrorBoundary from './components/ErrorBoundary';
import MainContent from './components/MainContent';
import { gnvShipsList, currentShip } from './data/ships';

// Image défaut 100% offline (data URI) — plus de dépendance Unsplash
const DEFAULT_RESTAURANT_IMAGE =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 400" width="800" height="400"><rect fill="%23e5e7eb" width="800" height="400"/><text x="400" y="220" font-size="24" fill="%239ca3af" text-anchor="middle" font-family="system-ui,sans-serif">Restaurant</text></svg>'
  );

function App() {
  const { t, language, changeLanguage } = useLanguage();
  const [conditionsAccepted, setConditionsAccepted] = useState(() => {
    try {
      return localStorage.getItem(CONDITIONS_ACCEPTED_KEY) === 'true';
    } catch (_) {
      return false;
    }
  });

  // [ARCH-2] useOnline selon docs/REFACTORING-APP.md (+ feedback sync hors ligne)
  const { isOnline, syncFeedback } = useOnline();
  const videoPositionOnFullscreenExitRef = useRef(null);

  // === Navigation (React Router + état page) — deep linking et historique
  const location = useLocation();
  const navigate = useNavigate();
  const pathnameToPage = (pathname) => {
    const raw = (pathname || '').replace(/^\/+|\/+$/g, '') || 'home';
    const p = raw === '' ? 'home' : raw.toLowerCase();
    const map = {
      shop: 'shop',
      radio: 'radio',
      movies: 'movies',
      webtv: 'webtv',
      magazine: 'magazine',
      restaurant: 'restaurant',
      restaurants: 'restaurant',
      enfant: 'enfant',
      shipmap: 'shipmap',
      'plan-du-navire': 'shipmap',
      favorites: 'favorites',
      notifications: 'notifications',
    };
    return map[p] || (p === 'home' ? 'home' : null);
  };
  const pageToPathname = (p) => (p === 'home' ? '/' : `/${p}`);
  const [page, setPageState] = useState(() => pathnameToPage(location.pathname) || 'home');
  const setPage = useCallback(
    (next) => {
      setPageState(next);
      const path = pageToPathname(next);
      if (location.pathname !== path) navigate(path, { replace: false });
    },
    [navigate, location.pathname]
  );
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

  const favoritesStorageSuffix = 'guest';

  // === Films / séries + watchlist (useMoviesLogic) ===
  const {
    moviesAndSeries,
    moviesLoading,
    movieToOpenFromFavorites,
    setMovieToOpenFromFavorites,
    watchlist,
    setWatchlist,
    toggleWatchlist,
    myWatchlist,
  } = useMoviesLogic(language, favoritesStorageSuffix);

  // === Magazine + favoris (useMagazineLogic) ===
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
    magazineFavoritesIds,
    setMagazineFavoritesIds,
    isMagazineFavorite,
    toggleMagazineFavorite,
    magazineFavoritesArticles,
  } = useMagazineLogic(language, t, favoritesStorageSuffix);

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
    toggleShuffle,
  } = useRadioLogic(language, page, isAnyVideoPlaying);

  const [offlineSentNotice, setOfflineSentNotice] = useState(null);
  const handleOfflineFlushComplete = useCallback(({ sent }) => {
    if (sent > 0) setOfflineSentNotice({ sent, at: Date.now() });
  }, []);

  const offlineQueue = useOfflineQueue({ onFlushComplete: handleOfflineFlushComplete });

  useEffect(() => {
    if (!offlineSentNotice) return undefined;
    const t = window.setTimeout(() => setOfflineSentNotice(null), 5000);
    return () => clearTimeout(t);
  }, [offlineSentNotice]);

  useEffect(() => {
    if (syncFeedback?.state !== 'success' || syncFeedback?.source !== 'service-worker') return;
    void offlineQueue.refreshCount();
  }, [syncFeedback, offlineQueue.refreshCount]);

  // Chat (Socket.io, conversations, messages) — useChatLogic
  const chat = useChatLogic({ refreshOfflineQueueCount: offlineQueue.refreshCount });

  // === Boutique : favoris, catégories, promos accueil (useShopLogic) ===
  const {
    shopFavorites,
    setShopFavorites,
    homeShopPromotions,
    shopCategories,
    isShopFavorite,
    toggleShopFavorite,
    removeFromShopFavorites,
  } = useShopLogic(t, favoritesStorageSuffix);

  // === Restaurants + panier + favoris (useRestaurantsLogic) ===
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
    restaurantFavoritesIds,
    setRestaurantFavoritesIds,
    cart,
    setCart,
    addToCart,
    removeFromCart,
    updateCartQuantity,
    isRestaurantFavorite,
    toggleRestaurantFavorite,
    restaurantFavoritesList,
  } = useRestaurantsLogic(language, t, favoritesStorageSuffix);

  // === Plan du navire : ID depuis boatConfig (API), puis hook useShipmap ===
  const [shipmapShipId, setShipmapShipId] = useState(7);
  useEffect(() => {
    let cancelled = false;
    apiService
      .getBoatConfig()
      .then((res) => {
        if (cancelled) return;
        const data = res?.data?.data ?? res?.data ?? {};
        const id = data.shipId != null && data.shipId >= 1 ? Number(data.shipId) : 7;
        setShipmapShipId(id);
      })
      .catch(() => {
        if (!cancelled) setShipmapShipId(7);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const shipmap = useShipmap(language, t, shipmapShipId);
  const currentShipName = shipmap.currentShipName || currentShip.name;

  // === Espace enfant + favoris (useEnfantLogic) ===
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
    enfantFavoritesIds,
    setEnfantFavoritesIds,
    isEnfantFavorite,
    toggleEnfantFavorite,
    enfantFavoritesActivities,
  } = useEnfantLogic(language, t, favoritesStorageSuffix);

  // Recalculer les titres de pages quand la langue change
  const pageTitles = useMemo(
    () => ({
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
      notifications: t('notifications.title'),
    }),
    [language, t]
  );

  // Charger les favoris (et positions de lecture) : depuis le serveur si connecté, sinon localStorage
  useEffect(() => {
    const suffix = favoritesStorageSuffix;
    if (suffix === 'guest') {
      return;
    }

    let cancelled = false;
    apiService
      .getUserData()
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
        const serverEmpty =
          magazineIds.length === 0 &&
          restaurantIds.length === 0 &&
          enfantIds.length === 0 &&
          watchlistData.length === 0 &&
          shopItems.length === 0 &&
          Object.keys(playbackData).length === 0;
        if (serverEmpty) {
          try {
            const pre = (baseKey) => {
              try {
                const raw = localStorage.getItem(`${baseKey}_${suffix}`);
                return raw ? JSON.parse(raw) : [];
              } catch (_) {
                return [];
              }
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
            if (
              magazineIds.length > 0 ||
              restaurantIds.length > 0 ||
              enfantIds.length > 0 ||
              watchlistData.length > 0 ||
              shopItems.length > 0 ||
              Object.keys(playbackData).length > 0
            ) {
              apiService
                .putUserData({
                  favorites: { magazineIds, restaurantIds, enfantIds, watchlist: watchlistData, shopItems },
                  playbackPositions: playbackData,
                })
                .catch(() => {});
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
        if (userDataLoadedFromServerRef.current) return;
      });
    return () => {
      cancelled = true;
    };
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
      apiService
        .putUserData({
          favorites: {
            magazineIds: magazineFavoritesIds,
            restaurantIds: restaurantFavoritesIds,
            enfantIds: enfantFavoritesIds,
            watchlist,
            shopItems: shopFavorites,
          },
        })
        .catch(() => {});
    }, 1500);
    return () => {
      if (syncFavoritesToServerTimeoutRef.current) {
        clearTimeout(syncFavoritesToServerTimeoutRef.current);
        syncFavoritesToServerTimeoutRef.current = null;
      }
    };
  }, [
    favoritesStorageSuffix,
    magazineFavoritesIds,
    restaurantFavoritesIds,
    enfantFavoritesIds,
    watchlist,
    shopFavorites,
  ]);

  const syncPlaybackToServer = useCallback(() => {
    if (favoritesStorageSuffix === 'guest') return;
    try {
      const storageKey = getPlaybackStorageKey(favoritesStorageSuffix);
      const raw = localStorage.getItem(storageKey);
      const playback = raw ? JSON.parse(raw) : {};
      apiService.putUserData({ playbackPositions: playback }).catch(() => {});
    } catch (_) {}
  }, [favoritesStorageSuffix]);

  /** Promos : 1 resto + 1 boutique, sélection déterministe (évite re-renders et sauts visuels). */
  const homePromosCombined = useMemo(() => {
    const restAll = (allPromotions || []).map((p) => ({
      ...p,
      _promoType: 'restaurant',
      _promoKey: `rest-${p.restaurant?.id ?? ''}-${p.id ?? ''}`,
    }));
    const shopAll = (homeShopPromotions || []).map((p) => ({
      ...p,
      _promoType: 'shop',
      _promoKey: `shop-${p.id ?? p._id ?? ''}`,
    }));
    const oneRest = restAll.length > 0 ? [restAll[0]] : [];
    const oneShop = shopAll.length > 0 ? [shopAll[0]] : [];
    return [...oneRest, ...oneShop];
  }, [allPromotions, homeShopPromotions]);

  // Titre/description d'une promotion selon la langue (translations ou fallback) — mémoïsés pour limiter re-renders
  const getPromoTitle = useCallback(
    (promo) =>
      promo.translations && promo.translations[language] && promo.translations[language].title
        ? promo.translations[language].title
        : promo.title || '',
    [language]
  );
  const getPromoDescription = useCallback(
    (promo) =>
      promo.translations && promo.translations[language] && promo.translations[language].description
        ? promo.translations[language].description
        : promo.description || '',
    [language]
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

            {offlineQueue.pendingCount > 0 && (
              <div
                className="fixed left-0 right-0 z-[98] max-w-[768px] mx-auto flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium shadow-md safe-area-top"
                style={{
                  top: !isOnline
                    ? 'calc(60px + env(safe-area-inset-top, 0px) + 2.5rem)'
                    : 'calc(60px + env(safe-area-inset-top, 0px))',
                }}
                role="status"
                aria-live="polite"
              >
                <span>{t('common.offlineQueuePending', { count: offlineQueue.pendingCount })}</span>
              </div>
            )}

            {offlineSentNotice && (
              <div
                className="fixed left-2 right-2 bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] z-[100] max-w-md mx-auto rounded-lg px-4 py-3 bg-emerald-600 text-white text-sm font-medium shadow-lg text-center"
                role="status"
                aria-live="polite"
              >
                {t('common.offlineQueueSent', { count: offlineSentNotice.sent })}
              </div>
            )}

            {syncFeedback?.state === 'syncing' && (
              <div
                className="fixed left-2 right-2 bottom-[calc(7.5rem+env(safe-area-inset-bottom,0px))] z-[99] max-w-md mx-auto rounded-lg px-4 py-3 bg-sky-600 text-white text-sm font-medium shadow-lg text-center"
                role="status"
                aria-live="polite"
              >
                {t('common.syncMessagesPending')}
              </div>
            )}
            {syncFeedback?.state === 'success' && syncFeedback.processed > 0 && (
              <div
                className="fixed left-2 right-2 bottom-[calc(7.5rem+env(safe-area-inset-bottom,0px))] z-[99] max-w-md mx-auto rounded-lg px-4 py-3 bg-teal-600 text-white text-sm font-medium shadow-lg text-center"
                role="status"
                aria-live="polite"
              >
                {t('common.syncMessagesSuccess', { count: syncFeedback.processed })}
              </div>
            )}
            {syncFeedback?.state === 'error' && (
              <div
                className="fixed left-2 right-2 bottom-[calc(7.5rem+env(safe-area-inset-bottom,0px))] z-[99] max-w-md mx-auto rounded-lg px-4 py-3 bg-rose-600 text-white text-sm font-medium shadow-lg text-center"
                role="status"
                aria-live="polite"
              >
                {t('common.syncMessagesError')}
              </div>
            )}

            {/* Main with page transitions + ErrorBoundary pour isoler les erreurs de page */}
            <main
              className={`flex-1 p-2 sm:p-3 md:p-4 overflow-y-auto overflow-x-hidden ${!isOnline || offlineQueue.pendingCount > 0 ? 'pt-[calc(7rem+env(safe-area-inset-top,0px))] sm:pt-[7.5rem] md:pt-[8rem]' : 'pt-[calc(5rem+env(safe-area-inset-top,0px))] sm:pt-[80px] md:pt-[84px]'}`}
            >
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
                  chat={chat}
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
