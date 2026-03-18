/**
 * Utilitaires API — normalisation des réponses et messages d'erreur (audit production).
 */

/**
 * Extrait une liste depuis une réponse API (plusieurs formats possibles).
 * @param {*} res - Réponse (souvent res.data)
 * @returns {Array}
 */
export function normalizeApiList(res) {
  if (!res) return [];
  if (Array.isArray(res)) return res;
  if (Array.isArray(res.data)) return res.data;
  if (Array.isArray(res.notifications)) return res.notifications;
  return [];
}

/**
 * Message d'erreur utilisateur à partir d'une erreur axios / API.
 * @param {Error} error
 * @returns {string}
 */
export function getApiErrorMessage(error) {
  if (!error) return 'Une erreur est survenue';
  if (error.userMessage) return error.userMessage;
  const status = error.response?.status;
  const msg = error.response?.data?.message || error.response?.data?.error || error.message;
  if (status === 429) return 'Trop de requêtes. Veuillez réessayer dans un moment.';
  if (status === 404 || error.code === 'ERR_NETWORK') return 'Serveur inaccessible. Vérifiez votre connexion.';
  if (status >= 500) return `Erreur serveur (${status}). Réessayez plus tard.`;
  return msg || 'Une erreur est survenue';
}
