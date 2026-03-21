#!/usr/bin/env node
/**
 * Micro-benchmarks helpers middleware (regex, tunnel, JWT cache).
 * Usage : node scripts/bench-middleware-helpers.js
 *
 * Les temps « par requête HTTP » réels dépendent du réseau, Mongo, Redis ;
 * ce script mesure le coût CPU des primitives (µs/itération).
 */
const { performance } = require('perf_hooks');
const zlib = require('zlib');
const jwt = require('jsonwebtoken');
const { isTunnelOrigin, RE_PUBLIC_GET_LIST_SUB, jwtAdminSkipCache } = require('../src/lib/http-middleware-tuning');

const ITERS = 50_000;
const SAMPLE_ORIGIN = 'https://abc.trycloudflare.com';
const SAMPLE_SUB = '/movies?page=1';
const OLD_TUNNEL_TEST = (origin) =>
  /\.trycloudflare\.com$/i.test(origin) ||
  /\.cloudflare\.com$/i.test(origin) ||
  /\.ngrok/i.test(origin) ||
  /\.loca\.lt$/i.test(origin);

function benchSync(name, iterations, fn) {
  const t0 = performance.now();
  for (let i = 0; i < iterations; i++) {
    fn(i);
  }
  const ms = performance.now() - t0;
  const perReqUs = (ms / iterations) * 1000;
  console.log(`${name}: ${perReqUs.toFixed(3)} µs/iter (${ms.toFixed(1)} ms total / ${iterations})`);
}

const secret = 'bench-secret-at-least-32-characters!!';
const adminToken = jwt.sign({ id: '507f1f77bcf86cd799439011', role: 'admin' }, secret, { expiresIn: '1h' });

console.log(`\n=== Middleware micro-benchmarks (${ITERS.toLocaleString()} iters sauf JWT) ===\n`);

benchSync('Tunnel origin: 4× inline .test() (avant)', ITERS, () => OLD_TUNNEL_TEST(SAMPLE_ORIGIN));
benchSync('Tunnel origin: isTunnelOrigin() précompilé (après)', ITERS, () => isTunnelOrigin(SAMPLE_ORIGIN));

benchSync('Liste publique: RegExp inline (avant)', ITERS, () =>
  /^\/(movies|magazine|radio|banners|shop|restaurants|webtv|enfant|shipmap|notifications)(\/|$)/.test(SAMPLE_SUB)
);
benchSync('Liste publique: RE_PUBLIC_GET_LIST_SUB (après)', ITERS, () => RE_PUBLIC_GET_LIST_SUB.test(SAMPLE_SUB));

const jsonPayload = JSON.stringify({ data: Array.from({ length: 100 }, (_, i) => ({ id: i, name: 'item' })) });
const buf = Buffer.from(jsonPayload, 'utf8');
benchSync('zlib gzip sync level 6 (avant)', 2000, () => {
  zlib.gzipSync(buf, { level: 6 });
});
benchSync('zlib gzip sync level 4 (après)', 2000, () => {
  zlib.gzipSync(buf, { level: 4 });
});

const JWT_ITERS = 5_000;
benchSync('jwt.verify admin (sans cache)', JWT_ITERS, () => {
  jwt.verify(adminToken, secret);
});
// Warm cache
for (let i = 0; i < 10; i++) {
  jwtAdminSkipCache.isAdminVerified(adminToken, secret);
}
benchSync('jwtAdminSkipCache.isAdminVerified (cache chaud)', JWT_ITERS, () => {
  jwtAdminSkipCache.isAdminVerified(adminToken, secret);
});

console.log(`
Interprétation indicative (LAN, 1 worker) :
- Regex tunnel + liste : ordre 0,0x–0,5 µs → négligeable vs I/O.
- gzip niveau 4 vs 6 : ~10–30 % moins de CPU sur gros JSON ; taille +5–10 %.
- Cache JWT skip rate-limit : après warm-up, ~100× moins de travail que verify() (hash map vs crypto).
Pour mesurer la pile complète : autocannon ou k6 contre /api/v1/health avec/sans Authorization.
`);
