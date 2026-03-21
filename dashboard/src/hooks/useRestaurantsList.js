import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { apiService } from '../services/apiService';

/**
 * Liste restaurants admin (GET /restaurants).
 */
export function useRestaurantsList() {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiService.getRestaurants();
      const list = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
      setRestaurants(list);
    } catch (err) {
      console.error('Erreur chargement restaurants:', err);
      toast.error(err.response?.data?.message || 'Impossible de charger les restaurants');
      setRestaurants([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { restaurants, setRestaurants, loading, refetch };
}
