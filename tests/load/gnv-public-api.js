/**
 * k6 — charge lecture seule sur les GET publics (sans JWT).
 *
 * Profils :
 *   défaut : rampe modérée puis palier (adapté laptop / staging)
 *   CI     : LOAD_PROFILE=ci | CI=true | GITHUB_ACTIONS=true
 *
 * Usage :
 *   k6 run tests/load/gnv-public-api.js
 *   API_URL=http://127.0.0.1:3001 LOAD_PROFILE=ci k6 run tests/load/gnv-public-api.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';

const API = (__ENV.API_URL || 'http://localhost:3000').replace(/\/$/, '');
const IS_CI = __ENV.LOAD_PROFILE === 'ci' || __ENV.CI === 'true' || __ENV.GITHUB_ACTIONS === 'true';

const STAGES = IS_CI
  ? [
      { duration: '20s', target: 40 },
      { duration: '1m', target: 40 },
      { duration: '15s', target: 0 },
    ]
  : [
      { duration: '1m', target: 120 },
      { duration: '4m', target: 120 },
      { duration: '45s', target: 0 },
    ];

export const options = {
  scenarios: {
    public_readonly: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: STAGES,
      gracefulRampDown: IS_CI ? '10s' : '30s',
      exec: 'readPublicApi',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.02'],
    http_req_duration: ['p(95)<1000'],
  },
};

/** Chemins GET anonymes (préfixe /api — alias versionné côté serveur). */
const PATHS = [
  '/api/health',
  '/api/movies?limit=15&page=1',
  '/api/restaurants?lang=fr',
  '/api/radio?lang=fr',
  '/api/banners?lang=fr&page=home',
  '/api/magazine?lang=fr&limit=20&page=1',
  '/api/webtv/channels?lang=fr',
  '/api/enfant/activities?lang=fr',
  '/api/shipmap',
  '/api/notifications?page=1&limit=10&lang=fr',
  '/api/trailers?limit=10',
  '/api/shop?lang=fr&limit=20&page=1',
];

export function readPublicApi() {
  const path = PATHS[Math.floor(Math.random() * PATHS.length)];
  const url = `${API}${path}`;
  const res = http.get(url, {
    tags: { name: path.split('?')[0] },
  });
  check(res, {
    'status 2xx': (r) => r.status >= 200 && r.status < 400,
  });
  sleep(0.2 + Math.random() * 0.8);
}
