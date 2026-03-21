/**
 * Synchronisation profil serveur : chargement favoris + debounce putUserData (utilisateur connecté).
 */
import { useRef, useEffect, useCallback } from 'react';
import { apiService } from '../services/apiService';
import { getPlaybackStorageKey } from './useMoviePlayback';

/**
 * @param {object} p
 * @param {string} p.favoritesStorageSuffix
 * @param {Function} p.setMagazineFavoritesIds
 * @param {Function} p.setRestaurantFavoritesIds
 * @param {Function} p.setEnfantFavoritesIds
 * @param {Function} p.setWatchlist
 * @param {Function} p.setShopFavorites
 * @param {string[]} p.magazineFavoritesIds
 * @param {string[]} p.restaurantFavoritesIds
 * @param {string[]} p.enfantFavoritesIds
 * @param {unknown[]} p.watchlist
 * @param {unknown[]} p.shopFavorites
 */
export function useFavoritesProfileSync({
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
}) {
  const userDataLoadedFromServerRef = useRef(false);
  const syncFavoritesToServerTimeoutRef = useRef(null);

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
  }, [
    favoritesStorageSuffix,
    setMagazineFavoritesIds,
    setRestaurantFavoritesIds,
    setEnfantFavoritesIds,
    setWatchlist,
    setShopFavorites,
  ]);

  useEffect(() => {
    if (favoritesStorageSuffix === 'guest') {
      userDataLoadedFromServerRef.current = false;
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

  return { syncPlaybackToServer };
}
