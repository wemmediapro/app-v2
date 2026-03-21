import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { apiService } from '../services/apiService';
import { useDashboardStats } from './useDashboardStats';

vi.mock('../services/apiService', () => ({
  apiService: {
    getDashboardStats: vi.fn(),
  },
}));

const EMPTY_SHAPE = {
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

describe('useDashboardStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('charge les stats au montage', async () => {
    const payload = {
      statistics: { totalUsers: 9 },
      charts: { feedbackByStatus: [], usersByRole: [{ _id: 'admin', count: 2 }] },
      recent: { users: [], feedback: [] },
    };
    vi.mocked(apiService.getDashboardStats).mockResolvedValue({ data: payload });

    const { result } = renderHook(() => useDashboardStats());

    expect(result.current.loading).toBe(true);
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.stats).toEqual(payload);
    expect(apiService.getDashboardStats).toHaveBeenCalledTimes(1);
  });

  it('en erreur applique les stats vides par défaut', async () => {
    vi.mocked(apiService.getDashboardStats).mockRejectedValue(new Error('API down'));

    const { result } = renderHook(() => useDashboardStats());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.stats).toEqual(EMPTY_SHAPE);
  });

  it('refetch met à jour après un nouvel appel', async () => {
    const first = { ...EMPTY_SHAPE, statistics: { ...EMPTY_SHAPE.statistics, totalUsers: 1 } };
    const second = { ...EMPTY_SHAPE, statistics: { ...EMPTY_SHAPE.statistics, totalUsers: 2 } };
    vi.mocked(apiService.getDashboardStats)
      .mockResolvedValueOnce({ data: first })
      .mockResolvedValueOnce({ data: second });

    const { result } = renderHook(() => useDashboardStats());

    await waitFor(() => {
      expect(result.current.stats?.statistics?.totalUsers).toBe(1);
    });

    await result.current.refetch();

    await waitFor(() => {
      expect(result.current.stats?.statistics?.totalUsers).toBe(2);
    });
    expect(apiService.getDashboardStats).toHaveBeenCalledTimes(2);
  });
});
