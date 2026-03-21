#!/usr/bin/env node
/**
 * Vérifie que le backend répond et que les routes API (et la base si connectée) fonctionnent.
 * Usage: node scripts/verify-backend.cjs [baseUrl]
 * Exemple: node scripts/verify-backend.cjs http://localhost:3000
 */

const http = require('http');
const https = require('https');

const BASE = process.argv[2] || 'http://localhost:3000';

function request(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    lib.get(url, { timeout: 5000 }, (res) => {
      let data = '';
      res.on('data', (ch) => (data += ch));
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  console.log('Vérification du backend:', BASE);
  console.log('');

  const results = [];

  // 1. Health (legacy status OK ou rapport détaillé healthOverall / mongodb)
  try {
    const r = await request(`${BASE}/api/health`);
    const d = r.data;
    const mongoOk = d && d.mongodb === 'connected';
    const legacyOk = d && d.status === 'OK';
    const overallOk =
      d && d.healthOverall && d.healthOverall !== 'unhealthy';
    const ok =
      r.status === 200 && d && (legacyOk || mongoOk || overallOk);
    const detail = ok
      ? d.healthOverall
        ? `${d.healthOverall}${mongoOk ? ', mongo OK' : ''}`
        : 'OK'
      : d?.message || JSON.stringify(d || {}).slice(0, 120);
    results.push({ name: 'GET /api/health', ok, status: r.status, detail });
  } catch (e) {
    results.push({ name: 'GET /api/health', ok: false, detail: e.message || 'Connexion refusée' });
  }

  // 2. Movies (DB ou démo) — tableau racine ou { data: [...] }
  try {
    const r = await request(`${BASE}/api/movies`);
    const arr = Array.isArray(r.data) ? r.data : r.data?.data;
    const ok = r.status === 200 && Array.isArray(arr);
    results.push({ name: 'GET /api/movies', ok, status: r.status, count: Array.isArray(arr) ? arr.length : 0 });
  } catch (e) {
    results.push({ name: 'GET /api/movies', ok: false, detail: e.message });
  }

  // 3. Radio (DB ou démo)
  try {
    const r = await request(`${BASE}/api/radio`);
    const ok = r.status === 200 && Array.isArray(r.data);
    results.push({ name: 'GET /api/radio', ok, status: r.status, count: Array.isArray(r.data) ? r.data.length : 0 });
  } catch (e) {
    results.push({ name: 'GET /api/radio', ok: false, detail: e.message });
  }

  // 4. Magazine (DB ou démo)
  try {
    const r = await request(`${BASE}/api/magazine`);
    const ok = r.status === 200 && (r.data?.data || Array.isArray(r.data));
    const arr = r.data?.data || r.data;
    results.push({ name: 'GET /api/magazine', ok, status: r.status, count: Array.isArray(arr) ? arr.length : 0 });
  } catch (e) {
    results.push({ name: 'GET /api/magazine', ok: false, detail: e.message });
  }

  // 5. Shop (DB ou démo)
  try {
    const r = await request(`${BASE}/api/shop`);
    const ok = r.status === 200 && Array.isArray(r.data);
    results.push({ name: 'GET /api/shop', ok, status: r.status, count: Array.isArray(r.data) ? r.data.length : 0 });
  } catch (e) {
    results.push({ name: 'GET /api/shop', ok: false, detail: e.message });
  }

  // 6. Restaurants (DB ou démo)
  try {
    const r = await request(`${BASE}/api/restaurants`);
    const ok = r.status === 200 && Array.isArray(r.data);
    results.push({ name: 'GET /api/restaurants', ok, status: r.status, count: Array.isArray(r.data) ? r.data.length : 0 });
  } catch (e) {
    results.push({ name: 'GET /api/restaurants', ok: false, detail: e.message });
  }

  // Affichage
  let allOk = true;
  for (const t of results) {
    const icon = t.ok ? '✅' : '❌';
    const extra = t.count !== undefined ? ` (${t.count} éléments)` : (t.detail ? ` — ${t.detail}` : '');
    console.log(`${icon} ${t.name}${t.status ? ' ' + t.status : ''}${extra}`);
    if (!t.ok) allOk = false;
  }

  console.log('');
  if (allOk) {
    console.log('Toutes les vérifications sont passées. Front et Dashboard peuvent utiliser le backend.');
  } else {
    console.log('Certaines vérifications ont échoué. Vérifiez que le backend tourne (npm run dev ou node server.js dans backend/) et que MongoDB est démarré si vous utilisez la base.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
