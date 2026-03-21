/**
 * Cache média pour lecture offline (Cache API).
 * Permet d'enregistrer une URL vidéo/audio pour la lire sans réseau.
 */

const CACHE_NAME = 'gnv-offline-media-v1';

/**
 *
 */
async function getCache() {
  if (!('caches' in window)) return null;
  return caches.open(CACHE_NAME);
}

/**
 *
 */
export async function isAvailableOffline(url) {
  if (!url || !('caches' in window)) return false;
  try {
    const cache = await getCache();
    if (!cache) return false;
    const match = await cache.match(url);
    return !!match;
  } catch {
    return false;
  }
}

/**
 * Enregistre une URL dans le cache pour lecture offline.
 * @param {string} url - URL du média (vidéo ou audio)
 * @returns {Promise<boolean>} true si mis en cache
 */
export async function registerForOffline(url) {
  if (!url || !('caches' in window)) return false;
  try {
    const cache = await getCache();
    if (!cache) return false;
    await cache.add(url);
    return true;
  } catch (err) {
    console.warn('offlineMedia: cache add failed', url, err);
    return false;
  }
}

/**
 * Retire une URL du cache offline.
 */
export async function unregisterFromOffline(url) {
  if (!url || !('caches' in window)) return;
  try {
    const cache = await getCache();
    if (cache) await cache.delete(url);
  } catch {}
}

/**
 * Retourne une URL utilisable pour <video> ou <audio> :
 * si on est offline et que l'URL est en cache, retourne une blob URL du cache ;
 * sinon retourne l'URL d'origine.
 * @param {string} url - URL du média
 * @returns {Promise<string>} URL à utiliser
 */
export async function getMediaUrlForPlayback(url) {
  if (!url) return url;
  if (navigator.onLine) return url;
  const cache = await getCache();
  if (!cache) return url;
  const match = await cache.match(url);
  if (!match) return url;
  const blob = await match.blob();
  return URL.createObjectURL(blob);
}

/**
 * Liste les URLs actuellement en cache (pour debug ou UI).
 * @returns {Promise<string[]>}
 */
export async function listCachedUrls() {
  try {
    const cache = await getCache();
    if (!cache) return [];
    const keys = await cache.keys();
    return keys.map((r) => r.url);
  } catch {
    return [];
  }
}

/**
 * Vide tout le cache média offline (Cache API).
 * @returns {Promise<boolean>} true si le cache a été vidé
 */
export async function clearOfflineCache() {
  if (!('caches' in window)) return false;
  try {
    const deleted = await caches.delete(CACHE_NAME);
    return deleted;
  } catch {
    return false;
  }
}
