/**
 * Récupération d'une URL d'affiche de film via Google Custom Search (recherche d'images).
 * Nécessite : GOOGLE_CSE_API_KEY et GOOGLE_CSE_CX dans .env
 * Doc : https://developers.google.com/custom-search/v1/overview
 * Limite : 100 requêtes/jour gratuites (Custom Search).
 */

const https = require('https');
const logger = require('./logger');

const CSE_BASE = 'https://www.googleapis.com/customsearch/v1';

/**
 * Recherche une image d'affiche pour un titre de film via Google Custom Search.
 * @param {string} title - Titre du film (ou requête libre, ex. "Inception movie poster")
 * @returns {Promise<string|null>} - URL de la première image trouvée, ou null
 */
async function fetchPosterUrlFromGoogle(title) {
  const apiKey = process.env.GOOGLE_CSE_API_KEY;
  const cx = process.env.GOOGLE_CSE_CX;
  if (!apiKey || !cx) {
    logger.warn({ event: 'google_poster_search_credentials_missing' });
    return null;
  }

  const query = typeof title === 'string' && title.trim() ? `${title.trim()} movie poster` : 'movie poster';
  const qs = new URLSearchParams({
    key: apiKey,
    cx,
    q: query,
    searchType: 'image',
    num: '5',
    safe: 'active',
    imgSize: 'large',
  });
  const url = `${CSE_BASE}?${qs.toString()}`;

  return new Promise((resolve) => {
    const req = https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const items = json.items;
          if (items && items.length > 0 && items[0].link) {
            resolve(items[0].link);
            return;
          }
          if (json.error) {
            logger.warn({
              event: 'google_poster_search_api_error',
              err: json.error.message || String(json.error),
            });
          }
          resolve(null);
        } catch (e) {
          logger.warn({ event: 'google_poster_search_parse_failed', err: e.message });
          resolve(null);
        }
      });
    });
    req.on('error', (err) => {
      logger.warn({ event: 'google_poster_search_request_failed', err: err.message });
      resolve(null);
    });
    req.setTimeout(10000, () => {
      req.destroy();
      resolve(null);
    });
  });
}

module.exports = { fetchPosterUrlFromGoogle };
