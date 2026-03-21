/**
 * Seed : Radio Med et Mosaïque avec descriptions multilingues et logos.
 * Usage: depuis backend/ : node scripts/seed-radio-med-mosaique.js
 *
 * Logos : placez les fichiers dans backend/scripts/assets/
 *   - radio-med-logo.png (ou .jpg) pour Radio Med
 *   - mosaique-logo.png (ou .jpg) pour Mosaïque
 * Ils seront copiés vers public/uploads/images/ et liés aux stations.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', 'config.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const RadioStation = require('../src/models/RadioStation');

const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/gnv_onboard';

const ASSETS_DIR = path.join(__dirname, 'assets');
const ROOT = path.join(__dirname, '..', '..');
const IMAGES_DIR = path.join(ROOT, 'public', 'uploads', 'images');

// Description "Une vague de bonheur" en plusieurs langues
const RADIO_MED_DESCRIPTION = {
  fr: 'Une vague de bonheur',
  en: 'A wave of happiness',
  it: "Un'onda di felicità",
  es: 'Una ola de felicidad',
  ar: 'موجة من السعادة',
  de: 'Eine Welle des Glücks',
};

// Description pour Mosaïque (thème variété / mosaïque culturelle)
const MOSAIQUE_DESCRIPTION = {
  fr: 'La mosaïque des sons et des cultures',
  en: 'A mosaic of sounds and cultures',
  it: 'Il mosaico di suoni e culture',
  es: 'Un mosaico de sonidos y culturas',
  ar: 'فسيفساء الأصوات والثقافات',
  de: 'Ein Mosaik aus Klängen und Kulturen',
};

/**
 * Copie un logo depuis scripts/assets/ vers public/uploads/images/
 * Retourne le chemin relatif (/uploads/images/xxx) ou '' si fichier absent.
 */
function copyLogoIfExists(baseName) {
  const exts = ['.png', '.jpg', '.jpeg', '.webp'];
  for (const ext of exts) {
    const src = path.join(ASSETS_DIR, `${baseName}${ext}`);
    if (fs.existsSync(src)) {
      if (!fs.existsSync(IMAGES_DIR)) {
        fs.mkdirSync(IMAGES_DIR, { recursive: true });
      }
      const filename = `${baseName}-${Date.now()}${ext}`;
      const dest = path.join(IMAGES_DIR, filename);
      fs.copyFileSync(src, dest);
      return `/uploads/images/${filename}`;
    }
  }
  return '';
}

const stations = [
  {
    name: 'Radio Med',
    description: RADIO_MED_DESCRIPTION.fr,
    translations: {
      fr: { name: 'Radio Med', description: RADIO_MED_DESCRIPTION.fr },
      en: { name: 'Radio Med', description: RADIO_MED_DESCRIPTION.en },
      it: { name: 'Radio Med', description: RADIO_MED_DESCRIPTION.it },
      es: { name: 'Radio Med', description: RADIO_MED_DESCRIPTION.es },
      ar: { name: 'راديو ميد', description: RADIO_MED_DESCRIPTION.ar },
      de: { name: 'Radio Med', description: RADIO_MED_DESCRIPTION.de },
    },
    genre: 'Variété',
    streamUrl: '',
    logo: '', // rempli après copie
    isActive: true,
    playlistId: '',
  },
  {
    name: 'Mosaïque',
    description: MOSAIQUE_DESCRIPTION.fr,
    translations: {
      fr: { name: 'Mosaïque', description: MOSAIQUE_DESCRIPTION.fr },
      en: { name: 'Mosaic', description: MOSAIQUE_DESCRIPTION.en },
      it: { name: 'Mosaico', description: MOSAIQUE_DESCRIPTION.it },
      es: { name: 'Mosaico', description: MOSAIQUE_DESCRIPTION.es },
      ar: { name: 'فسيفساء', description: MOSAIQUE_DESCRIPTION.ar },
      de: { name: 'Mosaik', description: MOSAIQUE_DESCRIPTION.de },
    },
    genre: 'Variété',
    streamUrl: '',
    logo: '',
    isActive: true,
    playlistId: '',
  },
];

async function seedRadioMedMosaique() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connecté à MongoDB');

    // Copier les logos si présents
    const radioMedLogo = copyLogoIfExists('radio-med-logo');
    const mosaiqueLogo = copyLogoIfExists('mosaique-logo');

    stations[0].logo = radioMedLogo;
    stations[1].logo = mosaiqueLogo;

    if (radioMedLogo) {
      console.log('   Logo Radio Med copié:', radioMedLogo);
    } else {
      console.log('   ⚠️  Aucun logo Radio Med dans scripts/assets/ (radio-med-logo.png ou .jpg)');
    }
    if (mosaiqueLogo) {
      console.log('   Logo Mosaïque copié:', mosaiqueLogo);
    } else {
      console.log('   ⚠️  Aucun logo Mosaïque dans scripts/assets/ (mosaique-logo.png ou .jpg)');
    }

    for (const s of stations) {
      const found = await RadioStation.findOne({ name: s.name });
      if (found) {
        await RadioStation.findByIdAndUpdate(found._id, {
          $set: {
            description: s.description,
            translations: s.translations,
            genre: s.genre,
            logo: s.logo || found.logo,
            isActive: s.isActive,
          },
        });
        console.log('✅ Station mise à jour:', s.name);
      } else {
        await RadioStation.create(s);
        console.log('✅ Station créée:', s.name);
      }
    }

    const total = await RadioStation.countDocuments({});
    console.log('\n✅ Seed terminé. Total stations:', total);
    console.log('   Radio Med : description "Une vague de bonheur" en fr, en, it, es, ar, de.');
    console.log('   Mosaïque : description multilingue ajoutée.');
  } catch (err) {
    console.error('❌ Erreur:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

seedRadioMedMosaique();
