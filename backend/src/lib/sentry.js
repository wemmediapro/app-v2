/**
 * Sentry — monitoring des erreurs en production.
 * Actif uniquement si SENTRY_DSN est défini (recommandé en production).
 */
let Sentry = null;
let isActive = false;

function init() {
  const dsn = process.env.SENTRY_DSN;
  const env = process.env.NODE_ENV || 'development';
  if (!dsn || typeof dsn !== 'string' || !dsn.startsWith('https://')) {
    return;
  }
  try {
    Sentry = require('@sentry/node');
    Sentry.init({
      dsn,
      environment: env,
      tracesSampleRate: env === 'production' ? 0.1 : 1,
      maxBreadcrumbs: 50,
      beforeSend(event, hint) {
        if (process.env.SENTRY_IGNORE_LOGS === '1') {return null;}
        return event;
      },
    });
    isActive = true;
    console.log('✅ Sentry: monitoring des erreurs actif');
  } catch (err) {
    console.warn('⚠️  Sentry: init échouée', err.message);
  }
}

function captureException(err) {
  if (isActive && Sentry) {
    Sentry.captureException(err);
  }
}

function captureMessage(message, level = 'error') {
  if (isActive && Sentry) {
    Sentry.captureMessage(message, level);
  }
}

module.exports = { init, captureException, captureMessage, isActive: () => isActive };
