/**
 * Thème affichage passager : `light`, `dark`, ou `system` (suit `prefers-color-scheme`).
 * Persiste la préférence dans `localStorage` (`gnv-theme`) et applique la classe Tailwind `dark` sur `<html>`.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'gnv-theme';

/** @typedef {'light' | 'dark' | 'system'} ThemePreference */

const ThemeContext = createContext(null);

function readStoredPreference() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'light' || raw === 'dark' || raw === 'system') {
      return raw;
    }
  } catch (_) {}
  return 'system';
}

function systemPrefersDark() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function ThemeProvider({ children }) {
  const [preference, setPreferenceState] = useState(() =>
    typeof window !== 'undefined' ? readStoredPreference() : 'system'
  );
  const [systemDark, setSystemDark] = useState(() => (typeof window !== 'undefined' ? systemPrefersDark() : false));

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') {
      return undefined;
    }
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setSystemDark(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const resolvedDark = preference === 'dark' || (preference === 'system' && systemDark);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolvedDark);
  }, [resolvedDark]);

  const setPreference = useCallback((next) => {
    setPreferenceState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch (_) {}
  }, []);

  const cycleTheme = useCallback(() => {
    setPreferenceState((prev) => {
      const order = /** @type {const} */ (['light', 'dark', 'system']);
      const i = order.indexOf(prev);
      const next = order[(i + 1) % order.length];
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch (_) {}
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      preference,
      resolvedDark,
      setPreference,
      cycleTheme,
    }),
    [preference, resolvedDark, setPreference, cycleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme doit être utilisé sous ThemeProvider');
  }
  return ctx;
}
