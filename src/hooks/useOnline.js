/**
 * Hook useOnline — connectivité + enregistrement Background Sync à la reconnexion.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { getAll } from '../services/offlineQueue';
import { registerSync, attachSyncResultListener } from '../services/backgroundSync';

function countPending(items) {
  return items.filter(
    (i) => i.status === 'pending' || i.status === 'failed' || i.status === 'sending'
  ).length;
}

export function useOnline() {
  const [isOnline, setIsOnline] = useState(
    () => (typeof navigator !== 'undefined' ? navigator.onLine : true)
  );
  const [syncFeedback, setSyncFeedback] = useState(null);
  const prevOnlineRef = useRef(isOnline);
  const syncingRef = useRef(false);

  const handleSyncResult = useCallback((detail) => {
    if (detail.ok) {
      syncingRef.current = false;
      // Le flush dans l’onglet déclenche déjà `offlineSentNotice` — on retire seulement « Synchronisation… »
      if (detail.source === 'main-thread-flush') {
        setSyncFeedback(null);
        return;
      }
      if (detail.processed > 0) {
        setSyncFeedback({ state: 'success', processed: detail.processed, source: detail.source });
      } else {
        setSyncFeedback(null);
      }
      return;
    }
    syncingRef.current = false;
    setSyncFeedback({
      state: 'error',
      message: detail.message || 'sync_failed',
      source: detail.source,
    });
  }, []);

  useEffect(() => {
    return attachSyncResultListener(handleSyncResult);
  }, [handleSyncResult]);

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

  useEffect(() => {
    const wasOnline = prevOnlineRef.current;
    prevOnlineRef.current = isOnline;
    if (wasOnline || !isOnline) return undefined;

    let cancelled = false;
    (async () => {
      try {
        const items = await getAll();
        const n = countPending(items);
        if (cancelled || n === 0) return;
        syncingRef.current = true;
        setSyncFeedback({ state: 'syncing' });
        await registerSync();
      } catch (e) {
        syncingRef.current = false;
        console.warn('[useOnline] registerSync', e);
        setSyncFeedback({ state: 'error', message: 'register_failed' });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOnline]);

  useEffect(() => {
    if (!syncFeedback || syncFeedback.state === 'syncing') return undefined;
    const t = window.setTimeout(() => setSyncFeedback(null), 5000);
    return () => clearTimeout(t);
  }, [syncFeedback]);

  return { isOnline, syncFeedback };
}
