/**
 * Config des routes MainContent — une entrée par page.
 * Consommé par `MainContent.jsx` (lazy + getProps). Nouvelle page = entrée ici + composant lazy ci-dessous.
 */
import { lazy } from 'react';

const HomePage = lazy(() => import('../pages/HomePage'));
const MagazinePage = lazy(() => import('../pages/MagazinePage'));
const RestaurantPage = lazy(() => import('../pages/RestaurantPage'));
const EnfantPage = lazy(() => import('../pages/EnfantPage'));
const ShopPage = lazy(() => import('../pages/ShopPage'));
const RadioPage = lazy(() => import('./RadioPage'));
const MoviesPage = lazy(() => import('./MoviesPage'));
const WebtvPageContent = lazy(() => import('../pages/WebtvPageContent'));
const ShipmapSection = lazy(() => import('./ShipmapSection'));
const NotificationsPage = lazy(() => import('../pages/NotificationsPage'));
const FavoritesPageContent = lazy(() => import('../pages/FavoritesPageContent'));
const MochaFallbackPage = lazy(() => import('../pages/MochaFallbackPage'));

/** Hauteur du fallback Suspense : 'short' | 'medium' | 'screen' */
const FALLBACK_HEIGHT = {
  short: 'short',
  screen: 'screen',
};

/**
 * Retourne les props pour la page courante à partir de l'objet props complet.
 * Chaque getProps ne doit extraire que les props utilisées par la page.
 */
function getHomeProps(p) {
  return {
    t: p.t,
    setPage: p.setPage,
    homePromosCombined: p.homePromosCombined,
    getPromoTitle: p.getPromoTitle,
    getPromoDescription: p.getPromoDescription,
    setSelectedRestaurant: p.setSelectedRestaurant,
    language: p.language,
  };
}

function getRadioProps(p) {
  return {
    t: p.t,
    radioStations: p.radioStations,
    currentRadio: p.currentRadio,
    toggleRadio: p.toggleRadio,
    isPlaying: p.isPlaying,
    volume: p.volume,
    onVolumeChange: p.handleVolumeChange,
    isFavorite: p.isFavorite,
    toggleFavorite: p.toggleFavorite,
    loading: p.radioLoading,
    getRadioLogoUrl: p.getRadioLogoUrl,
    isDirectStream: !!(p.currentRadio && p.radioPlaylistTracks?.length === 0),
    getRadioStreamProgress: p.getRadioStreamProgress,
  };
}

function getMoviesProps(p) {
  return {
    t: p.t,
    language: p.language,
    moviesAndSeries: p.moviesAndSeries,
    moviesLoading: p.moviesLoading,
    watchlist: p.watchlist,
    toggleWatchlist: p.toggleWatchlist,
    playbackStorageSuffix: p.favoritesStorageSuffix,
    onSyncPlaybackToServer: p.syncPlaybackToServer,
    initialSelectedMovie: p.movieToOpenFromFavorites,
    initialAutoPlay: !!p.movieToOpenFromFavorites,
    onClearInitialMovie: p.setMovieToOpenFromFavorites ? () => p.setMovieToOpenFromFavorites(null) : undefined,
    onVideoPlayStart: p.setIsMoviesVideoPlaying ? () => p.setIsMoviesVideoPlaying(true) : undefined,
    onVideoPlayEnd: p.setIsMoviesVideoPlaying ? () => p.setIsMoviesVideoPlaying(false) : undefined,
  };
}

function getWebtvProps(p) {
  return {
    t: p.t,
    setPage: p.setPage,
    selectedChannelCategory: p.selectedChannelCategory,
    setSelectedChannelCategory: p.setSelectedChannelCategory,
    channelCategories: p.channelCategories,
    selectedChannel: p.selectedChannel,
    setSelectedChannel: p.setSelectedChannel,
    selectedWebtvProgram: p.selectedWebtvProgram,
    webtvVideoRefRef: p.webtvVideoRefRef,
    setWebtvVideoRef: p.setWebtvVideoRef,
    handleWebtvVideoEnded: p.handleWebtvVideoEnded,
    handleWebtvPlayByServerTime: p.handleWebtvPlayByServerTime,
    webtvVideoError: p.webtvVideoError,
    setWebtvVideoError: p.setWebtvVideoError,
    webtvPlaySyncing: p.webtvPlaySyncing,
    setIsWebtvVideoPlaying: p.setIsWebtvVideoPlaying,
    webtvLoading: p.webtvLoading,
    filteredChannels: p.filteredChannels,
    getWebtvCategoryLabel: p.getWebtvCategoryLabel,
  };
}

function getMagazineProps(p) {
  return {
    t: p.t,
    setPage: p.setPage,
    magazineLoading: p.magazineLoading,
    magazineError: p.magazineError,
    setMagazineRetryTrigger: p.setMagazineRetryTrigger,
    selectedCategory: p.selectedCategory,
    setSelectedCategory: p.setSelectedCategory,
    magazineCategories: p.magazineCategories,
    filteredArticles: p.filteredArticles,
    featuredArticles: p.featuredArticles,
    breakingNews: p.breakingNews,
    selectedArticle: p.selectedArticle,
    setSelectedArticle: p.setSelectedArticle,
    isMagazineFavorite: p.isMagazineFavorite,
    toggleMagazineFavorite: p.toggleMagazineFavorite,
  };
}

function getRestaurantProps(p) {
  return {
    currentShipName: p.currentShipName,
    t: p.t,
    restaurants: p.restaurants,
    restaurantSearchQuery: p.restaurantSearchQuery,
    setRestaurantSearchQuery: p.setRestaurantSearchQuery,
    selectedRestaurantCategory: p.selectedRestaurantCategory,
    setSelectedRestaurantCategory: p.setSelectedRestaurantCategory,
    restaurantCategories: p.restaurantCategories,
    allPromotions: p.allPromotions,
    getPromoTitle: p.getPromoTitle,
    getPromoDescription: p.getPromoDescription,
    filteredRestaurants: p.filteredRestaurants,
    restaurantsLoading: p.restaurantsLoading,
    setSelectedRestaurant: p.setSelectedRestaurant,
    selectedRestaurant: p.selectedRestaurant,
    DEFAULT_RESTAURANT_IMAGE: p.DEFAULT_RESTAURANT_IMAGE,
    getRadioLogoUrl: p.getRadioLogoUrl,
    isRestaurantFavorite: p.isRestaurantFavorite,
    toggleRestaurantFavorite: p.toggleRestaurantFavorite,
    getPosterUrl: p.getPosterUrl,
    setPage: p.setPage,
    cart: p.cart,
    addToCart: p.addToCart,
  };
}

function getEnfantProps(p) {
  return {
    t: p.t,
    enfantActivities: p.enfantActivities,
    enfantLoading: p.enfantLoading,
    selectedEnfantCategory: p.selectedEnfantCategory,
    setSelectedEnfantCategory: p.setSelectedEnfantCategory,
    enfantCategories: p.enfantCategories,
    enfantHighlights: p.enfantHighlights,
    filteredEnfantActivities: p.filteredEnfantActivities,
    selectedActivity: p.selectedActivity,
    setSelectedActivity: p.setSelectedActivity,
    isEnfantFavorite: p.isEnfantFavorite,
    toggleEnfantFavorite: p.toggleEnfantFavorite,
  };
}

function getShipmapProps(p) {
  return {
    t: p.t,
    shipmapShip: p.shipmapShip,
    shipmapLoading: p.shipmapLoading,
    refetchShipmap: p.refetchShipmap,
    shipDecks: p.shipDecks,
    shipDecksFiltered: p.shipDecksFiltered,
    selectedDeck: p.selectedDeck,
    setSelectedDeck: p.setSelectedDeck,
    shipmapDeckTypeFilter: p.shipmapDeckTypeFilter,
    setShipmapDeckTypeFilter: p.setShipmapDeckTypeFilter,
    shipSearchQuery: p.shipSearchQuery,
    setShipSearchQuery: p.setShipSearchQuery,
    deckServices: p.deckServices,
    selectedDeckInfo: p.selectedDeckInfo,
    filteredDeckServices: p.filteredDeckServices,
    deckRooms: p.deckRooms,
    showShipmapAddPlanModal: p.showShipmapAddPlanModal,
    setShowShipmapAddPlanModal: p.setShowShipmapAddPlanModal,
  };
}

function getNotificationsProps(p) {
  return {
    notificationsList: p.notificationsList,
    notificationsLoading: p.notificationsLoading,
    t: p.t,
    language: p.language,
    onBack: p.setPage ? () => p.setPage('home') : undefined,
  };
}

function getFavoritesProps(p) {
  return {
    pageTitleFavorites: p.pageTitles?.favorites,
    shopFavorites: p.shopFavorites,
    myWatchlist: p.myWatchlist,
    magazineFavoritesArticles: p.magazineFavoritesArticles,
    enfantFavoritesActivities: p.enfantFavoritesActivities,
    restaurantFavoritesList: p.restaurantFavoritesList,
    shopCategories: p.shopCategories,
    magazineCategories: p.magazineCategories,
    t: p.t,
    language: p.language,
    setPage: p.setPage,
    setMovieToOpenFromFavorites: p.setMovieToOpenFromFavorites,
    setSelectedArticle: p.setSelectedArticle,
    setSelectedActivity: p.setSelectedActivity,
    setSelectedRestaurant: p.setSelectedRestaurant,
    removeFromShopFavorites: p.removeFromShopFavorites,
    getPosterUrl: p.getPosterUrl,
    getRadioLogoUrl: p.getRadioLogoUrl,
    defaultRestaurantImage: p.DEFAULT_RESTAURANT_IMAGE,
  };
}

function getShopProps(p) {
  return {
    t: p.t,
    language: p.language,
    setPage: p.setPage,
    shopFavorites: p.shopFavorites,
    setShopFavorites: p.setShopFavorites,
    favoritesStorageSuffix: p.favoritesStorageSuffix,
  };
}

function getMochaFallbackProps(p) {
  return {
    page: p.page,
    pageTitle: p.pageTitles?.[p.page],
    setPage: p.setPage,
    t: p.t,
  };
}

/** Config : pageId → { Component, getProps, useTransition, fallbackHeight } */
export const PAGE_CONFIG = {
  home: {
    Component: HomePage,
    getProps: getHomeProps,
    useTransition: false,
    fallbackHeight: FALLBACK_HEIGHT.short,
  },
  radio: {
    Component: RadioPage,
    getProps: getRadioProps,
    useTransition: true,
    fallbackHeight: FALLBACK_HEIGHT.short,
  },
  movies: {
    Component: MoviesPage,
    getProps: getMoviesProps,
    useTransition: true,
    fallbackHeight: FALLBACK_HEIGHT.short,
  },
  webtv: {
    Component: WebtvPageContent,
    getProps: getWebtvProps,
    useTransition: false,
    fallbackHeight: FALLBACK_HEIGHT.short,
  },
  magazine: {
    Component: MagazinePage,
    getProps: getMagazineProps,
    useTransition: false,
    fallbackHeight: FALLBACK_HEIGHT.screen,
  },
  restaurant: {
    Component: RestaurantPage,
    getProps: getRestaurantProps,
    useTransition: false,
    fallbackHeight: FALLBACK_HEIGHT.screen,
  },
  enfant: {
    Component: EnfantPage,
    getProps: getEnfantProps,
    useTransition: false,
    fallbackHeight: FALLBACK_HEIGHT.screen,
  },
  shipmap: {
    Component: ShipmapSection,
    getProps: getShipmapProps,
    useTransition: false,
    fallbackHeight: FALLBACK_HEIGHT.short,
  },
  notifications: {
    Component: NotificationsPage,
    getProps: getNotificationsProps,
    useTransition: false,
    fallbackHeight: FALLBACK_HEIGHT.short,
  },
  favorites: {
    Component: FavoritesPageContent,
    getProps: getFavoritesProps,
    useTransition: false,
    fallbackHeight: FALLBACK_HEIGHT.short,
  },
  shop: {
    Component: ShopPage,
    getProps: getShopProps,
    useTransition: false,
    fallbackHeight: FALLBACK_HEIGHT.screen,
  },
};

/** Page par défaut quand l’id n’est pas dans PAGE_CONFIG (fallback 404) */
export const DEFAULT_PAGE_ID = 'home';

/** Pour une page inconnue, on affiche MochaFallbackPage avec cette config */
export function getFallbackRoute(pageId) {
  return {
    Component: MochaFallbackPage,
    getProps: (p) => getMochaFallbackProps({ ...p, page: pageId }),
    useTransition: false,
    fallbackHeight: FALLBACK_HEIGHT.short,
  };
}
