#!/usr/bin/env node
/**
 * Liste les bases de données MongoDB et leur poids (taille sur disque).
 * Usage (depuis backend/) : node scripts/list-databases.js
 * Charge .env depuis backend/ si présent.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');

const uri = process.env.DATABASE_URL || process.env.MONGODB_URI || 'mongodb://localhost:27017/gnv_onboard?directConnection=true';

function formatBytes(bytes) {
  if (bytes === 0) {return '0 o';}
  const k = 1024;
  const sizes = ['o', 'Ko', 'Mo', 'Go', 'To'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

async function run() {
  try {
    await mongoose.connect(uri);
    const admin = mongoose.connection.db.admin();
    const { databases: list, totalSize } = await admin.listDatabases();

    const rows = (list || [])
      .map((db) => ({ name: db.name, sizeOnDisk: db.sizeOnDisk || 0 }))
      .sort((a, b) => b.sizeOnDisk - a.sizeOnDisk);

    console.log('\n📦 Bases de données MongoDB et leur poids\n');
    console.log('Base de données          | Taille');
    console.log('-------------------------|------------------');

    for (const db of rows) {
      const name = db.name.padEnd(24);
      const size = formatBytes(db.sizeOnDisk).padStart(12);
      console.log(`${name} | ${size}`);
    }

    console.log('-------------------------|------------------');
    console.log(`Total                    | ${formatBytes(totalSize || 0)}`);
    console.log('');
  } catch (err) {
    console.error('Erreur:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

run();
