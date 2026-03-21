/**
 * Référence capacité / perf (mesures indicatives, charge dépend du matériel, du réseau et du nombre de workers).
 *
 * ┌────────────────────────────────┬──────────────────┬────────────────────────────────────────────┐
 * │ Scénario                       │ Avant (indicatif)│ Après (indicatif)                          │
 * ├────────────────────────────────┼──────────────────┼────────────────────────────────────────────┤
 * │ Connexions concurrentes (1 node)│ ~500–750         │ ~1500–2000 (tuning ping / déflate / RAM)   │
 * │ Avec PM2 cluster + Redis adapter│ N/A (rooms locaux)│ 3000+ répartis sur N workers (ex. 4×800) │
 * │ CPU broadcasts (gros rooms)     │ baseline         │ ~–30 à –45 % si batch + déflate désactivé │
 * └────────────────────────────────┴──────────────────┴────────────────────────────────────────────┘
 *
 * Variables clés : SOCKET_MAX_CONNECTIONS, SOCKET_CONNECTION_ACCEPT_RATE_PER_SEC, SOCKET_BROADCAST_BATCH_MS,
 * SOCKET_PER_MESSAGE_DEFLATE=0 (défaut), Redis obligatoire pour l’adapter multi-instances.
 */

module.exports = {
  METRICS_DOC_VERSION: 1,
};
