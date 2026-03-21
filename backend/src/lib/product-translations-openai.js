/**
 * Génération des traductions (nom, description) pour produits shop en 6 langues via OpenAI.
 * Utilisé par le script seed-shop-products-openai-multilingual.js.
 */

const LANGS = ['fr', 'en', 'es', 'it', 'de', 'ar'];

/**
 * Génère les traductions pour un produit (nom + description).
 * @param {object} openai - instance OpenAI
 * @param {string} nameFr - nom du produit en français
 * @param {string} descriptionFr - description en français
 * @param {string} category - catégorie du produit
 * @returns {Promise<object>} { fr: { name, description }, en: ..., ... }
 */
async function generateTranslationsForProduct(openai, nameFr, descriptionFr, category) {
  const systemPrompt = `Tu es un traducteur pour la boutique à bord des ferries GNV OnBoard (traversées Méditerranée, voyage).
Pour un produit, tu dois fournir le nom (name) et la description (description) dans exactement 6 langues : français (fr), anglais (en), espagnol (es), italien (it), allemand (de), arabe (ar).

Règles :
- Pour le français (fr), utilise exactement le nom et la description fournis (ne pas modifier).
- Pour les autres langues : traduis de façon naturelle et adaptée à une boutique ferry/croisière. Style e-commerce.
- name : max 150 caractères par langue.
- description : 1 à 3 phrases, max 600 caractères par langue.
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

  const userPrompt = `Catégorie : ${category || 'souvenirs'}.

Nom (français) : ${nameFr || '(sans nom)'}
Description (français) : ${(descriptionFr || '(aucune)').slice(0, 800)}

Génère l'objet JSON avec "translations" pour les 6 langues (fr, en, es, it, de, ar). Pour fr, recopie exactement name et description ci-dessus.`;

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
    if (t && typeof t === 'object') {
      out[lang] = {
        name: String(t.name ?? nameFr ?? '')
          .trim()
          .slice(0, 150),
        description: String(t.description ?? descriptionFr ?? '')
          .trim()
          .slice(0, 600),
      };
    }
  }
  if (!out.fr) {
    out.fr = {
      name: (nameFr || '').slice(0, 150),
      description: (descriptionFr || '').slice(0, 600),
    };
  }
  return out;
}

module.exports = { LANGS, generateTranslationsForProduct };
