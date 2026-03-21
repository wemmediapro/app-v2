/**
 * Génération des traductions (titre, description) pour chaînes WebTV en 6 langues via OpenAI.
 * Utilisé par POST /api/webtv/channels/:id/translate et POST /api/webtv/translate.
 */

const LANGS = ['fr', 'en', 'es', 'it', 'de', 'ar'];

/**
 * Génère les traductions pour une chaîne WebTV (nom + description).
 * @param {object} openai - instance OpenAI
 * @param {string} name - nom/titre de la chaîne (ex. en français)
 * @param {string} description - description de la chaîne
 * @returns {Promise<object>} { fr: { name, description }, en: ..., ... }
 */
async function generateTranslationsForWebTV(openai, name, description) {
  const systemPrompt = `Tu es un traducteur pour l'application GNV OnBoard (TV à bord des ferries, traversées Méditerranée).
Pour une chaîne WebTV, tu dois fournir le nom (name) et la description (description) dans exactement 6 langues : français (fr), anglais (en), espagnol (es), italien (it), allemand (de), arabe (ar).

Règles :
- Si le texte source est en français : pour fr recopie exactement name et description ; pour les autres langues traduis de façon naturelle.
- Si le texte source est dans une autre langue : traduis dans les 6 langues de façon cohérente (fr, en, es, it, de, ar).
- name : court, titre de chaîne (ex. "GNV News", "Actualités"), max 120 caractères par langue.
- description : courte phrase pour une chaîne TV à bord, max 400 caractères par langue.
- Réponse : UNIQUEMENT un objet JSON valide, sans texte avant ou après :
{
  "translations": {
    "fr": { "name": "...", "description": "..." },
    "en": { "name": "...", "description": "..." },
    "es": { "name": "...", "description": "..." },
    "it": { "name": "...", "description": "..." },
    "de": { "name": "...", "description": "..." },
    "ar": { "name": "...", "description": "..." }
  }
}`;

  const userPrompt = `Nom / titre de la chaîne : ${(name || '(sans nom)').slice(0, 200)}
Description : ${(description || '(aucune)').slice(0, 600)}

Génère l'objet JSON avec "translations" pour les 6 langues (fr, en, es, it, de, ar).`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
  });

  const raw = completion.choices[0]?.message?.content?.trim();
  if (!raw) {throw new Error('Réponse OpenAI vide');}

  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {data = JSON.parse(match[0]);} else {throw new Error('JSON invalide: ' + raw.slice(0, 200));}
  }

  const translations = data.translations || data;
  const out = {};
  for (const lang of LANGS) {
    const t = translations[lang];
    if (t && typeof t === 'object') {
      out[lang] = {
        name: String(t.name ?? name ?? '').trim().slice(0, 120),
        description: String(t.description ?? description ?? '').trim().slice(0, 400),
      };
    }
  }
  if (!out.fr) {
    out.fr = {
      name: (name || '').slice(0, 120),
      description: (description || '').slice(0, 400),
    };
  }
  return out;
}

module.exports = { LANGS, generateTranslationsForWebTV };
