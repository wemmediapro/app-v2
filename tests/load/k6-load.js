/**
 * Test de charge k6 — GNV OnBoard
 * Simule des utilisateurs qui naviguent et ouvrent des contenus (app locale WiFi, forte affluence).
 *
 * Prérequis : installer k6 (https://k6.io/docs/get-started/installation/)
 * Lancer l'app et le backend avant : npm run dev && npm run dev:backend
 *
 * Exécution :
 *   k6 run tests/load/k6-load.js
 *   k6 run --vus 20 --duration 60s tests/load/k6-load.js
 *   npm run test:load
 */

import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5173';
const API_URL = __ENV.API_URL || 'http://localhost:3000';

export const options = {
  scenarios: {
    navigation: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 10 },
        { duration: '1m', target: 25 },
        { duration: '1m', target: 50 },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '10s',
      exec: 'navigateAndRead',
    },
    api: {
      executor: 'constant-vus',
      vus: 15,
      duration: '2m',
      startTime: '0s',
      exec: 'hitApi',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<2000'],
  },
};

export function navigateAndRead() {
  const res = http.get(`${BASE_URL}/`);
  check(res, { 'home status 200': (r) => r.status === 200 });
  sleep(1);

  const pages = ['/magazine', '/restaurant', '/webtv', '/movies', '/radio', '/shop'];
  const page = pages[Math.floor(Math.random() * pages.length)];
  const r2 = http.get(`${BASE_URL}${page}`);
  check(r2, { 'page status 200': (r) => r.status === 200 });
  sleep(0.5 + Math.random() * 1.5);
}

export function hitApi() {
  const base = API_URL.replace(/\/$/, '');
  const endpoints = [
    `${base}/api/movies?limit=20&page=1`,
    `${base}/api/magazine?lang=fr&limit=50&page=1`,
    `${base}/api/restaurants?lang=fr`,
    `${base}/api/radio?lang=fr`,
    `${base}/api/banners?lang=fr&page=home`,
  ];
  const url = endpoints[Math.floor(Math.random() * endpoints.length)];
  const res = http.get(url);
  check(res, { 'api status 200': (r) => r.status === 200 });
  sleep(0.3 + Math.random() * 0.7);
}

// Résultats : k6 affiche en stdout latence (avg, p95, p99), débit (req/s), taux d'erreur.
// Export JSON optionnel : k6 run --out json=summary.json tests/load/k6-load.js
