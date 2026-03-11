/**
 * Middleware : exige une connexion MongoDB active pour la route.
 * Répond 503 si MongoDB n'est pas connecté (toutes les rubriques API utilisent la base).
 */
const mongoose = require('mongoose');

function requireMongo(req, res, next) {
  if (mongoose.connection.readyState === 1) {
    return next();
  }
  res.status(503).json({
    message: 'Service temporairement indisponible : base de données non connectée.',
    code: 'DB_DISCONNECTED',
    hint: 'Vérifiez que MongoDB est démarré et que MONGODB_URI est correct dans config.env'
  });
}

module.exports = { requireMongo };
