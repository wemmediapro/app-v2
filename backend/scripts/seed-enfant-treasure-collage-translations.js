/**
 * Ajoute les traductions (toutes langues) pour les activités :
 * - Chasse au trésor
 * - Atelier créatif : Collage marin
 *
 * Usage: depuis backend/ : node scripts/seed-enfant-treasure-collage-translations.js
 * Prérequis: MongoDB accessible (MONGODB_URI ou DATABASE_URL).
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', 'config.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const EnfantActivity = require('../src/models/EnfantActivity');

const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/gnv_onboard';

const ACTIVITIES_TRANSLATIONS = [
  {
    nameFr: 'Chasse au trésor',
    category: 'Jeux',
    translations: {
      fr: {
        name: 'Chasse au trésor',
        description: 'Partez à l\'aventure sur le bateau pour retrouver des indices et découvrir le trésor caché. Une activité ludique qui fait travailler l\'observation et l\'esprit d\'équipe.',
        ageRange: '6-12 ans',
        schedule: 'Tous les jours 10h-12h et 14h-16h',
        features: ['Parcours sur le pont', 'Indices à trouver', 'Animation encadrée', 'Récompense à la clé']
      },
      en: {
        name: 'Treasure Hunt',
        description: 'Set off on an adventure across the ship to find clues and discover the hidden treasure. A fun activity that develops observation skills and teamwork.',
        ageRange: '6-12 years',
        schedule: 'Every day 10am-12pm and 2pm-4pm',
        features: ['Deck trail', 'Clues to find', 'Supervised activity', 'Prize at the end']
      },
      es: {
        name: 'Búsqueda del tesoro',
        description: 'Salid de aventura por el barco para encontrar pistas y descubrir el tesoro escondido. Una actividad lúdica que trabaja la observación y el trabajo en equipo.',
        ageRange: '6-12 años',
        schedule: 'Todos los días 10h-12h y 14h-16h',
        features: ['Recorrido por cubierta', 'Pistas por encontrar', 'Actividad supervisada', 'Premio al final']
      },
      it: {
        name: 'Caccia al tesoro',
        description: 'Partite per un\'avventura sul traghetto per trovare indizi e scoprire il tesoro nascosto. Un\'attività ludica che sviluppa l\'osservazione e lo spirito di squadra.',
        ageRange: '6-12 anni',
        schedule: 'Ogni giorno 10-12 e 14-16',
        features: ['Percorso sul ponte', 'Indizi da trovare', 'Attività supervisionata', 'Premio finale']
      },
      de: {
        name: 'Schatzsuche',
        description: 'Begebt euch auf Abenteuerreise über das Schiff, um Hinweise zu finden und den versteckten Schatz zu entdecken. Ein spielerisches Angebot für Beobachtungsgabe und Teamgeist.',
        ageRange: '6-12 Jahre',
        schedule: 'Täglich 10-12 Uhr und 14-16 Uhr',
        features: ['Rundgang an Deck', 'Hinweise zu finden', 'Betreute Aktivität', 'Preis am Ende']
      },
      ar: {
        name: 'البحث عن الكنز',
        description: 'انطلق في مغامرة على متن السفينة للعثور على الأدلة واكتشاف الكنز المخفي. نشاط ترفيهي ينمي الملاحظة والعمل الجماعي.',
        ageRange: '6-12 سنة',
        schedule: 'كل يوم 10-12 و14-16',
        features: ['مسار على السطح', 'أدلة للعثور عليها', 'نشاط بإشراف', 'جائزة في النهاية']
      }
    }
  },
  {
    nameFr: 'Atelier créatif : Collage marin',
    category: 'Créatif',
    translations: {
      fr: {
        name: 'Atelier créatif : Collage marin',
        description: 'Créez une œuvre à partir de coquillages, sable et papiers colorés sur le thème de la mer. Idéal pour développer la créativité et la motricité fine.',
        ageRange: '4-10 ans',
        schedule: 'Mercredi et samedi 14h-15h30',
        features: ['Matériel fourni', 'Thème mer et plage', 'Encadrement animatrice', 'Emportez votre création']
      },
      en: {
        name: 'Creative Workshop: Marine Collage',
        description: 'Create a piece of art using shells, sand and coloured paper on a sea theme. Ideal for developing creativity and fine motor skills.',
        ageRange: '4-10 years',
        schedule: 'Wednesday and Saturday 2pm-3:30pm',
        features: ['Materials provided', 'Sea and beach theme', 'Supervised by host', 'Take your creation home']
      },
      es: {
        name: 'Taller creativo: Collage marino',
        description: 'Crea una obra con conchas, arena y papeles de colores con tema marino. Ideal para desarrollar la creatividad y la motricidad fina.',
        ageRange: '4-10 años',
        schedule: 'Miércoles y sábado 14h-15h30',
        features: ['Material incluido', 'Tema mar y playa', 'Supervisado por monitor', 'Llévate tu creación']
      },
      it: {
        name: 'Laboratorio creativo: Collage marino',
        description: 'Create un\'opera con conchiglie, sabbia e carte colorate a tema mare. Ideale per sviluppare creatività e motricità fine.',
        ageRange: '4-10 anni',
        schedule: 'Mercoledì e sabato 14-15:30',
        features: ['Materiale fornito', 'Tema mare e spiaggia', 'Attività supervisionata', 'Porta a casa la tua creazione']
      },
      de: {
        name: 'Kreativ-Workshop: Meeres-Collage',
        description: 'Gestaltet ein Kunstwerk aus Muscheln, Sand und buntem Papier zum Thema Meer. Ideal zur Förderung von Kreativität und Feinmotorik.',
        ageRange: '4-10 Jahre',
        schedule: 'Mittwoch und Samstag 14-15:30 Uhr',
        features: ['Material gestellt', 'Thema Meer und Strand', 'Betreut durch Animateur', 'Nehmt euer Werk mit']
      },
      ar: {
        name: 'ورشة إبداعية: كولاج بحري',
        description: 'اصنع عملاً فنياً من الأصداف والرمل والأوراق الملونة حول موضوع البحر. مثالي لتنمية الإبداع والمهارات الحركية الدقيقة.',
        ageRange: '4-10 سنوات',
        schedule: 'الأربعاء والسبت 14-15:30',
        features: ['المواد متوفرة', 'موضوع البحر والشاطئ', 'إشراف منشطة', 'خذ إبداعك معك']
      }
    }
  }
];

async function run() {
  try {
    console.log('🔌 Connexion MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connecté:', mongoose.connection.name);

    for (const { nameFr, category, translations } of ACTIVITIES_TRANSLATIONS) {
      const activity = await EnfantActivity.findOne({ name: nameFr }).lean();
      if (!activity) {
        console.log(`\n⚠️  Activité non trouvée en base : "${nameFr}". Création avec contenu FR par défaut...`);
        const defaultFr = translations.fr;
        const newDoc = {
          name: nameFr,
          category,
          description: defaultFr.description,
          ageRange: defaultFr.ageRange,
          duration: '60 min',
          location: 'Pont 5 - Zone Familles',
          capacity: '15',
          price: 0,
          schedule: defaultFr.schedule,
          features: defaultFr.features || [],
          isActive: true,
          isFeatured: false,
          countries: ['MA', 'IT', 'ES', 'TN', 'FR'],
          translations
        };
        await EnfantActivity.create(newDoc);
        console.log(`✅ Activité créée avec traductions (fr, en, es, it, de, ar) : ${nameFr}`);
      } else {
        await EnfantActivity.updateOne(
          { _id: activity._id },
          { $set: { translations } }
        );
        console.log(`✅ Traductions mises à jour (fr, en, es, it, de, ar) : ${nameFr}`);
      }
    }

    console.log('\n✅ Seed traductions Chasse au trésor / Collage marin terminé.');
  } catch (err) {
    console.error('❌ Erreur:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();
