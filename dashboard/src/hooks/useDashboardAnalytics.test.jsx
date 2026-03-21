import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { apiService } from '../services/apiService';
import { useDashboardAnalytics } from './useDashboardAnalytics';

vi.mock('../services/apiService', () => ({
  apiService: {
    getAnalyticsOverview: vi.fn(),
    getAnalyticsConnections: vi.fn(),
    getAnalyticsContent: vi.fn(),
    getAnalyticsPerformance: vi.fn(),
  },
}));

describe('useDashboardAnalytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ne charge pas l’aperçu tant que les stats principales chargent', () => {
    renderHook(() => useDashboardAnalytics(true));
    expect(apiService.getAnalyticsOverview).not.toHaveBeenCalled();
  });

  it('charge l’aperçu quand mainStatsLoading passe à false', async () => {
    vi.mocked(apiService.getAnalyticsOverview).mockResolvedValue({ data: { total: 1 } });

    const { rerender } = renderHook(({ loading }) => useDashboardAnalytics(loading), {
      initialProps: { loading: true },
    });

    expect(apiService.getAnalyticsOverview).not.toHaveBeenCalled();

    rerender({ loading: false });

    await waitFor(() => {
      expect(apiService.getAnalyticsOverview).toHaveBeenCalledTimes(1);
    });
  });

  it('remplit analyticsData en succès et repasse analyticsLoading à false', async () => {
    vi.mocked(apiService.getAnalyticsOverview).mockResolvedValue({ data: { sessions: 3 } });

    const { result } = renderHook(() => useDashboardAnalytics(false));

    await waitFor(() => {
      expect(result.current.analyticsLoading).toBe(false);
    });
    expect(result.current.analyticsData).toEqual({ sessions: 3 });
  });

  it('met analyticsData à null si l’aperçu échoue', async () => {
    vi.mocked(apiService.getAnalyticsOverview).mockRejectedValue(new Error('fail'));

    const { result } = renderHook(() => useDashboardAnalytics(false));

    await waitFor(() => {
      expect(result.current.analyticsLoading).toBe(false);
    });
    expect(result.current.analyticsData).toBeNull();
  });

  it('charge les connexions quand l’onglet connections est actif', async () => {
    vi.mocked(apiService.getAnalyticsOverview).mockResolvedValue({ data: {} });
    vi.mocked(apiService.getAnalyticsConnections).mockResolvedValue({ data: { peaks: [] } });

    const { result } = renderHook(() => useDashboardAnalytics(false));

    await waitFor(() => {
      expect(result.current.analyticsLoading).toBe(false);
    });

    act(() => {
      result.current.setActiveAnalyticsTab('connections');
    });

    await waitFor(() => {
      expect(apiService.getAnalyticsConnections).toHaveBeenCalledTimes(1);
      expect(result.current.connectionsLoading).toBe(false);
    });
    expect(result.current.connectionsData).toEqual({ peaks: [] });
  });

  it('charge le contenu et la performance pour leurs onglets', async () => {
    vi.mocked(apiService.getAnalyticsOverview).mockResolvedValue({ data: {} });
    vi.mocked(apiService.getAnalyticsContent).mockResolvedValue({ data: { items: 2 } });
    vi.mocked(apiService.getAnalyticsPerformance).mockResolvedValue({ data: { ms: 40 } });

    const { result } = renderHook(() => useDashboardAnalytics(false));

    await waitFor(() => {
      expect(result.current.analyticsLoading).toBe(false);
    });

    act(() => {
      result.current.setActiveAnalyticsTab('content');
    });
    await waitFor(() => {
      expect(apiService.getAnalyticsContent).toHaveBeenCalledTimes(1);
      expect(result.current.contentData).toEqual({ items: 2 });
    });

    act(() => {
      result.current.setActiveAnalyticsTab('performance');
    });
    await waitFor(() => {
      expect(apiService.getAnalyticsPerformance).toHaveBeenCalledTimes(1);
      expect(result.current.performanceData).toEqual({ ms: 40 });
    });
  });

  it('met connectionsData à null si l’API connexions échoue', async () => {
    vi.mocked(apiService.getAnalyticsOverview).mockResolvedValue({ data: {} });
    vi.mocked(apiService.getAnalyticsConnections).mockRejectedValue(new Error('x'));

    const { result } = renderHook(() => useDashboardAnalytics(false));

    await waitFor(() => {
      expect(result.current.analyticsLoading).toBe(false);
    });

    act(() => {
      result.current.setActiveAnalyticsTab('connections');
    });

    await waitFor(() => {
      expect(result.current.connectionsLoading).toBe(false);
    });
    expect(result.current.connectionsData).toBeNull();
  });

  it('met contentData à null si l’API contenu échoue', async () => {
    vi.mocked(apiService.getAnalyticsOverview).mockResolvedValue({ data: {} });
    vi.mocked(apiService.getAnalyticsContent).mockRejectedValue(new Error('x'));

    const { result } = renderHook(() => useDashboardAnalytics(false));

    await waitFor(() => {
      expect(result.current.analyticsLoading).toBe(false);
    });

    act(() => {
      result.current.setActiveAnalyticsTab('content');
    });

    await waitFor(() => {
      expect(result.current.contentLoading).toBe(false);
    });
    expect(result.current.contentData).toBeNull();
  });

  it('met performanceData à null si l’API performance échoue', async () => {
    vi.mocked(apiService.getAnalyticsOverview).mockResolvedValue({ data: {} });
    vi.mocked(apiService.getAnalyticsPerformance).mockRejectedValue(new Error('x'));

    const { result } = renderHook(() => useDashboardAnalytics(false));

    await waitFor(() => {
      expect(result.current.analyticsLoading).toBe(false);
    });

    act(() => {
      result.current.setActiveAnalyticsTab('performance');
    });

    await waitFor(() => {
      expect(result.current.performanceLoading).toBe(false);
    });
    expect(result.current.performanceData).toBeNull();
  });
});
