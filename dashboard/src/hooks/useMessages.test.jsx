import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { apiService } from '../services/apiService';
import { useMessages } from './useMessages';

vi.mock('../services/apiService', () => ({
  apiService: {
    getNotificationsAll: vi.fn(),
  },
}));

describe('useMessages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('charge les notifications au montage', async () => {
    const rows = [{ _id: 'n1', title: 'Hello' }];
    vi.mocked(apiService.getNotificationsAll).mockResolvedValue({ data: rows });

    const { result } = renderHook(() => useMessages(''));

    expect(result.current.loading).toBe(true);
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.messages).toEqual(rows);
    expect(result.current.error).toBeNull();
    expect(apiService.getNotificationsAll).toHaveBeenCalledWith('');
  });

  it('passe les paramètres de query à l’API', async () => {
    vi.mocked(apiService.getNotificationsAll).mockResolvedValue({ data: [] });

    renderHook(() => useMessages('limit=10'));

    await waitFor(() => {
      expect(apiService.getNotificationsAll).toHaveBeenCalledWith('limit=10');
    });
  });

  it('met messages à [] si data n’est pas un tableau', async () => {
    vi.mocked(apiService.getNotificationsAll).mockResolvedValue({ data: { items: [] } });

    const { result } = renderHook(() => useMessages(''));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.messages).toEqual([]);
  });

  it('en erreur conserve l’erreur et vide la liste', async () => {
    const err = new Error('fail');
    vi.mocked(apiService.getNotificationsAll).mockRejectedValue(err);

    const { result } = renderHook(() => useMessages(''));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.error).toBe(err);
    expect(result.current.messages).toEqual([]);
  });

  it('refetch relance la requête', async () => {
    vi.mocked(apiService.getNotificationsAll)
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [{ _id: '2' }] });

    const { result } = renderHook(() => useMessages(''));

    await waitFor(() => expect(result.current.loading).toBe(false));

    await result.current.refetch();

    await waitFor(() => {
      expect(result.current.messages).toEqual([{ _id: '2' }]);
    });
    expect(apiService.getNotificationsAll).toHaveBeenCalledTimes(2);
  });
});
