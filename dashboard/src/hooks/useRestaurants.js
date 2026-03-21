import { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/apiService';

/**
 * Liste restaurants (admin / réutilisation hors page Restaurants lourde).
 * @param {string} [queryString] ex. '' ou 'lang=fr'
 */
export function useRestaurants(queryString = '') {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiService.getRestaurants(queryString);
      setRestaurants(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      setError(e);
      setRestaurants([]);
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { restaurants, loading, error, refetch };
}
