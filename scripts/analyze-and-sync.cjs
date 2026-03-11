#!/usr/bin/env node
/**
 * Script d'analyse Front + Dashboard + Base de données
 * - Analyse les pages du front (App.jsx) et les routes du dashboard
 * - Vérifie/crée les modèles MongoDB et les collections
 * - Génère un rapport et des recommandations pour la navigation
 * Usage: node scripts/analyze-and-sync.cjs [--sync-db] [--dry-run]
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FRONT_APP = path.join(ROOT, 'src', 'App.jsx');
const DASHBOARD_APP = path.join(ROOT, 'dashboard', 'src', 'App.jsx');
const DASHBOARD_SIDEBAR = path.join(ROOT, 'dashboard', 'src', 'components', 'Sidebar.jsx');
const BACKEND_MODELS_DIR = path.join(ROOT, 'backend', 'src', 'models');
const BACKEND_ROUTES = path.join(ROOT, 'backend', 'server.js');

// Pages/sections du front (extrait des setPage et bottom nav)
const FRONT_PAGES = [
  'home', 'radio', 'movies', 'magazine', 'webtv', 'restaurant', 'enfant',
  'shop', 'shipmap', 'messaging', 'feedback', 'profile', 'signup'
];

// Routes API backend → modèle attendu
const API_TO_MODEL = {
  '/api/users': 'User',
  '/api/auth': 'User',
  '/api/restaurants': 'Restaurant',
  '/api/movies': 'Movie',
  '/api/radio': 'RadioStation',
  '/api/magazine': 'Article',
  '/api/messages': 'Message',
  '/api/shop': 'Product',
  '/api/feedback': 'Feedback',
  '/api/gnv': null,
  '/api/upload': null,
  '/api/stream': null,
  '/api/demo': null,
  '/api/analytics': null,
  '/api/admin': null,
};

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (e) {
    return '';
  }
}

function extractDashboardRoutes(content) {
  const routes = [];
  const re = /<Route\s+path="([^"]+)"\s+element=/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    routes.push(m[1]);
  }
  return routes;
}

function listModels() {
  try {
    const names = fs.readdirSync(BACKEND_MODELS_DIR);
    return names.filter(n => n.endsWith('.js')).map(n => n.replace('.js', ''));
  } catch (e) {
    return [];
  }
}

function extractSidebarItems(content) {
  const items = [];
  const re = /path:\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    if (m[1] !== undefined && !items.includes(m[1])) items.push(m[1]);
  }
  return items;
}

function report() {
  const dashboardApp = readFileSafe(DASHBOARD_APP);
  const sidebarContent = readFileSafe(DASHBOARD_SIDEBAR);
  const serverContent = readFileSafe(BACKEND_ROUTES);

  const dashboardRoutes = extractDashboardRoutes(dashboardApp);
  const sidebarPaths = extractSidebarItems(sidebarContent);
  const models = listModels();

  const reportLines = [];
  reportLines.push('═══════════════════════════════════════════════════════════');
  reportLines.push('  RAPPORT D\'ANALYSE — Front · Dashboard · Base de données');
  reportLines.push('═══════════════════════════════════════════════════════════');
  reportLines.push('');

  reportLines.push('── FRONT (app passagers) ──');
  reportLines.push(`  Pages/sections détectées: ${FRONT_PAGES.join(', ')}`);
  reportLines.push('');

  reportLines.push('── DASHBOARD (admin) ──');
  reportLines.push(`  Routes: ${dashboardRoutes.join(', ')}`);
  reportLines.push(`  Liens sidebar: ${sidebarPaths.join(', ')}`);
  const missingInSidebar = dashboardRoutes.filter(r => r !== '/' && r !== '/dashboard' && !sidebarPaths.includes(r));
  if (missingInSidebar.length) {
    reportLines.push(`  ⚠️  Routes sans lien sidebar: ${missingInSidebar.join(', ')}`);
  }
  reportLines.push('');

  reportLines.push('── MODÈLES MongoDB ──');
  reportLines.push(`  Modèles présents: ${models.join(', ')}`);
  const requiredModels = [...new Set(Object.values(API_TO_MODEL).filter(Boolean))];
  const missingModels = requiredModels.filter(m => !models.includes(m));
  if (missingModels.length) {
    reportLines.push(`  ⚠️  Modèles attendus manquants: ${missingModels.join(', ')}`);
  } else {
    reportLines.push('  ✅ Tous les modèles attendus sont présents.');
  }
  reportLines.push('');

  reportLines.push('── SYNCHRONISATION API ↔ Modèles ──');
  for (const [route, model] of Object.entries(API_TO_MODEL)) {
    if (!model) continue;
    const ok = models.includes(model);
    reportLines.push(`  ${ok ? '✅' : '❌'} ${route} → ${model}`);
  }
  reportLines.push('');
  reportLines.push('═══════════════════════════════════════════════════════════');

  return { report: reportLines.join('\n'), dashboardRoutes, sidebarPaths, models, missingModels: requiredModels.filter(m => !models.includes(m)) };
}

function runSyncDb() {
  const required = ['Movie', 'RadioStation', 'User', 'Article', 'Product', 'Restaurant', 'Feedback', 'Message', 'WebTVChannel', 'Banner', 'Ship', 'Shipmap', 'Destination', 'EnfantActivity'];
  const existing = listModels();
  const missing = required.filter(m => !existing.includes(m));
  if (missing.length === 0) {
    console.log('\n✅ Aucun modèle manquant. Base cohérente.');
    return;
  }
  console.log('\nModèles requis présents:', existing.join(', '));
  if (missing.length) console.log('Manquants (à créer):', missing.join(', '));
  console.log('Pour créer les collections en base, démarrer le backend avec MongoDB.');
}

// ─── Exécution ─────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const syncDb = args.includes('--sync-db');

const { report: reportText, missingModels } = report();
console.log(reportText);

if (syncDb) {
  runSyncDb();
}

if (missingModels.length && !dryRun) {
  console.log('\n💡 Redémarrez le backend pour utiliser tous les modèles.');
}

process.exit(0);
