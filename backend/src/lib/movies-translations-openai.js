/**
 * Génération des traductions (titre + description) pour films/séries en 6 langues via OpenAI.
 * Utilisé par le script seed-movies-translations-openai.js et la route POST /api/movies/fill-translations-openai.
 */

const LANGS = ['fr', 'en', 'es', 'it', 'de', 'ar'];

/**
 * Génère les traductions pour un film/série.
 * @param {object} openai - instance OpenAI
 * @param {string} titleFr - titre en français
 * @param {string} descriptionFr - description en français
 * @param {string} typeLabel - "film" ou "série"
 * @returns {Promise<object>} { fr: { title, description }, en: ..., ... }
 */
async function generateTranslationsForMovie(openai, titleFr, descriptionFr, typeLabel) {
  const systemPrompt = `Tu es un traducteur pour un portail de films et séries à bord des ferries (GNV OnBoard).
Pour un film ou une série, tu dois fournir le titre et la description dans exactement 6 langues : français (fr), anglais (en), espagnol (es), italien (it), allemand (de), arabe (ar).

Règles :
- Pour le français (fr), utilise exactement le titre et la description fournis (ne pas modifier).
- Pour les autres langues : traduis le titre et la description de façon naturelle et adaptée au cinéma/séries (titres officiels connus si applicable, sinon traduction fidèle).
- Chaque description doit rester un résumé court (2-4 phrases, max 600 caractères par description).
- Réponse : UNIQUEMENT un objet JSON valide, sans texte avant ou après, de la forme :
{
  "translations": {
    "fr": { "title": "...", "description": "..." },
    "en": { "title": "...", "description": "..." },
    "es": { "title": "...", "description": "..." },
    "it": { "title": "...", "description": "..." },
    "de": { "title": "...", "description": "..." },
    "ar": { "title": "...", "description": "..." }
  }
}`;

  const userPrompt = `Type : ${typeLabel}.
Titre (français) : ${titleFr}
Description (français) : ${descriptionFr || '(aucune)'}

Génère l'objet JSON avec "translations" pour les 6 langues (fr, en, es, it, de, ar).`;

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
  if (!raw) throw new Error('Réponse OpenAI vide');

  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) data = JSON.parse(match[0]);
    else throw new Error('JSON invalide: ' + raw.slice(0, 200));
  }

  const translations = data.translations || data;
  const out = {};
  for (const lang of LANGS) {
    const t = translations[lang];
    if (t && (t.title || t.description)) {
      out[lang] = {
        title: String(t.title || titleFr).trim().slice(0, 200),
        description: String(t.description || descriptionFr || '').trim().slice(0, 2000),
      };
    }
  }
  if (!out.fr) out.fr = { title: titleFr, description: descriptionFr || '' };
  return out;
}

module.exports = { LANGS, generateTranslationsForMovie };
