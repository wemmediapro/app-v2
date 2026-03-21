/**
 * Adapter @socket.io/redis-adapter — rooms et broadcasts cohérents entre workers (PM2 cluster, K8s).
 */
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');
const logger = require('../lib/logger');

/**
 * @param {import('socket.io').Server} io
 * @param {string} redisUrl
 * @returns {Promise<{ ok: boolean }>}
 */
async function attachRedisAdapter(io, redisUrl) {
  if (!redisUrl || typeof redisUrl !== 'string' || !redisUrl.startsWith('redis')) {
    logger.warn({ event: 'socket_io_redis_adapter_skip', reason: 'no_redis_url' });
    return { ok: false };
  }

  const pubClient = createClient({
    url: redisUrl,
    socket: {
      reconnectStrategy: (retries) => Math.min(retries * 100, 3000),
    },
  });
  const subClient = pubClient.duplicate();

  pubClient.on('error', (err) => {
    logger.warn({ event: 'socket_io_redis_pub_error', err: err.message });
  });
  subClient.on('error', (err) => {
    logger.warn({ event: 'socket_io_redis_sub_error', err: err.message });
  });

  await Promise.all([pubClient.connect(), subClient.connect()]);
  io.adapter(createAdapter(pubClient, subClient));
  logger.info({ event: 'socket_io_redis_adapter_enabled' });
  return { ok: true };
}

function attachRedisAdapterFireAndForget(io, redisUrl) {
  attachRedisAdapter(io, redisUrl).catch((err) => {
    logger.warn({
      event: 'socket_io_redis_adapter_unavailable',
      err: err.message,
      stack: err.stack,
    });
  });
}

module.exports = { attachRedisAdapter, attachRedisAdapterFireAndForget };
