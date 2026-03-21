/**
 * Navigation in-app synchronisée avec React Router (deep linking).
 */
import { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const PATH_MAP = {
  shop: 'shop',
  radio: 'radio',
  movies: 'movies',
  webtv: 'webtv',
  magazine: 'magazine',
  restaurant: 'restaurant',
  restaurants: 'restaurant',
  enfant: 'enfant',
  shipmap: 'shipmap',
  'plan-du-navire': 'shipmap',
  favorites: 'favorites',
  notifications: 'notifications',
};

export function pathnameToPage(pathname) {
  const raw = (pathname || '').replace(/^\/+|\/+$/g, '') || 'home';
  const p = raw === '' ? 'home' : raw.toLowerCase();
  return PATH_MAP[p] || (p === 'home' ? 'home' : null);
}

function pageToPathname(p) {
  return p === 'home' ? '/' : `/${p}`;
}

export function useAppNavigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const [page, setPageState] = useState(() => pathnameToPage(location.pathname) || 'home');

  const setPage = useCallback(
    (next) => {
      setPageState(next);
      const path = pageToPathname(next);
      if (location.pathname !== path) navigate(path, { replace: false });
    },
    [navigate, location.pathname]
  );

  useEffect(() => {
    const next = pathnameToPage(location.pathname);
    if (next) setPageState(next);
  }, [location.pathname]);

  useEffect(() => {
    const p = (location.pathname || '').replace(/^\/+|\/+$/g, '');
    if (p === 'feedback' || p === 'profile' || p === 'signup') {
      navigate('/', { replace: true });
      setPageState('home');
    }
  }, [location.pathname, navigate]);

  return { page, setPage, navigate };
}
