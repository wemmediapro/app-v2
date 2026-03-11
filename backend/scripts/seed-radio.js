/**
 * Seed : stations radio + playlist de démo (id pour localStorage).
 * Usage: depuis backend/ : node scripts/seed-radio.js
 *
 * Après le seed, dans le dashboard : ouvrir la page Radio puis cliquer
 * "Créer playlist de démo" pour créer la playlist locale utilisée par
 * la station "GNV Radio Playlist".
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', 'config.env') });
const mongoose = require('mongoose');
const RadioStation = require('../src/models/RadioStation');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gnv_onboard';

const stations = [
  {
    name: 'GNV Radio Flux',
    description: 'Station en flux externe (streaming URL).',
    genre: 'Variété',
    streamUrl: 'https://icecast.omroep.nl/radio1-bb-mp3',
    logo: '',
    isActive: true,
    playlistId: ''
  },
  {
    name: 'GNV Radio Playlist',
    description: 'Diffusion 100% offline à partir de votre playlist locale.',
    genre: 'Playlist',
    streamUrl: '',
    logo: '',
    isActive: true,
    playlistId: 'playlist_demo'
  }
];

async function seedRadio() {
  try {
    await mongoose.connect(MONGODB_URI);
    const existing = await RadioStation.countDocuments({});
    if (existing > 0) {
      console.log('ℹ️  Des stations existent déjà (' + existing + '). Pour repartir de zéro : node scripts/clear-radio.js');
    }
    for (const s of stations) {
      const found = await RadioStation.findOne({ name: s.name });
      if (found) {
        console.log('⏭️  Station déjà présente:', s.name);
        continue;
      }
      await RadioStation.create(s);
      console.log('✅ Station créée:', s.name);
    }
    const total = await RadioStation.countDocuments({});
    console.log('\n✅ Seed radio terminé. Total stations:', total);
    console.log('   Dans le dashboard (http://localhost:5174/radio), cliquez "Créer playlist de démo" pour lier la playlist locale à GNV Radio Playlist.');
  } catch (err) {
    console.error('❌ Erreur:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

seedRadio();
