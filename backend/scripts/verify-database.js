#!/usr/bin/env node
/**
 * Vérifie que l'application récupère les données depuis la base MongoDB.
 * Usage: node scripts/verify-database.js [BASE_URL]
 * Exemple: node scripts/verify-database.js http://localhost:3000
 */

const BASE = process.argv[2] || 'http://localhost:3000';
const http = require('http');
const https = require('https');
const { URL } = require('url');

const client = BASE.startsWith('https') ? https : http;

function get(urlStr) {
  const u = new URL(urlStr);
  const opts = { hostname: u.hostname, port: u.port || (u.protocol === 'https:' ? 443 : 80), path: u.pathname + u.search };
  return new Promise((resolve, reject) => {
    const req = client.get(opts, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, data: null });
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(6000, () => {
      req.destroy();
      reject(new Error('timeout'));
    });
  });
}

async function main() {
  console.log('🔍 Vérification de la récupération des données depuis la base\n');
  console.log('Backend:', BASE);
  console.log('');

  let health;
  try {
    const res = await get(`${BASE}/api/health`);
    health = res.data;
  } catch (e) {
    console.log('❌ Backend injoignable. Démarrez le serveur (npm run dev dans backend/, port 3000).');
    process.exit(1);
  }

  const mongoStatus = health.mongodb === 'connected' ? '✅ Connecté' : '❌ Déconnecté';
  console.log('1. Health check');
  console.log('   MongoDB:', mongoStatus);
  console.log('');

  const endpoints = [
    { name: 'Magazine (articles)', url: '/api/magazine', key: 'data' },
    { name: 'Radio (stations)', url: '/api/radio' },
    { name: 'Films / Séries', url: '/api/movies' },
    { name: 'Bannières', url: '/api/banners' },
    { name: 'Restaurants', url: '/api/restaurants' },
  ];

  for (const ep of endpoints) {
    try {
      const res = await get(`${BASE}${ep.url}`);
      const data = res.data;
      const list = ep.key ? data?.[ep.key] : data;
      const isArray = Array.isArray(list);
      const count = isArray ? list.length : 0;
      const fromDb = health.mongodb === 'connected' && isArray && list.length > 0
        ? 'base de données'
        : (isArray && list.length > 0 ? 'données (fallback ou cache)' : 'vide (MongoDB déconnecté ou collection vide)');
      console.log(`2. ${ep.name}`);
      console.log(`   Réponse: ${isArray ? count + ' élément(s)' : 'objet'}`);
      console.log(`   Source: ${fromDb}`);
      console.log('');
    } catch (e) {
      console.log(`2. ${ep.name}`);
      console.log('   Erreur:', e.message);
      console.log('');
    }
  }

  if (health.mongodb !== 'connected') {
    console.log('---');
    console.log('Pour que l\'application récupère les données depuis MongoDB :');
    console.log('  1. Démarrez MongoDB (voir backend/MONGODB.md)');
    console.log('  2. Redémarrez le backend si besoin');
    console.log('  3. Relancez: node scripts/verify-database.js', BASE);
  } else {
    console.log('---');
    console.log('MongoDB est connecté. Les données sont récupérées depuis la base.');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
