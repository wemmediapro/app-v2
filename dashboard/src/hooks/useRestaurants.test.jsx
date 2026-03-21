import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { apiService } from '../services/apiService';
import { useRestaurants } from './useRestaurants';

vi.mock('../services/apiService', () => ({
  apiService: {
    getRestaurants: vi.fn(),
  },
}));

describe('useRestaurants', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('charge la liste au montage', async () => {
    const rows = [{ _id: '1', name: 'R1' }];
    vi.mocked(apiService.getRestaurants).mockResolvedValue({ data: rows });

    const { result } = renderHook(() => useRestaurants(''));

    expect(result.current.loading).toBe(true);
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.restaurants).toEqual(rows);
    expect(result.current.error).toBeNull();
    expect(apiService.getRestaurants).toHaveBeenCalledWith('');
  });

  it('passe la query string à l’API', async () => {
    vi.mocked(apiService.getRestaurants).mockResolvedValue({ data: [] });

    renderHook(() => useRestaurants('lang=fr'));

    await waitFor(() => {
      expect(apiService.getRestaurants).toHaveBeenCalledWith('lang=fr');
    });
  });

  it('normalise une réponse non tableau en liste vide', async () => {
    vi.mocked(apiService.getRestaurants).mockResolvedValue({ data: { nested: true } });

    const { result } = renderHook(() => useRestaurants(''));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.restaurants).toEqual([]);
  });

  it('expose l’erreur et vide la liste en échec', async () => {
    const err = new Error('API');
    vi.mocked(apiService.getRestaurants).mockRejectedValue(err);

    const { result } = renderHook(() => useRestaurants(''));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.error).toBe(err);
    expect(result.current.restaurants).toEqual([]);
  });

  it('refetch recharge les données', async () => {
    vi.mocked(apiService.getRestaurants)
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [{ _id: 'x' }] });

    const { result } = renderHook(() => useRestaurants(''));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.restaurants).toHaveLength(0);

    await result.current.refetch();

    await waitFor(() => {
      expect(result.current.restaurants).toEqual([{ _id: 'x' }]);
    });
    expect(apiService.getRestaurants).toHaveBeenCalledTimes(2);
  });
});
