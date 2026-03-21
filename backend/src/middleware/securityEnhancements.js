/**
 * Couche sécurité complémentaire (Helmet + rate limit déjà dans server.js).
 * Permissions-Policy restrictive pour réduire la surface d’abus navigateur.
 */

/**
 * @returns {import('express').RequestHandler}
 */
function securityEnhancementsHeaders() {
  return (_req, res, next) => {
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=()');
    next();
  };
}

module.exports = {
  securityEnhancementsHeaders,
};
