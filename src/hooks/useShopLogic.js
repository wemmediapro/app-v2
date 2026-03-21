/**
 * Boutique : favoris (local / profil), catégories UI, promos page d’accueil.
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { apiService } from '../services/apiService';

function readShopFavoritesLocal(suffix) {
  try {
    const key = `shopFavorites_${suffix}`;
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

/**
 * @param {Function} t - i18n
 * @param {string} [favoritesStorageSuffix]
 */
export function useShopLogic(t, favoritesStorageSuffix = 'guest') {
  const [shopFavorites, setShopFavorites] = useState([]);
  const [homeShopPromotions, setHomeShopPromotions] = useState([]);

  useEffect(() => {
    if (favoritesStorageSuffix !== 'guest') return;
    setShopFavorites(readShopFavoritesLocal(favoritesStorageSuffix));
  }, [favoritesStorageSuffix]);

  useEffect(() => {
    let cancelled = false;
    apiService
      .getPromotions()
      .then((response) => {
        if (cancelled) return;
        const data = response?.data;
        const list = Array.isArray(data) ? data : data?.promotions || data?.data || [];
        setHomeShopPromotions((list || []).filter((p) => p.isActive !== false));
      })
      .catch(() => {
        if (!cancelled) setHomeShopPromotions([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const shopCategories = useMemo(
    () => [
      { id: 'all', name: t('shop.categories.all'), icon: '🛍️' },
      { id: 'souvenirs', name: t('shop.categories.souvenirs'), icon: '🎁' },
      { id: 'dutyfree', name: t('shop.categories.dutyfree'), icon: '🍷' },
      { id: 'fashion', name: t('shop.categories.fashion'), icon: '👕' },
      { id: 'electronics', name: t('shop.categories.electronics'), icon: '📱' },
      { id: 'food', name: t('shop.categories.food'), icon: '🍯' },
    ],
    [t]
  );

  const isShopFavorite = useCallback((productId) => shopFavorites.some((p) => p.id === productId), [shopFavorites]);

  const toggleShopFavorite = useCallback(
    (product) => {
      const key = `shopFavorites_${favoritesStorageSuffix}`;
      setShopFavorites((prev) => {
        const next = prev.some((p) => p.id === product.id)
          ? prev.filter((p) => p.id !== product.id)
          : [...prev, { ...product }];
        if (favoritesStorageSuffix === 'guest') {
          try {
            localStorage.setItem(key, JSON.stringify(next));
          } catch (_) {}
        }
        return next;
      });
    },
    [favoritesStorageSuffix]
  );

  const removeFromShopFavorites = useCallback(
    (productId) => {
      const key = `shopFavorites_${favoritesStorageSuffix}`;
      setShopFavorites((prev) => {
        const next = prev.filter((p) => p.id !== productId);
        if (favoritesStorageSuffix === 'guest') {
          try {
            localStorage.setItem(key, JSON.stringify(next));
          } catch (_) {}
        }
        return next;
      });
    },
    [favoritesStorageSuffix]
  );

  return {
    shopFavorites,
    setShopFavorites,
    homeShopPromotions,
    shopCategories,
    isShopFavorite,
    toggleShopFavorite,
    removeFromShopFavorites,
  };
}
