/**
 * Patterns de requête Mongoose réutilisables (secondaires, moins de charge sur le primary).
 */

/**
 * @template T
 * @param {import('mongoose').Query<T, any, {}, T>} q
 * @returns {import('mongoose').Query<T, any, {}, T>}
 */
function withSecondaryRead(q) {
  if (q && typeof q.read === 'function') {
    return q.read('secondaryPreferred');
  }
  return q;
}

module.exports = {
  withSecondaryRead,
};
