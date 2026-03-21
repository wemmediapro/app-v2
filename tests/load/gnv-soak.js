/**
 * k6 — test de **soak** (durée longue, charge faible) : stabilité mémoire / fuites / Redis.
 *
 *   k6 run tests/load/gnv-soak.js
 *   LOAD_PROFILE=ci k6 run tests/load/gnv-soak.js   # ~90 s
 */

import http from 'k6/http';
import { check, sleep } from 'k6';

const API = (__ENV.API_URL || 'http://localhost:3000').replace(/\/$/, '');
const IS_CI = __ENV.LOAD_PROFILE === 'ci' || __ENV.CI === 'true' || __ENV.GITHUB_ACTIONS === 'true';

const VUS = IS_CI ? 3 : 8;
const DURATION = IS_CI ? '90s' : '15m';

export const options = {
  scenarios: {
    soak: {
      executor: 'constant-vus',
      vus: VUS,
      duration: DURATION,
      gracefulStop: '30s',
      exec: 'soakIteration',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<600'],
  },
};

export function soakIteration() {
  const h = http.get(`${API}/api/health`, { tags: { name: '/api/health' } });
  check(h, { 'health ok': (r) => r.status === 200 });

  if (Math.random() < 0.4) {
    const r = http.get(`${API}/api/movies?limit=5&page=1`, { tags: { name: '/api/movies' } });
    check(r, { 'movies ok': (r) => r.status >= 200 && r.status < 400 });
  }

  sleep(1 + Math.random() * 2);
}
