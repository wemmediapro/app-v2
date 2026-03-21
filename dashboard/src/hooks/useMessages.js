import { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/apiService';

/**
 * Notifications / messages broadcast (liste admin).
 * @param {string} [params] query string optionnelle pour GET /notifications/all
 */
export function useMessages(params = '') {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiService.getNotificationsAll(params);
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      setError(e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { messages: items, loading, error, refetch };
}
