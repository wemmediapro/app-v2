import { useState, useEffect } from 'react';

const MOBILE_BREAKPOINT = 1280;

/**
 * Retourne true si la largeur du viewport est < 1280px (mobile + tablette).
 * Utilisé pour afficher le menu hamburger au lieu de la sidebar fixe.
 */
export function useIsMobileView() {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.innerWidth < MOBILE_BREAKPOINT;
  });

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const handleChange = (e) => setIsMobile(e.matches);
    setIsMobile(mql.matches);
    mql.addEventListener('change', handleChange);
    return () => mql.removeEventListener('change', handleChange);
  }, []);

  return isMobile;
}
