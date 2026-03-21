/**
 * Options Engine / Socket.io pour forte concurrence (≈1500+ sockets / process).
 * perMessageDeflate désactivé par défaut : gain CPU notable sur gros volumes d’émissions.
 */
const config = require('../config');

/**
 * @param {import('socket.io').ServerOptions['cors']} cors
 * @returns {import('socket.io').ServerOptions}
 */
function buildSocketIoServerOptions(cors) {
  const pingTimeout = parseInt(process.env.SOCKET_PING_TIMEOUT_MS, 10) || 60_000;
  const pingInterval = parseInt(process.env.SOCKET_PING_INTERVAL_MS, 10) || 25_000;
  const maxHttpBufferSize = parseInt(process.env.SOCKET_MAX_HTTP_BUFFER_SIZE, 10) || 1_000_000;
  const connectTimeout = parseInt(process.env.SOCKET_CONNECT_TIMEOUT_MS, 10) || 45_000;

  return {
    transports: ['websocket'],
    cors,
    pingTimeout,
    pingInterval,
    maxHttpBufferSize,
    connectTimeout,
    /** false par défaut : moins de CPU sur broadcasts ; activer avec SOCKET_PER_MESSAGE_DEFLATE=1 si bande passante critique */
    perMessageDeflate: process.env.SOCKET_PER_MESSAGE_DEFLATE === '1',
    allowEIO3: false,
    serveClient: false,
  };
}

/**
 * CORS identique à l’instance actuelle (server.js).
 */
function buildSocketCorsCallback() {
  const { isTunnelOrigin } = require('../lib/http-middleware-tuning');
  return {
    origin: (origin, callback) => {
      const allowed = config.cors.origins;
      const tunnelOk = config.cors.allowTunnelOrigins && origin && isTunnelOrigin(origin);
      if (!origin || allowed.includes(origin) || tunnelOk) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    methods: ['GET', 'POST'],
  };
}

module.exports = { buildSocketIoServerOptions, buildSocketCorsCallback };
