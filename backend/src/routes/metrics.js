/**
 * Métriques RUM (Core Web Vitals) — POST public, sans CSRF (sendBeacon).
 * Les données sont journalisées côté serveur (agrégation externe possible via log shipper).
 */

const express = require('express');
const logger = require('../lib/logger');

const router = express.Router();

const ALLOWED_NAMES = new Set(['CLS', 'FCP', 'FID', 'INP', 'LCP', 'TTFB']);

function sanitizeMetric(raw) {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const name = typeof raw.name === 'string' ? raw.name.toUpperCase() : '';
  if (!ALLOWED_NAMES.has(name)) {
    return null;
  }
  const value = Number(raw.value);
  if (!Number.isFinite(value)) {
    return null;
  }
  const delta = Number(raw.delta);
  return {
    name,
    value,
    delta: Number.isFinite(delta) ? delta : value,
    id: typeof raw.id === 'string' ? raw.id.slice(0, 64) : undefined,
    rating: typeof raw.rating === 'string' ? raw.rating.slice(0, 16) : undefined,
    navigationType: typeof raw.navigationType === 'string' ? raw.navigationType.slice(0, 32) : undefined,
  };
}

router.post(
  '/web-vitals',
  express.json({
    limit: 16 * 1024,
  }),
  (req, res) => {
    const raw = req.body;
    const items = Array.isArray(raw) ? raw : raw ? [raw] : [];
    const metrics = [];
    for (const item of items) {
      const m = sanitizeMetric(item);
      if (m) {
        metrics.push(m);
      }
    }
    if (metrics.length === 0) {
      return res.status(400).json({ success: false, message: 'Aucune métrique valide' });
    }
    logger.info({ event: 'web_vitals', metrics, ip: req.ip }, 'web vitals');
    return res.status(204).end();
  }
);

module.exports = router;
