/**
 * Façade cache (checklist) : instance Redis existante + invalidation en cascade par tag / événement.
 * Le module canonique reste lib/cache-manager.js ; celui-ci expose les alias attendus par la doc projet.
 */

const cacheManager = require('./cache-manager');
const { invalidateResponseCacheByEvent, invalidateResponseCacheByTag } = require('../middleware/responseCache');

/**
 * @param {string} event
 * @returns {Promise<number>}
 */
async function cascadeInvalidateByEvent(event) {
  return invalidateResponseCacheByEvent(cacheManager, event);
}

/**
 * @param {string} tag
 * @returns {Promise<number>}
 */
async function cascadeInvalidateByTag(tag) {
  return invalidateResponseCacheByTag(cacheManager, tag);
}

module.exports = {
  cacheManager,
  cascadeInvalidateByEvent,
  cascadeInvalidateByTag,
};
