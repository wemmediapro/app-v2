/**
 * Configuration partagée pour la génération d'affiches films/séries via OpenAI (DALL-E 3).
 * Toutes les images sont générées à la MÊME TAILLE pour un affichage uniforme dans l'app.
 */

/** Taille unique pour les affiches : portrait 1024x1792 (ratio 2/3, comme les cartes de l'app). */
const POSTER_IMAGE_SIZE = '1024x1792';

/** Options DALL-E 3 à utiliser pour toutes les affiches. */
const DALLE3_POSTER_OPTIONS = {
  model: 'dall-e-3',
  n: 1,
  size: POSTER_IMAGE_SIZE,
  quality: 'hd',
  response_format: 'b64_json',
  style: 'vivid',
};

/**
 * Construit un prompt pour une affiche de film/série (style key art, sans texte sur l'image).
 * @param {object} item - { title, type, genre, year, description? }
 * @returns {string}
 */
function buildPosterPrompt(item) {
  const title = item.title || 'Film';
  const type = item.type === 'series' ? 'TV series' : 'movie';
  const genreRaw = (item.genre || 'drama').toLowerCase().trim();
  const year = item.year ? String(item.year) : '';
  const desc = (item.description || '').slice(0, 150);

  const genreMood = {
    action: 'dynamic action, dramatic lighting, intense atmosphere, blockbuster',
    aventure: 'epic adventure, vast landscapes, heroic mood, cinematic scale',
    adventure: 'epic adventure, vast landscapes, heroic mood, cinematic scale',
    science: 'sci-fi, futuristic, neon or cosmic, high concept',
    'science-fiction': 'sci-fi, futuristic, neon or cosmic, high concept',
    'sci-fi': 'sci-fi, futuristic, neon or cosmic, high concept',
    fantasy: 'fantasy, magical atmosphere, rich colors, immersive world',
    drame: 'emotional, moody lighting, intimate and powerful',
    drama: 'emotional, moody lighting, intimate and powerful',
    comédie: 'bright, warm, inviting, lighthearted',
    comedy: 'bright, warm, inviting, lighthearted',
    thriller: 'tense, shadowy, suspenseful, noir atmosphere',
    horreur: 'dark, unsettling, atmospheric horror mood',
    horror: 'dark, unsettling, atmospheric horror mood',
    romance: 'romantic, soft lighting, elegant',
    animation: 'colorful, stylized, appealing character art',
    famille: 'family-friendly, warm, colorful, appealing',
    documentaire: 'documentary style, authentic, cinematic',
    historique: 'period piece, epic scale, rich production design',
    histoire: 'historical, dramatic, immersive',
    guerre: 'war film, gritty, dramatic, historical',
    biopic: 'prestigious, dramatic lighting, character-focused',
  };
  const mood = genreMood[genreRaw] || `cinematic ${genreRaw}, dramatic lighting, professional key art`;

  const parts = [
    `Professional theatrical movie poster key art for ${type} "${title}".`,
    `Visual style: ${mood}.`,
    year ? `Era: ${year}.` : '',
    desc ? `Story mood: ${desc}.` : '',
    'Composition: single striking image, no text or titles on the image, no logos. Vertical poster feel, cinematic lighting, high production value, suitable for streaming platform. Photorealistic or high-end illustrated style. Safe for all audiences.',
  ].filter(Boolean);
  return parts.join(' ');
}

module.exports = {
  POSTER_IMAGE_SIZE,
  DALLE3_POSTER_OPTIONS,
  buildPosterPrompt,
};
