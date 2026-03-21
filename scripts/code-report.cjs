#!/usr/bin/env node
/**
 * Rapport d’inventaire code : métriques fichiers / lignes, versions npm, état Git.
 *
 * Usage :
 *   node scripts/code-report.cjs
 *   node scripts/code-report.cjs --json-only
 *   OUT_DIR=reports node scripts/code-report.cjs
 *
 * Sorties : `reports/code-report.md` et `reports/code-report.json` (défaut `reports/` à la racine du repo).
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const outDir = process.env.OUT_DIR ? path.resolve(root, process.env.OUT_DIR) : path.join(root, 'reports');
const jsonOnly = process.argv.includes('--json-only');

const IGNORE_DIR_NAMES = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  '.nyc_output',
  '.vite',
  'playwright-report',
  'test-results',
  'profile-out',
]);

/** Extensions considérées comme « code ». Les `.ts` sous `public/uploads` (segments HLS) sont exclus via `isUnderPublicUploads`. */
const CODE_EXT = new Set(['.js', '.jsx', '.cjs', '.mjs', '.ts', '.tsx']);

function isUnderPublicUploads(relPosix) {
  return relPosix.includes('public/uploads/') || relPosix.startsWith('public/uploads/');
}

function git(args) {
  const r = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  if (r.status !== 0) return null;
  return (r.stdout || '').trim();
}

function readJsonSafe(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function walk(dir, relBase, acc) {
  const relDir = path.relative(relBase, dir).split(path.sep).join('/');
  if (isUnderPublicUploads(relDir)) {
    return;
  }
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    const name = ent.name;
    if (name.startsWith('.')) continue;
    const full = path.join(dir, name);
    const rel = path.relative(relBase, full).split(path.sep).join('/');
    if (ent.isDirectory()) {
      if (IGNORE_DIR_NAMES.has(name)) continue;
      walk(full, relBase, acc);
      continue;
    }
    if (!ent.isFile()) continue;
    const relPosix = rel.split(path.sep).join('/');
    if (isUnderPublicUploads(relPosix)) continue;
    const ext = path.extname(name).toLowerCase();
    acc.push({ full, rel: relPosix, ext });
  }
}

function countLines(filePath) {
  try {
    const buf = fs.readFileSync(filePath, 'utf8');
    return buf.split(/\r?\n/).length;
  } catch {
    return 0;
  }
}

function areaForRel(rel) {
  if (rel.startsWith('backend/src/')) return 'backend/src';
  if (rel.startsWith('backend/tests/')) return 'backend/tests';
  if (rel.startsWith('backend/scripts/')) return 'backend/scripts';
  if (rel.startsWith('dashboard/src/')) return 'dashboard/src';
  if (rel.startsWith('src/')) return 'src (passenger)';
  if (rel.startsWith('tests/')) return 'tests (e2e)';
  if (rel.startsWith('scripts/')) return 'scripts (root)';
  return 'other';
}

function main() {
  const files = [];
  walk(root, root, files);

  const codeFiles = files.filter((f) => CODE_EXT.has(f.ext));
  const byExt = {};
  const byArea = {};
  let totalLines = 0;
  const linesByArea = {};

  for (const f of codeFiles) {
    byExt[f.ext] = (byExt[f.ext] || 0) + 1;
    const area = areaForRel(f.rel);
    byArea[area] = (byArea[area] || 0) + 1;
    const n = countLines(f.full);
    totalLines += n;
    linesByArea[area] = (linesByArea[area] || 0) + n;
  }

  const packages = [];
  for (const rel of ['package.json', 'backend/package.json', 'dashboard/package.json']) {
    const j = readJsonSafe(path.join(root, rel));
    if (j) {
      packages.push({
        path: rel,
        name: j.name,
        version: j.version,
        private: j.private === true,
      });
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    node: process.version,
    platform: process.platform,
    git: {
      branch: git(['rev-parse', '--abbrev-ref', 'HEAD']),
      commit: git(['rev-parse', '--short', 'HEAD']),
      dirty: (() => {
        const s = git(['status', '--porcelain']);
        if (s == null) return null;
        const lines = s ? s.split('\n').filter(Boolean) : [];
        return { count: lines.length, sample: lines.slice(0, 12) };
      })(),
    },
    packages,
    inventory: {
      codeFilesTotal: codeFiles.length,
      linesTotal: totalLines,
      byExtension: byExt,
      filesByArea: byArea,
      linesByArea,
    },
  };

  fs.mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, 'code-report.json');
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  if (jsonOnly) {
    console.log(`Rapport JSON écrit : ${path.relative(root, jsonPath)}`);
    return;
  }

  const md = [];
  md.push('# Rapport code — GNV OnBoard');
  md.push('');
  md.push(`_Généré le ${report.generatedAt} (Node ${report.node}, ${report.platform})._`);
  md.push('');
  md.push('## Git');
  md.push('');
  md.push(`| Champ | Valeur |`);
  md.push(`|--------|--------|`);
  md.push(`| Branche | ${report.git.branch ?? '—'} |`);
  md.push(`| Commit | ${report.git.commit ?? '—'} |`);
  if (report.git.dirty) {
    md.push(`| Fichiers modifiés / non suivis | ${report.git.dirty.count} |`);
    if (report.git.dirty.sample.length) {
      md.push('');
      md.push('Échantillon :');
      md.push('');
      md.push('```');
      md.push(...report.git.dirty.sample);
      md.push('```');
    }
  }
  md.push('');
  md.push('## Paquets npm');
  md.push('');
  md.push(`| Chemin | Nom | Version |`);
  md.push(`|--------|-----|---------|`);
  for (const p of report.packages) {
    md.push(`| \`${p.path}\` | ${p.name} | ${p.version} |`);
  }
  md.push('');
  md.push('## Inventaire (fichiers code : .js, .jsx, .cjs, .mjs, .ts, .tsx)');
  md.push('');
  md.push(`- **Fichiers** : ${report.inventory.codeFilesTotal}`);
  md.push(`- **Lignes (brutes, tous fins de ligne)** : ${report.inventory.linesTotal.toLocaleString('fr-FR')}`);
  md.push('');
  md.push('### Fichiers par extension');
  md.push('');
  md.push(`| Extension | Fichiers |`);
  md.push(`|-----------|----------|`);
  const extSorted = Object.entries(report.inventory.byExtension).sort((a, b) => b[1] - a[1]);
  for (const [ext, n] of extSorted) {
    md.push(`| \`${ext}\` | ${n} |`);
  }
  md.push('');
  md.push('### Fichiers par zone');
  md.push('');
  md.push(`| Zone | Fichiers | Lignes |`);
  md.push(`|------|----------|--------|`);
  const areas = Object.keys(report.inventory.filesByArea).sort((a, b) => {
    const la = report.inventory.linesByArea[a] || 0;
    const lb = report.inventory.linesByArea[b] || 0;
    return lb - la;
  });
  for (const a of areas) {
    const fc = report.inventory.filesByArea[a];
    const lc = report.inventory.linesByArea[a] || 0;
    md.push(`| ${a} | ${fc} | ${lc.toLocaleString('fr-FR')} |`);
  }
  md.push('');
  md.push('## Méthode');
  md.push('');
  md.push(
    'Répertoires exclus : `node_modules`, `.git`, `dist`, `build`, `coverage`, `.vite`, rapports Playwright, etc.'
  );
  md.push('Arborescences `**/public/uploads/**` ignorées (médias / segments HLS, pas du code source).');
  md.push('');
  md.push('Relancer : `npm run report:code`');
  md.push('');

  const mdPath = path.join(outDir, 'code-report.md');
  fs.writeFileSync(mdPath, md.join('\n'), 'utf8');
  console.log(`Rapport Markdown : ${path.relative(root, mdPath)}`);
  console.log(`Rapport JSON      : ${path.relative(root, jsonPath)}`);
}

main();
