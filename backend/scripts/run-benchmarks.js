#!/usr/bin/env node
/**
 * Enchaîne les micro-benchmarks Node du dossier scripts/ (CPU, pas I/O réseau).
 * Usage : node scripts/run-benchmarks.js
 */
const { spawnSync } = require('child_process');
const path = require('path');

const SCRIPTS = ['bench-middleware-helpers.js', 'bench-auth-user-cache.js'];

let failed = false;
for (const name of SCRIPTS) {
  const scriptPath = path.join(__dirname, name);
  const r = spawnSync(process.execPath, [scriptPath], {
    stdio: 'inherit',
    env: process.env,
  });
  if (r.status !== 0) {
    failed = true;
    console.error(`\n[run-benchmarks] Échec : ${name} (code ${r.status ?? 'null'})\n`);
  }
}

process.exit(failed ? 1 : 0);
