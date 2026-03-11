#!/usr/bin/env node
/**
 * Seed des navires GNV dans MongoDB (collection ships).
 * Usage: node scripts/seed-ships-gnv.js (depuis backend/)
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'config.env') });
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');
const Ship = require('../src/models/Ship');

const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/gnv_onboard';

const SHIPS = [
  {
    slug: 'excelsior',
    name: 'GNV Excelsior',
    type: 'Ferry',
    year: 2015,
    length: '202m',
    width: '28m',
    capacity: 2253,
    passengers: 2253,
    capacityVehicles: 600,
    capacityCabins: 200,
    speed: '24 knots',
    status: 'En service',
    facilities: ['Restaurants', 'Bar', 'Boutique', 'WiFi', 'Cabines', 'Espace enfants'],
    routes: [{ from: 'Sète', to: 'Nador', duration: '24h', frequency: 'Quotidien' }],
    isActive: true
  },
  {
    slug: 'atlas',
    name: 'GNV Atlas',
    type: 'Ferry',
    year: 2013,
    length: '186m',
    width: '26m',
    capacity: 2000,
    passengers: 2000,
    capacityVehicles: 550,
    capacityCabins: 180,
    speed: '23 knots',
    status: 'En service',
    facilities: ['Restaurants', 'Bar', 'Boutique', 'WiFi', 'Cabines'],
    routes: [{ from: 'Sète', to: 'Nador', duration: '24h', frequency: 'Quotidien' }],
    isActive: true
  },
  {
    slug: 'cristal',
    name: 'GNV Cristal',
    type: 'Ferry',
    year: 2017,
    length: '195m',
    width: '27m',
    capacity: 2100,
    passengers: 2100,
    capacityVehicles: 580,
    capacityCabins: 190,
    speed: '24 knots',
    status: 'En service',
    facilities: ['Restaurants', 'Bar', 'Boutique', 'WiFi', 'Cabines', 'Espace enfants', 'Salle de prière'],
    routes: [{ from: 'Gênes', to: 'Tunis', duration: '20h', frequency: 'Quotidien' }],
    isActive: true
  },
  {
    slug: 'splendid',
    name: 'GNV Splendid',
    type: 'Ferry',
    year: 2014,
    length: '188m',
    width: '26m',
    capacity: 1950,
    passengers: 1950,
    capacityVehicles: 520,
    capacityCabins: 170,
    speed: '22 knots',
    status: 'En service',
    facilities: ['Restaurants', 'Bar', 'Boutique', 'WiFi', 'Cabines'],
    routes: [{ from: 'Civitavecchia', to: 'Barcelone', duration: '18h', frequency: 'Quotidien' }],
    isActive: true
  }
];

async function run() {
  console.log('Connexion MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('Upsert des navires GNV...');
  for (const s of SHIPS) {
    await Ship.findOneAndUpdate(
      { slug: s.slug },
      { $set: s },
      { upsert: true, new: true }
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
