#!/usr/bin/env node
/**
 * Benchmark indicatif : coût d’un « hit » cache utilisateur (lecture mémoire)
 * vs simulation d’un lookup Mongo (async no-op + petit objet).
 *
 * Usage : node scripts/bench-auth-user-cache.js
 *
 * Interprétation :
 * - « Avant » (sans cache) : chaque requête authentifiée implique au minimum
 *   User.findById().lean() + réseau Mongo → typiquement 0,5–5 ms selon latence.
 * - « Après » (hit Redis) : GET + désérialisation JSON → souvent < 1 ms en LAN.
 * - Ce script isole seulement le coût CPU côté Node (pas Mongo/Redis réels).
 */
const { performance } = require('perf_hooks');

const ITERS = 30_000;
const userDoc = {
  _id: '507f1f77bcf86cd799439011',
  email: 'bench@test.com',
  role: 'user',
  isActive: true,
  twoFactorEnabled: false,
};
const serialized = JSON.stringify(userDoc);

async function simulateMongoLean() {
  return Promise.resolve({ ...userDoc });
}

function benchAsync(name, iterations, fn) {
  return (async () => {
    const t0 = performance.now();
    for (let i = 0; i < iterations; i++) {
      await fn(i);
    }
    const ms = performance.now() - t0;
    const perUs = (ms / iterations) * 1000;
    console.log(`${name}: ${perUs.toFixed(3)} µs/iter (${ms.toFixed(1)} ms / ${iterations})`);
  })();
}

async function main() {
  console.log(`\n=== Auth user cache — benchmark CPU (${ITERS.toLocaleString()} iters) ===\n`);

  await benchAsync('Avant (simulé): await Promise + clone objet user (type lean)', ITERS, () =>
    simulateMongoLean()
  );

  await benchAsync('Après (simulé): JSON.parse hit cache (type Redis GET)', ITERS, () =>
    Promise.resolve(JSON.parse(serialized))
  );

  console.log(`
Notes :
- Ce script ne mesure pas la latence réseau Mongo/Redis : un « miss » coûte typiquement
  des centaines de µs à plusieurs ms (RTT + serveur) ; un « hit » Redis reste souvent
  nettement plus rapide qu’un findById distant.
- TTL Redis 60 s : après expiration, retour automatique au chemin Mongo (miss).
- En prod : autocannon/k6 sur une route protégée avec cache chaud vs froid.
`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
