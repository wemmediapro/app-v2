/**
 * Initialise la file hors ligne, synchronise le compteur, flush au retour online avec backoff exponentiel.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { getAll, flushPendingQueue, OFFLINE_QUEUE_MAX } from '../services/offlineQueue';

const BACKOFF_MS = [1000, 2000, 4000, 8000];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function countActionable(items) {
  return items.filter(
    (i) => i.status === 'pending' || i.status === 'failed' || i.status === 'sending',
  ).length;
}

/**
 * @param {{ onFlushComplete?: (info: { sent: number }) => void }} options
 */
export function useOfflineQueue(options = {}) {
  const { onFlushComplete } = options;
  const [pendingCount, setPendingCount] = useState(0);
  const flushingRef = useRef(false);

  const refreshCount = useCallback(async () => {
    try {
      const items = await getAll();
      setPendingCount(countActionable(items));
    } catch (e) {
      console.warn('[useOfflineQueue] refreshCount', e);
      setPendingCount(0);
    }
  }, []);

  const runFlushWithBackoff = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    if (flushingRef.current) return;
    flushingRef.current = true;
    let totalSent = 0;
    try {
      let attempt = 0;
      let remaining = 1;
      while (remaining > 0) {
        const { sent, remaining: rem } = await flushPendingQueue();
        totalSent += sent;
        remaining = rem;
        if (remaining === 0) break;
        if (attempt >= BACKOFF_MS.length) break;
        await sleep(BACKOFF_MS[attempt]);
        attempt++;
      }
      if (totalSent > 0) {
        if (typeof onFlushComplete === 'function') {
          onFlushComplete({ sent: totalSent });
        }
        window.dispatchEvent(
          new CustomEvent('gnv-offline-flush-complete', { detail: { sent: totalSent } }),
        );
      }
    } finally {
      flushingRef.current = false;
      await refreshCount();
    }
  }, [refreshCount, onFlushComplete]);

  useEffect(() => {
    refreshCount();
  }, [refreshCount]);

  useEffect(() => {
    const onOnline = () => {
      runFlushWithBackoff();
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [runFlushWithBackoff]);

  /** Au premier rendu : laisser un tick pour que useChat enregistre le flush handler (useLayoutEffect). */
  useEffect(() => {
    let cancelled = false;
    const id = window.requestAnimationFrame(() => {
      setTimeout(async () => {
        if (cancelled) return;
        if (typeof navigator !== 'undefined' && !navigator.onLine) return;
        try {
          const items = await getAll();
          const has = items.some((i) => i.status === 'pending' || i.status === 'failed');
          if (has) await runFlushWithBackoff();
        } catch (_) {}
      }, 0);
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(id);
    };
  }, [runFlushWithBackoff]);

  return {
    pendingCount,
    refreshCount,
    flushPending: runFlushWithBackoff,
    maxQueue: OFFLINE_QUEUE_MAX,
  };
}
