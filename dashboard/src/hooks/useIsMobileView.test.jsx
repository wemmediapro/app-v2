import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useIsMobileView } from './useIsMobileView';

function createMql(matches) {
  return {
    matches,
    media: '',
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
}

describe('useIsMobileView', () => {
  let originalMatchMedia;

  beforeEach(() => {
    originalMatchMedia = window.matchMedia;
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('retourne false quand le viewport est large et matchMedia dit non', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1400,
    });
    window.matchMedia = vi.fn(() => createMql(false));

    const { result } = renderHook(() => useIsMobileView());

    expect(result.current).toBe(false);
  });

  it('retourne true quand le viewport est étroit', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 800,
    });
    window.matchMedia = vi.fn(() => createMql(true));

    const { result } = renderHook(() => useIsMobileView());

    expect(result.current).toBe(true);
  });

  it('réagit au changement de media query', async () => {
    const mql = createMql(true);
    window.matchMedia = vi.fn(() => mql);
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 600,
    });

    const { result } = renderHook(() => useIsMobileView());

    expect(result.current).toBe(true);

    const changeHandler = mql.addEventListener.mock.calls.find((c) => c[0] === 'change')?.[1];
    expect(changeHandler).toBeTypeOf('function');

    act(() => {
      changeHandler({ matches: false });
    });

    await waitFor(() => {
      expect(result.current).toBe(false);
    });
  });
});
