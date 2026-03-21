import { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/apiService';

const EMPTY_DASHBOARD_STATS = {
  statistics: {
    totalUsers: 0,
    activeUsers: 0,
    totalRestaurants: 0,
    totalMessages: 0,
    totalFeedback: 0,
    totalRadioStations: 0,
    totalViewers: 0,
    totalMovies: 0,
    totalArticles: 0,
    totalActivities: 0,
    totalProducts: 0,
  },
  charts: { feedbackByStatus: [], usersByRole: [] },
  recent: { users: [], feedback: [] },
};

/**
 * Stats agrégées page dashboard admin (cartes + graphiques + récents).
 */
export function useDashboardStats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiService.getDashboardStats();
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching dashboard:', error);
      setStats(EMPTY_DASHBOARD_STATS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { stats, loading, refetch };
}
