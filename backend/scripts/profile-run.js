#!/usr/bin/env node
/**
 * Lance `server.js` avec le profiler V8 intégré (CPU ou heap).
 * Les fichiers sont écrits dans `backend/profile-out/` à l’arrêt du processus (Ctrl+C ou SIGTERM).
 *
 * Usage :
 *   node scripts/profile-run.js cpu
 *   node scripts/profile-run.js heap
 *
 * Puis, dans un autre terminal : charge k6 / Artillery / curl pour générer du trafic.
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const mode = (process.argv[2] || '').toLowerCase();
const profileDir = path.join(__dirname, '..', 'profile-out');
fs.mkdirSync(profileDir, { recursive: true });

const flagBlock =
  mode === 'cpu'
    ? `--cpu-prof --cpu-prof-dir=${profileDir}`
    : mode === 'heap'
      ? `--heap-prof --heap-prof-dir=${profileDir}`
      : null;

if (!flagBlock) {
  console.error('Usage: node scripts/profile-run.js <cpu|heap>');
  process.exit(1);
}

const prev = process.env.NODE_OPTIONS ? String(process.env.NODE_OPTIONS).trim() : '';
process.env.NODE_OPTIONS = [prev, flagBlock].filter(Boolean).join(' ').trim();

const serverJs = path.join(__dirname, '..', 'server.js');
const child = spawn(process.execPath, [serverJs], {
  stdio: 'inherit',
  env: process.env,
  cwd: path.join(__dirname, '..'),
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.exit(0);
  }
  process.exit(code ?? 1);
});
