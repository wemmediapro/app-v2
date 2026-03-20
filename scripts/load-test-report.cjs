#!/usr/bin/env node
/**
 * Rapports de charge : k6 (JSON summary) + Artillery (JSON + HTML).
 * Profil : LOAD_REPORT_PROFILE=ci | full (défaut ci — plus court).
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const outDir = path.join(root, 'tests', 'load', 'out');
const profile = process.env.LOAD_REPORT_PROFILE === 'full' ? 'full' : 'ci';

fs.mkdirSync(outDir, { recursive: true });

const k6Summary = path.join(outDir, 'k6-summary.json');
const artilleryJson = path.join(outDir, 'artillery-report.json');
const artilleryHtml = path.join(outDir, 'artillery-report.html');

const env = {
  ...process.env,
  LOAD_PROFILE: profile,
  API_URL: process.env.API_URL || 'http://localhost:3000',
};

console.log(`[load-test-report] Profil: ${profile} → sorties dans ${outDir}\n`);

execSync(`k6 run --summary-export="${k6Summary}" tests/load/gnv-1500-connections.js`, {
  cwd: root,
  stdio: 'inherit',
  env,
});

execSync(
  `npx artillery run -e ${profile} --output "${artilleryJson}" tests/load/gnv-1500-connections.yaml`,
  {
    cwd: root,
    stdio: 'inherit',
    env,
  }
);

execSync(`npx artillery report "${artilleryJson}" --output "${artilleryHtml}"`, {
  cwd: root,
  stdio: 'inherit',
});

console.log(`\n[load-test-report] Terminé.\n  - ${k6Summary}\n  - ${artilleryJson}\n  - ${artilleryHtml}`);
