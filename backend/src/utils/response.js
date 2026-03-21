/**
 * Réponses API standardisées pour une ergonomie cohérente.
 */
function ok(res, data = {}, status = 200) {
  if (typeof data === 'object' && data !== null && !Array.isArray(data) && !data.message) {
    return res.status(status).json({ success: true, ...data });
  }
  return res.status(status).json({ success: true, data });
}

function err(res, message, status = 500, details = null) {
  const body = { success: false, message: message || 'Erreur serveur' };
  if (details != null) {body.details = details;}
  return res.status(status).json(body);
}

module.exports = { ok, err };
