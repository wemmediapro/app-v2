/**
 * Normalise le chemin API pour les middlewares (rate limit, cache, logs).
 * Gère à la fois le pathname complet (/api/v1/...) et le chemin relatif au mount /api (/v1/... ou /movies).
 * @param {string} [pathname] req.path
 * @returns {string} suffixe logique (ex. /movies, /health)
 */
function getApiPathSuffix(pathname) {
  let p = pathname || '/';
  if (!p.startsWith('/')) {
    p = `/${p}`;
  }
  if (p.startsWith('/api/') || p === '/api') {
    p = p.replace(/^\/api(\/v1)?(?=\/|$)/i, '') || '/';
    return p.startsWith('/') ? p : `/${p}`;
  }
  if (p.startsWith('/v1/') || p === '/v1') {
    p = p.replace(/^\/v1(?=\/|$)/i, '') || '/';
  }
  return p.startsWith('/') ? p : `/${p}`;
}

module.exports = { getApiPathSuffix };
