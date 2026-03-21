/**
 * Hook notifications : liste, chargement, badge "non lues".
 * Utilise normalizeApiList pour le parsing des réponses API.
 */
import { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';
import { normalizeApiList } from '../utils/api';

const NOTIFICATIONS_LAST_OPEN_KEY = 'gnv_notifications_last_open';

export function useNotifications(page, language) {
  const [notificationsList, setNotificationsList] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsUnreadCount, setNotificationsUnreadCount] = useState(0);

  const lang = language === 'fr' ? 'fr' : language === 'en' ? 'en' : 'fr';

  // Charger la liste quand on ouvre la page notifications
  useEffect(() => {
    if (page !== 'notifications') return;
    setNotificationsLoading(true);
    setNotificationsUnreadCount(0);
    try {
      localStorage.setItem(NOTIFICATIONS_LAST_OPEN_KEY, String(Date.now()));
    } catch (_) {}
    apiService
      .getNotifications(`limit=30&lang=${lang}&_=${Date.now()}`)
      .then((r) => setNotificationsList(normalizeApiList(r?.data)))
      .catch(() => setNotificationsList([]))
      .finally(() => setNotificationsLoading(false));
  }, [page, lang]);

  // Badge "non lues" quand on n'est pas sur la page notifications (polling + visibilité)
  // Chaîne setTimeout (pas setInterval relancé à chaque réponse) pour éviter d'empiler des timers.
  // En cas d'API indisponible (ex: backend non démarré), backoff pour limiter le bruit réseau / console.
  useEffect(() => {
    if (page === 'notifications') return;
    let cancelled = false;
    let consecutiveFailures = 0;
    let pollTimeoutId = null;
    let requestSeq = 0;

    const INTERVAL_VISIBLE_MS = 5 * 1000;
    const INTERVAL_HIDDEN_MS = 30 * 1000;
    const INTERVAL_BACKOFF_MS = 60 * 1000;
    const MAX_FAILURES_BEFORE_BACKOFF = 2;

    const baseDelayMs = () => {
      if (consecutiveFailures >= MAX_FAILURES_BEFORE_BACKOFF) return INTERVAL_BACKOFF_MS;
      return document.visibilityState === 'visible' ? INTERVAL_VISIBLE_MS : INTERVAL_HIDDEN_MS;
    };

    const scheduleNextPoll = (delayMs) => {
      if (cancelled) return;
      clearTimeout(pollTimeoutId);
      pollTimeoutId = setTimeout(runPoll, delayMs);
    };

    const runPoll = () => {
      if (cancelled) return;
      const mySeq = ++requestSeq;
      apiService
        .getNotifications(`limit=50&lang=${lang}&_=${Date.now()}`)
        .then((r) => {
          if (cancelled || mySeq !== requestSeq) return;
          consecutiveFailures = 0;
          const list = normalizeApiList(r?.data);
          let lastOpen = 0;
          try {
            lastOpen = parseInt(localStorage.getItem(NOTIFICATIONS_LAST_OPEN_KEY) || '0', 10);
          } catch (_) {}
          let count;
          if (list.length === 0) {
            count = 0;
          } else if (lastOpen <= 0) {
            count = list.length;
          } else {
            count = list.filter((n) => {
              const t = n.createdAt != null ? new Date(n.createdAt).getTime() : 0;
              return !Number.isNaN(t) && t > lastOpen;
            }).length;
          }
          setNotificationsUnreadCount(count);
        })
        .catch(() => {
          if (cancelled || mySeq !== requestSeq) return;
          setNotificationsUnreadCount(0);
          consecutiveFailures += 1;
        })
        .finally(() => {
          if (cancelled || mySeq !== requestSeq) return;
          scheduleNextPoll(baseDelayMs());
        });
    };

    runPoll();

    let lastVisibilityFetch = 0;
    const VISIBILITY_FETCH_MIN_MS = 30000;
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const now = Date.now();
        if (now - lastVisibilityFetch >= VISIBILITY_FETCH_MIN_MS) {
          lastVisibilityFetch = now;
          clearTimeout(pollTimeoutId);
          pollTimeoutId = null;
          runPoll();
        }
      } else {
        scheduleNextPoll(baseDelayMs());
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelled = true;
      requestSeq += 1;
      clearTimeout(pollTimeoutId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [page, lang]);

  return {
    notificationsList,
    notificationsLoading,
    notificationsUnreadCount,
  };
}
