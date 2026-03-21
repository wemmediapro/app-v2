import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import toast from 'react-hot-toast';
import { apiService } from '../services/apiService';
import { useRestaurantsList } from './useRestaurantsList';

vi.mock('../services/apiService', () => ({
  apiService: {
    getRestaurants: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe('useRestaurantsList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('charge la liste au montage', async () => {
    const rows = [{ _id: '1', name: 'R1' }];
    apiService.getRestaurants.mockResolvedValue({ data: rows });

    const { result } = renderHook(() => useRestaurantsList());

    expect(result.current.loading).toBe(true);
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.restaurants).toEqual(rows);
    expect(apiService.getRestaurants).toHaveBeenCalledTimes(1);
  });

  it('accepte res.data.data comme liste', async () => {
    apiService.getRestaurants.mockResolvedValue({ data: { data: [{ _id: '2' }] } });

    const { result } = renderHook(() => useRestaurantsList());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.restaurants).toEqual([{ _id: '2' }]);
  });

  it('en erreur vide la liste et notifie', async () => {
    apiService.getRestaurants.mockRejectedValue({
      response: { data: { message: 'Échec API' } },
    });

    const { result } = renderHook(() => useRestaurantsList());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.restaurants).toEqual([]);
    expect(toast.error).toHaveBeenCalledWith('Échec API');
  });

  it('refetch recharge les restaurants', async () => {
    apiService.getRestaurants.mockResolvedValueOnce({ data: [] }).mockResolvedValueOnce({ data: [{ _id: 'x' }] });

    const { result } = renderHook(() => useRestaurantsList());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.restaurants).toHaveLength(0);

    await result.current.refetch();

    await waitFor(() => {
      expect(result.current.restaurants).toEqual([{ _id: 'x' }]);
    });
    expect(apiService.getRestaurants).toHaveBeenCalledTimes(2);
  });

  it('refetch en erreur vide la liste et affiche un toast', async () => {
    apiService.getRestaurants.mockResolvedValueOnce({ data: [{ _id: '1' }] }).mockRejectedValueOnce({ response: {} });

    const { result } = renderHook(() => useRestaurantsList());

    await waitFor(() => {
      expect(result.current.restaurants).toHaveLength(1);
    });

    await result.current.refetch();

    await waitFor(() => {
      expect(result.current.restaurants).toEqual([]);
    });
    expect(toast.error).toHaveBeenCalledWith('Impossible de charger les restaurants');
    expect(apiService.getRestaurants).toHaveBeenCalledTimes(2);
  });
});
