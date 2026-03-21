/**
 * Met à jour la chaîne "GNV WebTV À bord" avec le nom et la description
 * traduits en français, anglais, espagnol, italien, allemand et arabe.
 *
 * Usage: depuis backend/ : node scripts/update-webtv-gnv-abord-translations.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', 'config.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/gnv_onboard';

// Modèle WebTV (chemin selon structure du projet)
let WebTVChannel;
try {
  WebTVChannel = require('../src/models/WebTVChannel');
} catch (e) {
  WebTVChannel = require('../models/WebTV');
}

const TRANSLATIONS = {
  fr: {
    name: 'GNV WebTV À bord',
    description: 'Infos lignes, offres, services à bord, coulisses et conseils voyage pour préparer votre traversée.',
  },
  en: {
    name: 'GNV WebTV On Board',
    description: 'Line news, onboard offers and services, behind the scenes and travel tips to prepare for your crossing.',
  },
  es: {
    name: 'GNV WebTV A bordo',
    description: 'Información de líneas, ofertas, servicios a bordo, detrás de cámaras y consejos de viaje para preparar su travesía.',
  },
  it: {
    name: 'GNV WebTV A bordo',
    description: 'Info linee, offerte, servizi a bordo, retroscena e consigli di viaggio per preparare la vostra traversata.',
  },
  de: {
    name: 'GNV WebTV An Bord',
    description: 'Infos zu Linien, Angeboten und Service an Bord, Hinter den Kulissen und Reisetipps für Ihre Überfahrt.',
  },
  ar: {
    name: 'GNV WebTV على متن السفينة',
    description: 'معلومات الخطوط والعروض والخدمات على متن السفينة وكواليس ونصائح السفر للاستعداد لعبوركم.',
  },
};

async function updateChannel() {
  try {
    console.log('🔌 Connexion MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connecté:', mongoose.connection.name);

    const channel = await WebTVChannel.findOne({
      $or: [
        { name: /GNV WebTV À bord/i },
        { name: /GNV WebTV.*bord/i },
        { 'translations.fr.name': /GNV WebTV À bord/i },
      ],
    });

    if (!channel) {
      console.log('⚠️  Aucune chaîne "GNV WebTV À bord" trouvée.');
      const all = await WebTVChannel.find({}).select('name _id').lean();
      if (all.length) {
        console.log('   Chaînes existantes:', all.map(c => c.name).join(', '));
        console.log('   Pour appliquer les traductions à une autre chaîne, modifiez le filtre dans ce script.');
      }
      await mongoose.disconnect();
      process.exit(0);
      return;
    }

    channel.name = TRANSLATIONS.fr.name;
    channel.description = TRANSLATIONS.fr.description;
    channel.translations = TRANSLATIONS;
    await channel.save();

    console.log('✅ Chaîne mise à jour:', channel.name);
    console.log('   Traductions: fr, en, es, it, de, ar');
    console.log('   FR:', TRANSLATIONS.fr.description.slice(0, 60) + '…');
    console.log('   EN:', TRANSLATIONS.en.description.slice(0, 60) + '…');
  } catch (err) {
    console.error('❌ Erreur:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

updateChannel();
