#!/usr/bin/env node
/**
 * Script d'audit de sécurité automatisé (backend Node.js)
 * Usage: node scripts/security-audit.js
 *   ou: npm run security:audit
 *
 * Vérifie (heuristiques statiques) :
 * - Absence de credentials en clair dans les logs console (scripts)
 * - Présence de validation MongoID / pagination sur des routes sensibles
 * - Redaction des emails dans le logger
 * - Absence d'évaluation dynamique évidente (eval, new Function, vm.*)
 * - Robustesse JWT_SECRET (longueur ≥ 32 si défini dans .env)
 * - Exports attendus des middlewares de validation
 * - Présence des tests sécurité
 * - npm audit (avertissements si vulnérabilités high/critical)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BACKEND_ROOT = path.join(__dirname, '..');
const SRC_ROOT = path.join(BACKEND_ROOT, 'src');

const CRITICAL_ISSUES = [];
const WARNINGS = [];
const PASSED = [];

function rel(p) {
  return path.relative(BACKEND_ROOT, p).replace(/\\/g, '/');
}

console.log('\n🔍 AUDIT DE SÉCURITÉ — GNV OnBoard (backend)\n');
console.log('='.repeat(60));

// ============ CHECK 1: Console output credentials ============
console.log('\n1️⃣  Vérification des credentials en console (scripts)...');

const scriptFilesToCheck = [
  'scripts/init-database.js',
  'scripts/init-database-prisma.js',
  'scripts/seed-admin.js',
  'scripts/reset-admin-password.js',
  'scripts/init-admin.js',
];

/** Motifs connus dangereux : identifiants de démo / mots de passe en dur dans console */
const credentialPatterns = [
  /console\.(log|error|warn|info|debug)\([^)]*['"](admin@gnv\.com|admin@example\.com)['"]/i,
  /console\.(log|error|warn|info|debug)\([^)]*Password\s*[:=]\s*['"][^'"]+['"]/i,
  /console\.(log|error|warn|info|debug)\([^)]*['"](Admin123!|admin123|password123)['"]/i,
];

let foundCredentials = false;
for (const file of scriptFilesToCheck) {
  const filePath = path.join(BACKEND_ROOT, file);
  if (!fs.existsSync(filePath)) {continue;}
  const content = fs.readFileSync(filePath, 'utf8');
  for (const pattern of credentialPatterns) {
    if (pattern.test(content)) {
      foundCredentials = true;
      CRITICAL_ISSUES.push(`❌ ${file}: motif de credential / mot de passe possible en console`);
    }
  }
}

if (!foundCredentials) {
  PASSED.push('✅ Aucun motif évident de credential en console (scripts scannés)');
}

// ============ CHECK 2: Validation MongoID ============
console.log('\n2️⃣  Vérification validation MongoID (routes)...');

const routeFiles = ['src/routes/messages.js', 'src/routes/admin.js'];

const mongoIdHints = [/validateMongoId/, /\.isMongoId\(\)/, /Types\.ObjectId\.isValid/];

for (const file of routeFiles) {
  const filePath = path.join(BACKEND_ROOT, file);
  if (!fs.existsSync(filePath)) {
    WARNINGS.push(`⚠️  ${file}: fichier absent`);
    continue;
  }
  const content = fs.readFileSync(filePath, 'utf8');
  const hasMongo = mongoIdHints.some((p) => p.test(content));
  if (!hasMongo) {
    WARNINGS.push(`⚠️  ${file}: pas de validation MongoID détectée (heuristique)`);
  } else {
    PASSED.push(`✅ ${file}: validation MongoID probable`);
  }
}

// ============ CHECK 3: Pagination limits ============
console.log('\n3️⃣  Vérification pagination / limites...');

const paginationHints = [
  /Math\.min\([^)]*100/,
  /Math\.max\(\s*1\s*,\s*Math\.min/,
  /validatePagination/,
  /req\.pagination/,
];

for (const file of routeFiles) {
  const filePath = path.join(BACKEND_ROOT, file);
  if (!fs.existsSync(filePath)) {continue;}
  const content = fs.readFileSync(filePath, 'utf8');
  const usesLimit = /req\.query\.limit|query\(['"]limit['"]\)/.test(content);
  const hasCap = paginationHints.some((p) => p.test(content));
  if (usesLimit && !hasCap) {
    WARNINGS.push(`⚠️  ${file}: req.query.limit sans plafond évident`);
  } else if (hasCap || !usesLimit) {
    PASSED.push(`✅ ${file}: pagination / limites cohérentes ou N/A`);
  }
}

// ============ CHECK 4: Email logging redaction ============
console.log('\n4️⃣  Vérification redaction email dans logs...');

const loggerPath = path.join(SRC_ROOT, 'lib', 'logger.js');
if (fs.existsSync(loggerPath)) {
  const content = fs.readFileSync(loggerPath, 'utf8');
  if (/logFailedLogin/.test(content) && /emailHash|hashEmailForLog/.test(content)) {
    PASSED.push('✅ logger.js: logFailedLogin utilise hachage / emailHash');
  } else if (/email:\s*email\b/.test(content) && !/emailHash/.test(content)) {
    WARNINGS.push('⚠️  logger.js: email possible en clair dans logFailedLogin');
  } else {
    PASSED.push('✅ logger.js: présent (vérifier manuellement logFailedLogin)');
  }
} else {
  WARNINGS.push('⚠️  src/lib/logger.js introuvable');
}

// ============ CHECK 5: Exécution code dynamique ============
console.log('\n5️⃣  Vérification exécution code dynamique (src + server.js)...');

const dangerousPatterns = [
  { re: /\beval\s*\(/, label: 'eval(' },
  { re: /\bnew\s+Function\s*\(/, label: 'new Function(' },
  { re: /\bFunction\s*\(\s*['"]return/, label: 'Function("return...")' },
  { re: /require\s*\(\s*['"]vm['"]\s*\)/, label: 'module vm' },
  { re: /\.runInNewContext\s*\(|\.runInThisContext\s*\(/, label: 'vm.runIn*' },
];

const skipDirs = new Set(['node_modules', 'coverage', 'dist', '.git']);

function walkJsFiles(dir, out) {
  if (!fs.existsSync(dir)) {return;}
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (skipDirs.has(e.name) || e.name === '__tests__') {continue;}
      walkJsFiles(full, out);
    } else if (e.isFile() && e.name.endsWith('.js') && !e.name.endsWith('.test.js')) {
      out.push(full);
    }
  }
}

const jsFiles = [];
walkJsFiles(SRC_ROOT, jsFiles);
const serverJs = path.join(BACKEND_ROOT, 'server.js');
if (fs.existsSync(serverJs)) {jsFiles.push(serverJs);}

let foundDangerous = false;
for (const filePath of jsFiles) {
  const content = fs.readFileSync(filePath, 'utf8');
  for (const { re, label } of dangerousPatterns) {
    if (re.test(content)) {
      CRITICAL_ISSUES.push(`❌ ${rel(filePath)}: code dynamique / ${label}`);
      foundDangerous = true;
    }
  }
}
if (!foundDangerous) {
  PASSED.push('✅ Aucun eval / new Function / vm.runIn* détecté dans le code applicatif');
}

// ============ CHECK 6: JWT_SECRET strength ============
console.log('\n6️⃣  Vérification JWT_SECRET (.env / config.env)...');

function readJwtSecretFromFile(filePath) {
  if (!fs.existsSync(filePath)) {return null;}
  const content = fs.readFileSync(filePath, 'utf8');
  const m = content.match(/^\s*JWT_SECRET\s*=\s*(.+)$/m);
  if (!m) {return null;}
  let v = m[1].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  return v;
}

const envPath = path.join(BACKEND_ROOT, '.env');
const configEnvPath = path.join(BACKEND_ROOT, 'config.env');

const jwtFromEnv = readJwtSecretFromFile(envPath);
const jwtFromConfig = readJwtSecretFromFile(configEnvPath);
const jwtSecret = jwtFromEnv || jwtFromConfig;
const jwtLen = jwtSecret ? jwtSecret.length : 0;

if (jwtLen >= 32) {
  PASSED.push(`✅ JWT_SECRET ≥ 32 caractères (${jwtLen}) — fichier local détecté`);
} else if (jwtLen > 0) {
  WARNINGS.push(`⚠️  JWT_SECRET < 32 caractères (${jwtLen}) — OWASP recommande ≥ 32`);
} else {
  WARNINGS.push('⚠️  JWT_SECRET absent ou vide dans .env / config.env (OK si injecté par l’hôte)');
}

// ============ CHECK 7: Middleware validation exports ============
console.log('\n7️⃣  Vérification exports validateurs...');

const validateInputPath = path.join(SRC_ROOT, 'middleware', 'validateInput.js');
const validationPath = path.join(SRC_ROOT, 'middleware', 'validation.js');

const validateInputExports = ['validateMongoId', 'sanitizeSearchString', 'handleValidationErrors', 'validatePagination'];

if (fs.existsSync(validateInputPath)) {
  const content = fs.readFileSync(validateInputPath, 'utf8');
  let all = true;
  for (const exp of validateInputExports) {
    if (!content.includes(exp)) {
      all = false;
      CRITICAL_ISSUES.push(`❌ validateInput.js: export ou symbole "${exp}" manquant`);
    }
  }
  if (all) {PASSED.push('✅ validateInput.js: exports attendus présents');}
} else {
  CRITICAL_ISSUES.push('❌ src/middleware/validateInput.js introuvable');
}

if (fs.existsSync(validationPath)) {
  const content = fs.readFileSync(validationPath, 'utf8');
  const need = ['handleValidationErrors', 'validatePagination', 'validateMongoId'];
  let ok = true;
  for (const exp of need) {
    if (!content.includes(exp)) {
      ok = false;
      WARNINGS.push(`⚠️  validation.js: "${exp}" non trouvé`);
    }
  }
  if (ok) {PASSED.push('✅ validation.js: symboles clés présents');}
}

// ============ CHECK 8: Tests de sécurité ============
console.log('\n8️⃣  Vérification tests de sécurité...');

const securityTests = [
  path.join(SRC_ROOT, '__tests__', 'security.test.js'),
  path.join(SRC_ROOT, '__tests__', 'security-validation.test.js'),
];

let hasSecurityTest = false;
for (const p of securityTests) {
  if (fs.existsSync(p)) {
    hasSecurityTest = true;
    PASSED.push(`✅ Tests sécurité: ${rel(p)}`);
    break;
  }
}
if (!hasSecurityTest) {
  WARNINGS.push('⚠️  Aucun fichier security.test.js / security-validation.test.js trouvé');
}

// ============ CHECK 9: npm audit (optionnel) ============
console.log('\n9️⃣  npm audit (dépendances)...');

function runNpmAuditJson() {
  try {
    return execSync('npm audit --json', {
      cwd: BACKEND_ROOT,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch (e) {
    // npm audit sort souvent en code 1 tout en écrivant le JSON sur stdout
    if (e.stdout && typeof e.stdout === 'string') {return e.stdout;}
    throw e;
  }
}

try {
  const out = runNpmAuditJson();
  const data = JSON.parse(out);
  const vulns = data.metadata?.vulnerabilities || {};
  const critical = vulns.critical || 0;
  const high = vulns.high || 0;
  if (critical > 0) {
    CRITICAL_ISSUES.push(`❌ npm audit: ${critical} vulnérabilité(s) critical`);
  } else if (high > 0) {
    WARNINGS.push(`⚠️  npm audit: ${high} vulnérabilité(s) high — examiner npm audit`);
  } else {
    PASSED.push('✅ npm audit: pas de critical/high (résumé metadata)');
  }
} catch (e) {
  WARNINGS.push(`⚠️  npm audit: impossible d'analyser (${e.message || e})`);
}

// ============ RESULTS ============
console.log('\n' + '='.repeat(60));
console.log('\n📊 RÉSULTATS:\n');

if (CRITICAL_ISSUES.length > 0) {
  console.log('🔴 PROBLÈMES CRITIQUES:');
  CRITICAL_ISSUES.forEach((issue) => console.log('  ' + issue));
  console.log('');
}

if (WARNINGS.length > 0) {
  console.log('🟡 AVERTISSEMENTS:');
  WARNINGS.forEach((warn) => console.log('  ' + warn));
  console.log('');
}

console.log('✅ VALIDATIONS RÉUSSIES:');
PASSED.forEach((pass) => console.log('  ' + pass));
console.log('');

// ============ SUMMARY ============
const totalChecks = CRITICAL_ISSUES.length + WARNINGS.length + PASSED.length;
const score = totalChecks === 0 ? 0 : Math.round((PASSED.length / totalChecks) * 100);

console.log('='.repeat(60));
console.log(`\n📈 Score (heuristique): ${score}%`);
console.log(`   Critiques: ${CRITICAL_ISSUES.length}`);
console.log(`   Avertissements: ${WARNINGS.length}`);
console.log(`   Réussis: ${PASSED.length}\n`);

if (CRITICAL_ISSUES.length > 0) {
  console.log('⚠️  Corrigez les problèmes critiques avant de merger.\n');
  process.exit(1);
}
if (score < 80) {
  console.log('⚠️  Score < 80 % — examiner les avertissements.\n');
  process.exit(0);
}
console.log('✅ Audit terminé sans critique bloquante.\n');
process.exit(0);
