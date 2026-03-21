/**
 * Génération des traductions (nom, description, ageRange, schedule, features) pour activités enfant en 6 langues via OpenAI.
 * Utilisé par le script seed-enfant-images-translations-openai.js et seed-enfant-translations-fields-openai.js.
 */

const LANGS = ['fr', 'en', 'es', 'it', 'de', 'ar'];

/**
 * Génère les traductions pour une activité enfant.
 * @param {object} openai - instance OpenAI
 * @param {string} nameFr - nom de l'activité en français
 * @param {string} descriptionFr - description en français
 * @param {string} [category] - catégorie (ex: Jeux, Arts & Créativité)
 * @param {string} [ageRangeFr] - tranche d'âge en français (ex: "6-12 ans")
 * @param {string} [scheduleFr] - horaires en français (ex: "Tous les jours 10h-12h")
 * @param {string[]} [featuresFr] - liste de libellés en français (ex: ["Espace sécurisé", "Encadré par une animatrice"])
 * @returns {Promise<object>} { fr: { name, description, ageRange?, schedule?, features? }, en: ..., ... }
 */
async function generateTranslationsForEnfant(
  openai,
  nameFr,
  descriptionFr,
  category,
  ageRangeFr,
  scheduleFr,
  featuresFr
) {
  const hasExtra = [ageRangeFr, scheduleFr, featuresFr].some(
    (x) => x !== undefined && x !== null && (Array.isArray(x) ? x.length > 0 : String(x).trim())
  );
  const systemPrompt = `Tu es un traducteur pour un portail d'activités enfants à bord des ferries (GNV OnBoard).
Pour une activité enfant, tu dois fournir les champs demandés dans exactement 6 langues : français (fr), anglais (en), espagnol (es), italien (it), allemand (de), arabe (ar).

Règles :
- Pour le français (fr), utilise exactement les valeurs fournies (ne pas modifier).
- Pour les autres langues : traduis de façon naturelle et adaptée aux activités enfants/famille.
- Chaque description doit rester un résumé court (2-4 phrases, max 500 caractères par description).
- ageRange : garde le format "X-Y" pour les chiffres, traduis uniquement le mot "ans" (ex: "6-12 ans" → "6-12 anni" en italien).
- schedule : traduis les expressions comme "Tous les jours", "h" pour heures, etc.
- features : tableau de courtes étiquettes à traduire (ex: "Espace sécurisé" → "Spazio sicuro" en italien).
- Réponse : UNIQUEMENT un objet JSON valide, sans texte avant ou après, de la forme :
{
  "translations": {
    "fr": { "name": "...", "description": "...", "ageRange": "...", "schedule": "...", "features": ["..."] },
    "en": { ... },
    "es": { ... },
    "it": { ... },
    "de": { ... },
    "ar": { ... }
  }
}
Inclus ageRange, schedule et features dans chaque langue UNIQUEMENT si ces champs sont fournis dans la requête.`;

  let userPrompt = `Catégorie : ${category || 'Activité'}.
Nom (français) : ${nameFr}
Description (français) : ${descriptionFr || '(aucune)'}`;
  if (ageRangeFr) {
    userPrompt += `\nTranche d'âge (français) : ${ageRangeFr}`;
  }
  if (scheduleFr) {
    userPrompt += `\nHoraires (français) : ${scheduleFr}`;
  }
  if (Array.isArray(featuresFr) && featuresFr.length > 0) {
    userPrompt += `\nÉtiquettes/features (français) : ${JSON.stringify(featuresFr)}`;
  }
  userPrompt += '\n\nGénère l\'objet JSON avec "translations" pour les 6 langues (fr, en, es, it, de, ar).';

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.4,
  });

  const raw = completion.choices[0]?.message?.content?.trim();
  if (!raw) {
    throw new Error('Réponse OpenAI vide');
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      data = JSON.parse(match[0]);
    } else {
      throw new Error('JSON invalide: ' + raw.slice(0, 200));
    }
  }

  const translations = data.translations || data;
  const out = {};
  for (const lang of LANGS) {
    const t = translations[lang];
    if (t && (t.name || t.description !== undefined)) {
      out[lang] = {
        name: String(t.name || nameFr)
          .trim()
          .slice(0, 200),
        description: String(t.description ?? descriptionFr ?? '')
          .trim()
          .slice(0, 2000),
      };
      if (hasExtra && t.ageRange) {
        out[lang].ageRange = String(t.ageRange).trim().slice(0, 50);
      }
      if (hasExtra && t.schedule) {
        out[lang].schedule = String(t.schedule).trim().slice(0, 200);
      }
      if (hasExtra && Array.isArray(t.features) && t.features.length > 0) {
        out[lang].features = t.features.map((f) => String(f).trim().slice(0, 100));
      }
    }
  }
  if (!out.fr) {
    out.fr = { name: nameFr, description: descriptionFr || '' };
    if (ageRangeFr) {
      out.fr.ageRange = ageRangeFr;
    }
    if (scheduleFr) {
      out.fr.schedule = scheduleFr;
    }
    if (Array.isArray(featuresFr) && featuresFr.length > 0) {
      out.fr.features = [...featuresFr];
    }
  }
  return out;
}

module.exports = { LANGS, generateTranslationsForEnfant };
