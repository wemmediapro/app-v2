#!/usr/bin/env node
/**
 * Seed des navires GNV dans MongoDB (collection ships).
 * Synchronisé avec la liste des 15 navires de src/data/ships.js (data/ships.json).
 * Usage: node scripts/seed-ships-gnv.js (depuis backend/)
 */
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', 'config.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Ship = require('../src/models/Ship');

const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/gnv_onboard';

// Charger la liste des 15 navires depuis data/ships.json (même source que src/data/ships.js)
const shipsJsonPath = path.join(__dirname, '..', '..', 'data', 'ships.json');
let rawShips = [];
try {
  const content = fs.readFileSync(shipsJsonPath, 'utf8');
  rawShips = JSON.parse(content);
} catch (err) {
  console.error('Impossible de lire data/ships.json:', err.message);
  process.exit(1);
}

if (!Array.isArray(rawShips) || rawShips.length === 0) {
  console.error('Aucun navire dans data/ships.json');
  process.exit(1);
}

/** Dérive un slug à partir du nom (ex: "GNV Excelsior" -> "excelsior") */
function nameToSlug(name) {
  if (!name || typeof name !== 'string') {return '';}
  return name
    .replace(/\bGNV\s+/i, '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

const SHIPS = rawShips.map((s) => {
  const name = s.name || `Ship ${s.id}`;
  const slug = nameToSlug(name) || `ship-${s.id}`;
  return {
    slug,
    name,
    type: 'Ferry',
    year: null,
    length: null,
    width: null,
    capacity: 2000,
    passengers: 2000,
    capacityVehicles: null,
    capacityCabins: null,
    speed: null,
    status: 'En service',
    route: s.route || null,
    facilities: ['Restaurants', 'Bar', 'Boutique', 'WiFi', 'Cabines'],
    routes: s.route ? [{ from: s.route.split(' - ')[0] || '', to: s.route.split(' - ')[1] || '', duration: '', frequency: '' }] : [],
    isActive: true,
  };
});

async function run() {
  console.log('Connexion MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('Upsert des navires GNV (source: data/ships.json)...');
  for (const s of SHIPS) {
    await Ship.findOneAndUpdate(
      { slug: s.slug },
      { $set: s },
      { upsert: true, new: true },
    );
    console.log('  ', s.name);
  }
  const count = await Ship.countDocuments({});
  console.log('Terminé. Total navires en base:', count);
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
