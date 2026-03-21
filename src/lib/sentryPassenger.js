/**
 * Sentry (app passager) — chargé uniquement si `VITE_SENTRY_DSN` est défini (chunk séparé).
 */
let sentryModulePromise = null;

function getDsn() {
  return String(import.meta.env.VITE_SENTRY_DSN || '').trim();
}

function loadSentry() {
  const dsn = getDsn();
  if (!dsn || typeof window === 'undefined') return null;
  if (!sentryModulePromise) {
    sentryModulePromise = import('@sentry/react').then((Sentry) => {
      Sentry.init({
        dsn,
        environment: import.meta.env.MODE,
        sendDefaultPii: false,
      });
      return Sentry;
    });
  }
  return sentryModulePromise;
}

/** À appeler tôt dans `main.jsx` pour initialiser avant la première erreur si DSN présent. */
export function initPassengerSentry() {
  const p = loadSentry();
  if (p) p.catch(() => {});
}

/** @param {unknown} error @param {Record<string, unknown>} [captureContext] */
export function capturePassengerException(error, captureContext) {
  const p = loadSentry();
  if (!p) return;
  p.then((Sentry) => {
    Sentry.captureException(error, captureContext);
  }).catch(() => {});
}
