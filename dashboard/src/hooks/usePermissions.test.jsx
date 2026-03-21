import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import * as Settings from '../pages/Settings';
import { usePermissions } from './usePermissions';

vi.mock('../pages/Settings', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getAccessByRole: vi.fn(),
  };
});

describe('usePermissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.removeItem('adminUser');
    vi.mocked(Settings.getAccessByRole).mockReturnValue({
      admin: { restaurants: true, shop: false, ads: true },
      crew: { restaurants: true, shop: true, ads: false },
      passenger: { restaurants: false, shop: false, ads: false },
    });
  });

  it('sans utilisateur stocké, applique le rôle admin et les droits admin', () => {
    const { result } = renderHook(() => usePermissions(null));

    expect(result.current.role).toBe('admin');
    expect(result.current.can('restaurants')).toBe(true);
    expect(result.current.can('shop')).toBe(false);
    expect(result.current.can('ads')).toBe(true);
  });

  it('lit le rôle depuis localStorage quand aucun user n’est passé en props', () => {
    localStorage.setItem('adminUser', JSON.stringify({ role: 'crew' }));

    const { result } = renderHook(() => usePermissions());

    expect(result.current.role).toBe('crew');
    expect(result.current.can('shop')).toBe(true);
    expect(result.current.can('ads')).toBe(false);
  });

  it('priorise allowedModules explicites sur la matrice du rôle', () => {
    const { result } = renderHook(() =>
      usePermissions({
        role: 'admin',
        allowedModules: { restaurants: false, shop: true },
      })
    );

    expect(result.current.role).toBe('admin');
    expect(result.current.can('restaurants')).toBe(false);
    expect(result.current.can('shop')).toBe(true);
  });

  it('ignore allowedModules vide et retombe sur la matrice du rôle', () => {
    const { result } = renderHook(() =>
      usePermissions({
        role: 'crew',
        allowedModules: {},
      })
    );

    expect(result.current.can('restaurants')).toBe(true);
    expect(result.current.can('ads')).toBe(false);
  });

  it('traite un rôle inconnu comme admin pour la matrice', () => {
    const { result } = renderHook(() => usePermissions({ role: 'superuser', allowedModules: null }));

    expect(result.current.role).toBe('admin');
    expect(result.current.can('restaurants')).toBe(true);
  });

  it('ignore adminUser illisible dans localStorage', () => {
    localStorage.setItem('adminUser', '{not-json');

    const { result } = renderHook(() => usePermissions());

    expect(result.current.role).toBe('admin');
    expect(result.current.can('restaurants')).toBe(true);
  });
});
