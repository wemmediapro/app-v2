#!/usr/bin/env node
/**
 * Vide le cache serveur : Redis.
 * Usage: node scripts/clear-cache.js (depuis le dossier backend)
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'config.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const cacheManager = require('../src/lib/cache-manager');

async function clearCache() {
  console.log('Vidage du cache...');
  const redisCleared = await cacheManager.connect().then(() => cacheManager.flush());
  if (redisCleared) {
    console.log('Redis: base courante vidée.');
  } else {
    console.log('Redis: non connecté ou déjà vide (aucune action).');
  }
  await cacheManager.disconnect();
  console.log('Cache vidé.');
  process.exit(0);
}

clearCache().catch((err) => {
  console.error('Erreur:', err.message);
  process.exit(1);
});
