/**
 * Restaurants : liste / filtres (useRestaurant) + panier + favoris resto.
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRestaurant } from './useRestaurant';

function readRestaurantFavoritesLocal(suffix) {
  try {
    const key = `restaurantFavorites_${suffix}`;
    let raw = localStorage.getItem(key);
    if (suffix === 'guest' && (!raw || raw === '[]')) {
      const legacy = localStorage.getItem('restaurantFavorites');
      if (legacy) raw = legacy;
    }
    return raw ? JSON.parse(raw) : [];
  } catch (_) {
    return [];
  }
}

/**
 * @param {string} language
 * @param {Function} t
 * @param {string} [favoritesStorageSuffix]
 */
export function useRestaurantsLogic(language, t, favoritesStorageSuffix = 'guest') {
  const [restaurantFavoritesIds, setRestaurantFavoritesIds] = useState([]);
  const [cart, setCart] = useState([]);

  useEffect(() => {
    if (favoritesStorageSuffix !== 'guest') return;
    setRestaurantFavoritesIds(readRestaurantFavoritesLocal(favoritesStorageSuffix));
  }, [favoritesStorageSuffix]);

  const restaurant = useRestaurant(language, t, restaurantFavoritesIds);

  const isRestaurantFavorite = useCallback(
    (restaurantId) => restaurantFavoritesIds.some((id) => String(id) === String(restaurantId)),
    [restaurantFavoritesIds]
  );

  const toggleRestaurantFavorite = useCallback(
    (restaurantId) => {
      const key = `restaurantFavorites_${favoritesStorageSuffix}`;
      setRestaurantFavoritesIds((prev) => {
        const next = prev.some((id) => String(id) === String(restaurantId))
          ? prev.filter((id) => String(id) !== String(restaurantId))
          : [...prev, String(restaurantId)];
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

  const restaurantFavoritesList = useMemo(
    () => restaurant.restaurants.filter((r) => restaurantFavoritesIds.some((id) => String(id) === String(r.id))),
    [restaurant.restaurants, restaurantFavoritesIds]
  );

  const addToCart = useCallback((item) => {
    setCart((prev) => [...prev, { ...item, id: Date.now(), quantity: 1 }]);
  }, []);

  const removeFromCart = useCallback((itemId) => {
    setCart((prev) => prev.filter((item) => item.id !== itemId));
  }, []);

  const updateCartQuantity = useCallback((itemId, quantity) => {
    if (quantity <= 0) {
      setCart((prev) => prev.filter((item) => item.id !== itemId));
    } else {
      setCart((prev) => prev.map((item) => (item.id === itemId ? { ...item, quantity } : item)));
    }
  }, []);

  return {
    ...restaurant,
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
  };
}
