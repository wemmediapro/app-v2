/**
 * Middleware de pagination pour les listes (évite crash 1000+ users).
 * Défaut : page=1, limit=20. Max limit=100.
 * Après le middleware : req.pagination = { page, limit, skip }.
 *
 * Préférer `validatePagination` depuis `validateInput.js` (plafonds page/limit alignés).
 * Encore utilisé par : movies (GET /), etc.
 * Équivalent manuel ou validatePagination : movies (GET /), shop (GET / avec validatePagination).
 */
function paginate(req, res, next) {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  req.pagination = {
    page,
    limit,
    skip: (page - 1) * limit,
  };
  next();
}

module.exports = { paginate };
