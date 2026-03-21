import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { authService } from '../services/authService';
import { useAuth } from './useAuth';

vi.mock('../services/authService', () => ({
  authService: {
    getProfile: vi.fn(),
    logout: vi.fn(),
  },
}));

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('authentifie un admin après getProfile', async () => {
    vi.mocked(authService.getProfile).mockResolvedValue({
      data: { role: 'admin', email: 'a@b.c', id: '1' },
    });

    const { result } = renderHook(() => useAuth());

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual({
      role: 'admin',
      email: 'a@b.c',
      id: '1',
    });
  });

  it('refuse un profil non admin', async () => {
    vi.mocked(authService.getProfile).mockResolvedValue({
      data: { role: 'crew', id: '2' },
    });

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it('en erreur réseau ou 401, reste déconnecté', async () => {
    vi.mocked(authService.getProfile).mockRejectedValue(new Error('fail'));

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it('login définit l’utilisateur sans appeler l’API', async () => {
    vi.mocked(authService.getProfile).mockResolvedValue({
      data: { role: 'admin', id: '1' },
    });

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.login('ignored', { role: 'admin', email: 'new@x.com' });
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user?.email).toBe('new@x.com');
  });

  it('logout appelle authService et réinitialise l’état', async () => {
    vi.mocked(authService.getProfile).mockResolvedValue({
      data: { role: 'admin', id: '1' },
    });
    vi.mocked(authService.logout).mockResolvedValue(undefined);

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.logout();
    });

    expect(authService.logout).toHaveBeenCalledTimes(1);
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });
});
