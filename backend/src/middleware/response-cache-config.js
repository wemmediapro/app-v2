/**
 * Configuration du cache de réponses HTTP (GET, Redis).
 * @typedef {{ test: (apiSub: string) => boolean, ttl: number, tag: string }} ResponseCacheRule
 */

const {
  RE_CACHE_SUB_MOVIES,
  RE_CACHE_SUB_MAGAZINE,
  RE_CACHE_SUB_RADIO,
  RE_CACHE_SUB_BANNERS,
  RE_CACHE_SUB_SHOP,
  RE_CACHE_SUB_RESTAURANTS,
  RE_CACHE_SUB_WEBTV,
  RE_CACHE_SUB_ENFANT,
  RE_CACHE_SUB_SHIPMAP,
  RE_CACHE_SUB_GNV,
} = require('../constants/regex');

/**
 * TTL par défaut si aucune règle ne matche (non utilisé tant que les règles couvrent explicitement les chemins).
 * Surcharge possible via RESPONSE_CACHE_DEFAULT_TTL (secondes).
 */
function defaultTtlSeconds() {
  const n = parseInt(process.env.RESPONSE_CACHE_DEFAULT_TTL, 10);
  return Number.isFinite(n) && n > 0 ? n : 60;
}

/**
 * Règles : premier `test` vrai gagne. `tag` sert à l’invalidation (`invalidateResponseCacheByTag` / événements).
 * Aligné sur les listes publiques (hors /notifications — données temps réel).
 */
const RESPONSE_CACHE_RULES = [
  { test: (sub) => RE_CACHE_SUB_MOVIES.test(sub), ttl: 120, tag: 'movies' },
  { test: (sub) => RE_CACHE_SUB_MAGAZINE.test(sub), ttl: 60, tag: 'magazine' },
  { test: (sub) => RE_CACHE_SUB_RADIO.test(sub), ttl: 120, tag: 'radio' },
  { test: (sub) => RE_CACHE_SUB_BANNERS.test(sub), ttl: 120, tag: 'banners' },
  { test: (sub) => RE_CACHE_SUB_SHOP.test(sub), ttl: 120, tag: 'shop' },
  { test: (sub) => RE_CACHE_SUB_RESTAURANTS.test(sub), ttl: 120, tag: 'restaurants' },
  { test: (sub) => RE_CACHE_SUB_WEBTV.test(sub), ttl: 120, tag: 'webtv' },
  { test: (sub) => RE_CACHE_SUB_ENFANT.test(sub), ttl: 120, tag: 'enfant' },
  { test: (sub) => RE_CACHE_SUB_SHIPMAP.test(sub), ttl: 60, tag: 'shipmap' },
  { test: (sub) => RE_CACHE_SUB_GNV.test(sub), ttl: 60, tag: 'gnv' },
];

/**
 * Carte « événement métier » → tags Redis à purger (plusieurs tags possibles).
 * Appeler depuis les routes après mutation (ex. `await invalidateResponseCacheByEvent('magazine_updated')`).
 */
const RESPONSE_CACHE_EVENTS = {
  movies_updated: ['movies'],
  magazine_updated: ['magazine'],
  radio_updated: ['radio'],
  banners_updated: ['banners'],
  shop_updated: ['shop'],
  restaurants_updated: ['restaurants'],
  webtv_updated: ['webtv'],
  enfant_updated: ['enfant'],
  shipmap_updated: ['shipmap'],
  gnv_updated: ['gnv'],
  /** Toutes les listes « catalogue » ci-dessus */
  public_lists: ['movies', 'magazine', 'radio', 'banners', 'shop', 'restaurants', 'webtv', 'enfant', 'shipmap', 'gnv'],
};

/**
 * @param {string} apiSub — suffixe API (ex. /movies), voir getApiPathSuffix
 * @returns {ResponseCacheRule | null}
 */
function matchResponseCacheRule(apiSub) {
  const sub = apiSub && typeof apiSub === 'string' ? apiSub : '/';
  for (const rule of RESPONSE_CACHE_RULES) {
    if (rule.test(sub)) {
      const ttl = typeof rule.ttl === 'number' && rule.ttl > 0 ? rule.ttl : defaultTtlSeconds();
      return { ...rule, ttl };
    }
  }
  return null;
}

module.exports = {
  RESPONSE_CACHE_RULES,
  RESPONSE_CACHE_EVENTS,
  defaultTtlSeconds,
  matchResponseCacheRule,
};
