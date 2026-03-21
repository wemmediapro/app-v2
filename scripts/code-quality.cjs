#!/usr/bin/env node
/**
 * Qualité code : ESLint --fix (frontend + backend), optionnel Prettier, puis verify:all.
 *
 * Usage:
 *   node scripts/code-quality.cjs              # fix + verify:all (défaut)
 *   node scripts/code-quality.cjs --check-only # verify:all sans modifier les fichiers
 *   node scripts/code-quality.cjs --fix-only   # uniquement lint:fix (+ format si --format)
 *   node scripts/code-quality.cjs --format     # ajoute Prettier racine + backend avant verify
 */

const { spawnSync } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const checkOnly = args.includes('--check-only');
const fixOnly = args.includes('--fix-only');
const withFormat = args.includes('--format');

function run(label, command, argsList, cwd = root) {
  console.log(`\n── ${label} ──\n`);
  const r = spawnSync(command, argsList, {
    cwd,
    stdio: 'inherit',
    env: process.env,
    shell: process.platform === 'win32',
  });
  const code = r.status ?? (r.signal ? 1 : 0);
  if (code !== 0) {
    process.exit(code);
  }
}

function main() {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
code-quality.cjs — ESLint fix + gate qualité (tests, build, lint, audit)

  (sans option)     lint:fix front/back [+ format si --format] puis npm run verify:all
  --check-only      npm run verify:all uniquement (CI / sans toucher aux fichiers)
  --fix-only        lint:fix (+ format si --format), pas de tests/build
  --format          lance aussi npm run format (racine) et backend
  --help            cette aide
`);
    process.exit(0);
  }

  if (!checkOnly) {
    run('ESLint --fix (frontend src/)', 'npm', ['run', 'lint:fix'], root);
    run('ESLint --fix (backend/src/)', 'npm', ['run', 'lint:fix', '--prefix', 'backend'], root);

    if (withFormat) {
      run('Prettier (racine)', 'npm', ['run', 'format'], root);
      run('Prettier (backend)', 'npm', ['run', 'format', '--prefix', 'backend'], root);
      run('Prettier (dashboard)', 'npm', ['run', 'format', '--prefix', 'dashboard'], root);
    }
  }

  if (fixOnly) {
    console.log('\n✓ --fix-only : arrêt après correctifs automatiques.\n');
    process.exit(0);
  }

  run('verify:all (tests, build, lint, audit)', 'npm', ['run', 'verify:all'], root);
  console.log('\n✓ Qualité : terminé.\n');
}

main();
