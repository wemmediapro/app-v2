/**
 * Hook Restaurants : chargement, catégories, filtres, promos (audit CTO — découpage App.jsx).
 */
import { useState, useEffect, useMemo } from 'react';
import { apiService } from '../services/apiService';

export function useRestaurant(language, t, restaurantFavoritesIds = []) {
  const [restaurants, setRestaurants] = useState([]);
  const [restaurantsLoading, setRestaurantsLoading] = useState(true);
  const [restaurantSearchQuery, setRestaurantSearchQuery] = useState('');
  const [selectedRestaurantCategory, setSelectedRestaurantCategory] = useState('all');
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);

  const restaurantCategories = useMemo(() => [
    { id: 'all', name: t('restaurants.categoryAll'), icon: '🍽️' },
    { id: 'favoris', name: t('restaurants.favoris'), icon: '❤️' },
    { id: 'a-la-carte', name: t('restaurants.categoryALaCarte'), icon: '🍷' },
    { id: 'self-service', name: t('restaurants.categorySelfService'), icon: '🍲' },
    { id: 'snack-bar', name: t('restaurants.categorySnackBar'), icon: '☕' },
    { id: 'pizzeria', name: t('restaurants.categoryPizzeria'), icon: '🍕' },
  ], [t]);

  const filteredRestaurants = useMemo(() => restaurants.filter(restaurant => {
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
  }), [restaurants, selectedRestaurantCategory, restaurantSearchQuery, restaurantFavoritesIds]);

  const allPromotions = useMemo(() => restaurants.flatMap(restaurant =>
    (Array.isArray(restaurant.promotions) ? restaurant.promotions : []).map(promo => ({
      ...promo,
      restaurantName: restaurant.name,
      restaurantImage: restaurant.image,
      restaurantCategory: restaurant.category,
      restaurant,
    }))
  ), [restaurants]);

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
          menu: Array.isArray(r.menu) ? r.menu : [],
        }));
        if (!cancelled) setRestaurants(transformed);
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

  useEffect(() => {
    if (!selectedRestaurant || !restaurants.length) return;
    const updated = restaurants.find(r => String(r.id) === String(selectedRestaurant.id));
    if (updated && updated !== selectedRestaurant) {
      setSelectedRestaurant(updated);
    }
  }, [language, restaurants, selectedRestaurant]);

  return {
    restaurants,
    setRestaurants,
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
  };
}
