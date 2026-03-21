import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { LanguageProvider, useLanguage } from './LanguageContext';

function wrapper({ children }) {
  return <LanguageProvider>{children}</LanguageProvider>;
}

describe('LanguageProvider / useLanguage', () => {
  beforeEach(() => {
    localStorage.removeItem('language');
  });

  it('expose t() en français par défaut', () => {
    const { result } = renderHook(() => useLanguage(), { wrapper });

    expect(result.current.language).toBe('fr');
    expect(result.current.t('dashboard.title')).toBe('Tableau de bord');
  });

  it('remplace {{count}} dans les chaînes', () => {
    const { result } = renderHook(() => useLanguage(), { wrapper });

    expect(result.current.t('restaurants.restaurantsCount', { count: 3 })).toBe('3 restaurant(s) à bord');
  });

  it('changeLanguage met à jour language et t()', () => {
    const { result } = renderHook(() => useLanguage(), { wrapper });

    act(() => {
      result.current.changeLanguage('en');
    });

    expect(result.current.language).toBe('en');
    expect(result.current.t('dashboard.title')).toBe('Dashboard');
  });

  it('mappe l’arabe stocké vers le français (dashboard)', () => {
    localStorage.setItem('language', 'ar');

    const { result } = renderHook(() => useLanguage(), { wrapper });

    expect(result.current.language).toBe('fr');
  });

  it('t retourne la clé si la traduction est absente', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { result } = renderHook(() => useLanguage(), { wrapper });

    expect(result.current.t('missing.key.path.xyz')).toBe('missing.key.path.xyz');

    warn.mockRestore();
  });
});
