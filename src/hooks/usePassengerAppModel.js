/**
 * Orchestration hooks passagers + props MainContent mémoïsées (allège App.jsx).
 */
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { getPosterUrl } from '../services/apiService';
import { useLanguage } from '../contexts/LanguageContext';
import { useMagazineLogic } from './useMagazineLogic';
import { useRestaurantsLogic } from './useRestaurantsLogic';
import { useShopLogic } from './useShopLogic';
import { useEnfantLogic } from './useEnfantLogic';
import { useNotifications } from './useNotifications';
import { useMoviesLogic } from './useMoviesLogic';
import { useBanners } from './useBanners';
import { useRadioLogic } from './useRadioLogic';
import { useWebtv } from './useWebtv';
import { useChatLogic } from './useChatLogic';
import { useOfflineQueue } from './useOfflineQueue';
import { useOnline } from './useOnline';
import { useAppNavigation } from './useAppNavigation';
import { useWebtvFullscreenResume } from './useWebtvFullscreenResume';
import { useShipmapFromBoatConfig } from './useShipmapFromBoatConfig';
import { useHomePromosDerived } from './useHomePromosDerived';
import { useFavoritesProfileSync } from './useFavoritesProfileSync';
import { DEFAULT_RESTAURANT_IMAGE } from '../constants/defaultImages';
import { CONDITIONS_ACCEPTED_KEY } from '../components/ConditionsGate';

export function usePassengerAppModel() {
  const { t, language } = useLanguage();
  const [conditionsAccepted, setConditionsAccepted] = useState(() => {
    try {
      return localStorage.getItem(CONDITIONS_ACCEPTED_KEY) === 'true';
    } catch (_) {
      return false;
    }
  });

  const { isOnline, syncFeedback } = useOnline();
  const videoPositionOnFullscreenExitRef = useRef(null);
  const { page, setPage, navigate } = useAppNavigation();

  const banners = useBanners(page, language);
  const favoritesStorageSuffix = 'guest';

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

  const {
    selectedArticle,
    setSelectedArticle,
    selectedCategory,
    setSelectedCategory,
    magazineLoading,
    magazineError,
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

  const { notificationsList, notificationsLoading, notificationsUnreadCount } = useNotifications(page, language);

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

  useWebtvFullscreenResume(webtvVideoRefRef, videoPositionOnFullscreenExitRef);

  const isAnyVideoPlaying = isWebtvVideoPlaying || isMoviesVideoPlaying;
  const {
    radioStations,
    currentRadio,
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
  } = useRadioLogic(language, page, isAnyVideoPlaying);

  const [offlineSentNotice, setOfflineSentNotice] = useState(null);
  const handleOfflineFlushComplete = useCallback(({ sent }) => {
    if (sent > 0) setOfflineSentNotice({ sent, at: Date.now() });
  }, []);

  const offlineQueue = useOfflineQueue({ onFlushComplete: handleOfflineFlushComplete });

  useEffect(() => {
    if (!offlineSentNotice) return undefined;
    const timer = window.setTimeout(() => setOfflineSentNotice(null), 5000);
    return () => clearTimeout(timer);
  }, [offlineSentNotice]);

  useEffect(() => {
    if (syncFeedback?.state !== 'success' || syncFeedback?.source !== 'service-worker') return;
    void offlineQueue.refreshCount();
  }, [syncFeedback, offlineQueue.refreshCount]);

  const chat = useChatLogic({ refreshOfflineQueueCount: offlineQueue.refreshCount });

  const { shopFavorites, setShopFavorites, homeShopPromotions, shopCategories, removeFromShopFavorites } = useShopLogic(
    t,
    favoritesStorageSuffix
  );

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
    addToCart,
    isRestaurantFavorite,
    toggleRestaurantFavorite,
    restaurantFavoritesList,
  } = useRestaurantsLogic(language, t, favoritesStorageSuffix);

  const { shipmap, currentShipName } = useShipmapFromBoatConfig(language, t);

  const {
    enfantActivities,
    enfantLoading,
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

  const { syncPlaybackToServer } = useFavoritesProfileSync({
    favoritesStorageSuffix,
    setMagazineFavoritesIds,
    setRestaurantFavoritesIds,
    setEnfantFavoritesIds,
    setWatchlist,
    setShopFavorites,
    magazineFavoritesIds,
    restaurantFavoritesIds,
    enfantFavoritesIds,
    watchlist,
    shopFavorites,
  });

  const { homePromosCombined, getPromoTitle, getPromoDescription } = useHomePromosDerived({
    allPromotions,
    homeShopPromotions,
    language,
  });

  useEffect(() => {
    if (page === 'restaurant') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [page]);

  const mainContentProps = useMemo(
    () => ({
      page,
      setPage,
      t,
      language,
      pageTitles,
      homePromosCombined,
      getPromoTitle,
      getPromoDescription,
      setSelectedRestaurant,
      radioStations,
      currentRadio,
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
      moviesAndSeries,
      moviesLoading,
      watchlist,
      toggleWatchlist,
      favoritesStorageSuffix,
      syncPlaybackToServer,
      movieToOpenFromFavorites,
      setMovieToOpenFromFavorites,
      setIsMoviesVideoPlaying,
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
      setIsWebtvVideoPlaying,
      webtvLoading,
      filteredChannels,
      getWebtvCategoryLabel,
      magazineLoading,
      magazineError,
      setMagazineRetryTrigger,
      selectedCategory,
      setSelectedCategory,
      magazineCategories,
      filteredArticles,
      featuredArticles,
      breakingNews,
      selectedArticle,
      setSelectedArticle,
      isMagazineFavorite,
      toggleMagazineFavorite,
      currentShipName,
      restaurants,
      restaurantSearchQuery,
      setRestaurantSearchQuery,
      selectedRestaurantCategory,
      setSelectedRestaurantCategory,
      restaurantCategories,
      allPromotions,
      filteredRestaurants,
      restaurantsLoading,
      selectedRestaurant,
      DEFAULT_RESTAURANT_IMAGE,
      isRestaurantFavorite,
      toggleRestaurantFavorite,
      cart,
      addToCart,
      enfantActivities,
      enfantLoading,
      selectedEnfantCategory,
      setSelectedEnfantCategory,
      enfantCategories,
      enfantHighlights,
      filteredEnfantActivities,
      selectedActivity,
      setSelectedActivity,
      isEnfantFavorite,
      toggleEnfantFavorite,
      ...shipmap,
      notificationsList,
      notificationsLoading,
      shopFavorites,
      myWatchlist,
      magazineFavoritesArticles,
      enfantFavoritesActivities,
      restaurantFavoritesList,
      shopCategories,
      setShopFavorites,
      removeFromShopFavorites,
      getPosterUrl,
      chat,
    }),
    [
      page,
      setPage,
      t,
      language,
      pageTitles,
      homePromosCombined,
      getPromoTitle,
      getPromoDescription,
      setSelectedRestaurant,
      radioStations,
      currentRadio,
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
      moviesAndSeries,
      moviesLoading,
      watchlist,
      toggleWatchlist,
      favoritesStorageSuffix,
      syncPlaybackToServer,
      movieToOpenFromFavorites,
      setMovieToOpenFromFavorites,
      setIsMoviesVideoPlaying,
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
      setIsWebtvVideoPlaying,
      webtvLoading,
      filteredChannels,
      getWebtvCategoryLabel,
      magazineLoading,
      magazineError,
      setMagazineRetryTrigger,
      selectedCategory,
      setSelectedCategory,
      magazineCategories,
      filteredArticles,
      featuredArticles,
      breakingNews,
      selectedArticle,
      setSelectedArticle,
      isMagazineFavorite,
      toggleMagazineFavorite,
      currentShipName,
      restaurants,
      restaurantSearchQuery,
      setRestaurantSearchQuery,
      selectedRestaurantCategory,
      setSelectedRestaurantCategory,
      restaurantCategories,
      allPromotions,
      filteredRestaurants,
      restaurantsLoading,
      selectedRestaurant,
      isRestaurantFavorite,
      toggleRestaurantFavorite,
      cart,
      addToCart,
      enfantActivities,
      enfantLoading,
      selectedEnfantCategory,
      setSelectedEnfantCategory,
      enfantCategories,
      enfantHighlights,
      filteredEnfantActivities,
      selectedActivity,
      setSelectedActivity,
      isEnfantFavorite,
      toggleEnfantFavorite,
      shipmap,
      notificationsList,
      notificationsLoading,
      shopFavorites,
      myWatchlist,
      magazineFavoritesArticles,
      enfantFavoritesActivities,
      restaurantFavoritesList,
      shopCategories,
      setShopFavorites,
      removeFromShopFavorites,
      chat,
    ]
  );

  return {
    conditionsAccepted,
    setConditionsAccepted,
    navigate,
    setPage,
    t,
    page,
    isOnline,
    offlineQueue,
    offlineSentNotice,
    syncFeedback,
    banners,
    notificationsUnreadCount,
    mainContentProps,
  };
}
