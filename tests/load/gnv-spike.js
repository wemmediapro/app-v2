/**
 * k6 — test de **pic** (montée brutale de VUs) sur GET publics.
 * Utile pour valider rate-limit, pool Mongo, file d’attente sous afflux soudain.
 *
 *   k6 run tests/load/gnv-spike.js
 *   LOAD_PROFILE=ci k6 run tests/load/gnv-spike.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';

const API = (__ENV.API_URL || 'http://localhost:3000').replace(/\/$/, '');
const IS_CI = __ENV.LOAD_PROFILE === 'ci' || __ENV.CI === 'true' || __ENV.GITHUB_ACTIONS === 'true';

const PEAK = IS_CI ? 80 : 400;

export const options = {
  scenarios: {
    spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: IS_CI
        ? [
            { duration: '5s', target: PEAK },
            { duration: '30s', target: PEAK },
            { duration: '10s', target: 0 },
          ]
        : [
            { duration: '10s', target: PEAK },
            { duration: '1m', target: PEAK },
            { duration: '20s', target: 0 },
          ],
      gracefulRampDown: '15s',
      exec: 'spikeHit',
    },
  },
  thresholds: {
    // Pic : tolère un peu plus d’erreurs transitoires
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<2000'],
  },
};

const URLS = [
  `${API}/api/health`,
  `${API}/api/movies?limit=10&page=1`,
  `${API}/api/restaurants?lang=fr`,
  `${API}/api/radio?lang=fr`,
  `${API}/api/banners?lang=fr`,
];

export function spikeHit() {
  const url = URLS[Math.floor(Math.random() * URLS.length)];
  const res = http.get(url, { tags: { name: 'spike' } });
  check(res, { '2xx': (r) => r.status >= 200 && r.status < 400 });
  sleep(0.05 + Math.random() * 0.15);
}
