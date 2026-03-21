#!/usr/bin/env node
/**
 * Vérifications statiques : exemples d’env sans credentials de démo évidents,
 * présence des clés ADMIN_* dans les templates.
 * Code 0 = OK, 1 = échec (CI).
 */
const fs = require('fs');
const path = require('path');

const backendRoot = path.join(__dirname, '..');
const errors = [];
const warns = [];

const FORBIDDEN_IN_EXAMPLES = [
  /^ADMIN_EMAIL=admin@gnv\.com\s*$/im,
  /^ADMIN_PASSWORD=admin123\s*$/im,
  /^ADMIN_PASSWORD=Admin123!\s*$/im,
];

const filesToScan = [
  path.join(backendRoot, '.env.example'),
  path.join(backendRoot, 'env.example'),
  path.join(backendRoot, 'config.env.example'),
  path.join(backendRoot, 'config.production.env.example'),
];

function mustContain(filePath, needle) {
  const rel = path.relative(backendRoot, filePath);
  if (!fs.existsSync(filePath)) {
    warns.push(`Fichier absent (ignoré): ${rel}`);
    return;
  }
  const text = fs.readFileSync(filePath, 'utf8');
  if (!text.includes(needle)) {
    errors.push(`${rel} : doit mentionner ou contenir "${needle}" (documentation credentials).`);
  }
}

for (const f of filesToScan) {
  if (!fs.existsSync(f)) continue;
  const text = fs.readFileSync(f, 'utf8');
  for (const re of FORBIDDEN_IN_EXAMPLES) {
    if (re.test(text)) {
      errors.push(`${path.relative(backendRoot, f)} : retirez les identifiants de démo (${re.source}).`);
    }
  }
}

mustContain(path.join(backendRoot, '.env.example'), 'ADMIN_EMAIL');
mustContain(path.join(backendRoot, '.env.example'), 'ADMIN_PASSWORD');
mustContain(path.join(backendRoot, '.env.example'), 'Ne jamais utiliser');

const securityMd = path.join(backendRoot, '..', 'SECURITY.md');
if (!fs.existsSync(securityMd)) {
  errors.push('SECURITY.md manquant à la racine du dépôt.');
} else {
  const md = fs.readFileSync(securityMd, 'utf8');
  if (!/ADMIN_EMAIL/.test(md) || !/JWT/.test(md)) {
    errors.push('SECURITY.md : doit couvrir au minimum ADMIN_EMAIL et JWT.');
  }
}

if (warns.length) {
  console.warn('Avertissements:');
  warns.forEach((w) => console.warn('  -', w));
}

if (errors.length) {
  console.error('Échec audit security-credentials:');
  errors.forEach((e) => console.error('  -', e));
  process.exit(1);
}

console.log('✅ audit:security-credentials — OK');
process.exit(0);
