/**
 * Sentry — monitoring des erreurs en production.
 * En production, SENTRY_DSN est exigé au démarrage (validateSecurityConfig) ; sans DSN valide, init() est sans effet.
 */
const logger = require('./logger');
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
        if (process.env.SENTRY_IGNORE_LOGS === '1') {
          return null;
        }
        return event;
      },
    });
    isActive = true;
    logger.info({ event: 'sentry_initialized' });
  } catch (err) {
    logger.warn({ event: 'sentry_init_failed', err: err.message, stack: err.stack });
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
