/**
 * Seed WebTV : une chaîne généraliste avec programmation générée par OpenAI
 * (un programme toutes les 3 h sur 24 h = 8 créneaux).
 * Usage: depuis backend/ : node scripts/seed-webtv-openai-generaliste.js
 *
 * Prérequis: OPENAI_API_KEY dans backend/.env et MongoDB accessible.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', 'config.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const OpenAI = require('openai').default;
const WebTVChannel = require('../src/models/WebTVChannel');

const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/gnv_onboard';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Créneaux de 3 h (00h-03h, 03h-06h, … 21h-00h) = 8 programmes
const SLOTS_3H = [
  { startTime: '00:00', endTime: '03:00' },
  { startTime: '03:00', endTime: '06:00' },
  { startTime: '06:00', endTime: '09:00' },
  { startTime: '09:00', endTime: '12:00' },
  { startTime: '12:00', endTime: '15:00' },
  { startTime: '15:00', endTime: '18:00' },
  { startTime: '18:00', endTime: '21:00' },
  { startTime: '21:00', endTime: '00:00' },
];

async function generateChannelWithOpenAI() {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY manquant. Ajoutez-le dans backend/.env');
  }
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

  const systemPrompt = `Tu es programmateur pour une chaîne TV généraliste à bord d'un ferry GNV (traversées Méditerranée).
Tu dois renvoyer UNIQUEMENT un objet JSON valide, sans texte avant ou après, avec les champs :
- name (string) : nom accrocheur de la chaîne généraliste (ex: "GNV TV", "Bord'O Média", "Canal Traversée")
- description (string) : courte description de la chaîne (2-3 phrases, style programme TV)
- programs (array) : exactement 8 éléments. Chaque élément a :
  - title (string) : titre du programme pour ce créneau (ex: "Matinale", "Info & Météo", "Films", "Divertissement")
  - description (string, optionnel) : une phrase décrivant le programme

Les 8 créneaux sont (par ordre) : 00h-03h, 03h-06h, 06h-09h, 09h-12h, 12h-15h, 15h-18h, 18h-21h, 21h-00h.
Propose des programmes variés et réalistes pour une chaîne généraliste (infos, films, divertissement, sport, magazine, etc.).`;

  const userPrompt = `Génère la chaîne généraliste avec ses 8 programmes (un par créneau de 3h). Réponse : uniquement l'objet JSON.`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.7,
  });

  const raw = completion.choices[0]?.message?.content?.trim();
  if (!raw) throw new Error('Réponse OpenAI vide');

  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) data = JSON.parse(match[0]);
    else throw new Error('Impossible de parser le JSON OpenAI: ' + raw.slice(0, 200));
  }

  const name = data.name || 'GNV TV Généraliste';
  const description = data.description || 'Chaîne généraliste à bord. Infos, films et divertissement.';
  let programs = Array.isArray(data.programs) ? data.programs : [];
  if (programs.length !== 8) {
    // Compléter ou tronquer pour avoir 8 programmes
    const defaultTitles = ['Nuit à bord', 'Réveil', 'Matinale', 'Midi', 'Après-midi', 'Soirée', 'Prime', 'Soir'];
    while (programs.length < 8) {
      programs.push({
        title: defaultTitles[programs.length] || `Programme ${programs.length + 1}`,
        description: '',
      });
    }
    programs = programs.slice(0, 8);
  }

  return { name, description, programs };
}

async function seedWebTV() {
  try {
    if (!OPENAI_API_KEY) {
      console.error('❌ OPENAI_API_KEY manquant. Définissez-le dans backend/.env');
      process.exit(1);
    }

    console.log('🔌 Connexion MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connecté:', mongoose.connection.name);

    console.log('🤖 Génération de la chaîne WebTV généraliste via OpenAI...');
    const { name, description, programs } = await generateChannelWithOpenAI();
    console.log('✅ Chaîne générée:', name);

    const existing = await WebTVChannel.findOne({ name });
    if (existing) {
      console.log('⏭️  Une chaîne avec ce nom existe déjà. Mise à jour de la programmation.');
      existing.programs = SLOTS_3H.map((slot, i) => ({
        title: programs[i]?.title || `Créneau ${i + 1}`,
        description: programs[i]?.description || '',
        startTime: slot.startTime,
        endTime: slot.endTime,
        duration: 180,
        order: i + 1,
        isActive: true,
      }));
      existing.schedule = SLOTS_3H.map((slot, i) => ({
        time: `${slot.startTime} - ${slot.endTime}`,
        program: programs[i]?.title || `Programme ${i + 1}`,
        description: programs[i]?.description || '',
      }));
      await existing.save();
      console.log('✅ Programmation mise à jour. Total chaînes:', await WebTVChannel.countDocuments({}));
      await mongoose.disconnect();
      process.exit(0);
      return;
    }

    const programsForDb = SLOTS_3H.map((slot, i) => ({
      title: programs[i]?.title || `Créneau ${i + 1}`,
      description: programs[i]?.description || '',
      startTime: slot.startTime,
      endTime: slot.endTime,
      duration: 180,
      order: i + 1,
      isActive: true,
    }));

    const schedule = SLOTS_3H.map((slot, i) => ({
      time: `${slot.startTime} - ${slot.endTime}`,
      program: programs[i]?.title || `Programme ${i + 1}`,
      description: programs[i]?.description || '',
    }));

    await WebTVChannel.create({
      name,
      category: 'entertainment',
      description,
      streamUrl: process.env.WEBTV_STREAM_URL || 'https://stream.example.com/gnv-generaliste',
      logo: '',
      imageUrl: '',
      isLive: true,
      isActive: true,
      quality: 'HD',
      viewers: 0,
      schedule,
      programs: programsForDb,
      countries: [],
    });

    console.log('✅ Chaîne créée:', name);
    schedule.forEach((s, i) => console.log(`   ${s.time} — ${s.program}`));
    console.log('\n✅ Seed WebTV généraliste terminé. Total chaînes:', await WebTVChannel.countDocuments({}));
  } catch (err) {
    console.error('❌ Erreur:', err.message);
    if (err.response?.data) console.error(err.response.data);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

seedWebTV();
