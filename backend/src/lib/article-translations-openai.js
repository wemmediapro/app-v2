/**
 * Génération des traductions (titre, résumé, contenu) pour articles magazine en 6 langues via OpenAI.
 * Utilisé par le script seed-magazine-translations-openai.js.
 */

const LANGS = ['fr', 'en', 'es', 'it', 'de', 'ar'];

/**
 * Génère les traductions pour un article magazine.
 * @param {object} openai - instance OpenAI
 * @param {string} titleFr - titre en français
 * @param {string} excerptFr - résumé (excerpt) en français
 * @param {string} contentFr - corps de l'article en français
 * @param {string} category - catégorie de l'article
 * @returns {Promise<object>} { fr: { title, excerpt, content }, en: ..., ... }
 */
async function generateTranslationsForArticle(openai, titleFr, excerptFr, contentFr, category) {
  const systemPrompt = `Tu es un traducteur pour le magazine GNV OnBoard (ferry, traversées Méditerranée, voyage à bord).
Pour un article, tu dois fournir le titre (title), le résumé (excerpt) et le contenu (content) dans exactement 6 langues : français (fr), anglais (en), espagnol (es), italien (it), allemand (de), arabe (ar).

Règles :
- Pour le français (fr), utilise exactement le titre, le résumé et le contenu fournis (ne pas modifier).
- Pour les autres langues : traduis de façon naturelle et adaptée à un magazine voyage/ferry. Conserve la structure en paragraphes du content.
- title : max 200 caractères par langue.
- excerpt : résumé en 1-2 phrases, max 500 caractères par langue.
- content : traduction complète du corps de l'article, en 2-5 paragraphes, style magazine. Max 2500 caractères par langue (si l’original est plus long, résume tout en gardant le sens).
- Réponse : UNIQUEMENT un objet JSON valide, sans texte avant ou après, de la forme :
{
  "translations": {
    "fr": { "title": "...", "excerpt": "...", "content": "..." },
    "en": { "title": "...", "excerpt": "...", "content": "..." },
    "es": { "title": "...", "excerpt": "...", "content": "..." },
    "it": { "title": "...", "excerpt": "...", "content": "..." },
    "de": { "title": "...", "excerpt": "...", "content": "..." },
    "ar": { "title": "...", "excerpt": "...", "content": "..." }
  }
}`;

  const contentTruncated = (contentFr || '').slice(0, 4000);
  const userPrompt = `Catégorie : ${category || 'Voyage'}.

Titre (français) : ${titleFr || '(sans titre)'}
Résumé (français) : ${excerptFr || '(aucun)'}

Contenu (français) :
${contentTruncated || '(aucun)'}

Génère l'objet JSON avec "translations" pour les 6 langues (fr, en, es, it, de, ar). Pour fr, recopie exactement titre, excerpt et content ci-dessus.`;

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
    if (t && typeof t === 'object') {
      out[lang] = {
        title: String(t.title ?? titleFr ?? '').trim().slice(0, 200),
        excerpt: String(t.excerpt ?? excerptFr ?? '').trim().slice(0, 500),
        content: String(t.content ?? contentFr ?? '').trim().slice(0, 10000),
      };
    }
  }
  if (!out.fr) {
    out.fr = {
      title: (titleFr || '').slice(0, 200),
      excerpt: (excerptFr || '').slice(0, 500),
      content: contentFr || '',
    };
  }
  return out;
}

module.exports = { LANGS, generateTranslationsForArticle };
