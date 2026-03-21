import { onCLS, onFCP, onINP, onLCP, onTTFB } from 'web-vitals';
import { API_BASE_URL } from '../services/apiService';

export function initWebVitalsReporting() {
  if (!import.meta.env.PROD) {
    return;
  }
  if (import.meta.env.VITE_ENABLE_WEB_VITALS === 'false') {
    return;
  }
  const url = `${API_BASE_URL}/metrics/web-vitals`;

  function send(metric) {
    const body = JSON.stringify({
      name: metric.name,
      value: metric.value,
      delta: metric.delta,
      id: metric.id,
      rating: metric.rating,
      navigationType: metric.navigationType,
    });
    try {
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
        return;
      }
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        credentials: 'include',
        keepalive: true,
      }).catch(() => {});
    } catch (_) {
      /* ignore */
    }
  }

  onCLS(send);
  onINP(send);
  onFCP(send);
  onLCP(send);
  onTTFB(send);
}
