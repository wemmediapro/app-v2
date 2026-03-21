/**
 * Options client Socket.io — alignées sur le serveur (transports websocket, path /socket.io).
 * Reconnexion bornée pour réseaux instables sans saturer le backend.
 */

/**
 * @param {string} authToken — JWT (champ auth côté serveur)
 */
export function buildPassengerSocketIoOptions(authToken) {
  const reconnectionDisabled = import.meta.env.VITE_SOCKET_RECONNECTION === '0';
  const attemptsRaw = parseInt(import.meta.env.VITE_SOCKET_RECONNECTION_ATTEMPTS, 10);
  const attempts = Number.isFinite(attemptsRaw) && attemptsRaw > 0 ? attemptsRaw : 10;
  const timeoutRaw = parseInt(import.meta.env.VITE_SOCKET_TIMEOUT_MS, 10);
  const timeout = Number.isFinite(timeoutRaw) && timeoutRaw > 0 ? timeoutRaw : 15_000;

  const base = {
    auth: { token: authToken || '' },
    transports: ['websocket'],
    path: '/socket.io',
    timeout,
    autoConnect: false,
    closeOnBeforeunload: true,
  };

  if (reconnectionDisabled) {
    return { ...base, reconnection: false };
  }

  return {
    ...base,
    reconnection: true,
    reconnectionAttempts: attempts,
    reconnectionDelay: 1200,
    reconnectionDelayMax: 15_000,
    randomizationFactor: 0.5,
  };
}
