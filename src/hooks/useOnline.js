/**
 * Hook useOnline — état de connectivité réseau (online/offline).
 * Référence : docs/REFACTORING-APP.md (structure cible App.jsx).
 */
import { useState, useEffect } from 'react';

export function useOnline() {
  const [isOnline, setIsOnline] = useState(
    () => (typeof navigator !== 'undefined' ? navigator.onLine : true)
  );

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  return isOnline;
}
