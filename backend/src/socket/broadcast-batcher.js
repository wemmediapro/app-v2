/**
 * Réduit les émissions quand plusieurs messages partent de la **même** socket vers la **même** room
 * dans une fenêtre courte (rafales). Un seul frame WS peut porter `{ __batch: true, messages: [...] }`.
 *
 * Désactivé si SOCKET_BROADCAST_BATCH_MS absent ou ≤ 0 (1 emit `new-message` par message, historique).
 */

const logger = require('../lib/logger');

function flushBucket(buckets, key) {
  const b = buckets.get(key);
  if (!b) {
    return;
  }
  buckets.delete(key);
  clearTimeout(b.timer);
  const entries = b.entries;
  if (!entries.length) {
    return;
  }
  const roomName = key.split('\0')[0];
  const sock = entries[0].socket;
  if (entries.length === 1) {
    sock.to(roomName).emit('new-message', entries[0].payload);
    return;
  }
  const sameSocket = entries.every((e) => e.socket.id === sock.id);
  if (!sameSocket) {
    for (const e of entries) {
      e.socket.to(roomName).emit('new-message', e.payload);
    }
    return;
  }
  sock.to(roomName).emit('new-message', {
    __batch: true,
    messages: entries.map((e) => e.payload),
  });
  logger.debug({
    event: 'socket_broadcast_batch_flushed',
    room: roomName,
    count: entries.length,
  });
}

/**
 * @param {import('socket.io').Server} _io
 */
function createMessageBroadcaster(_io) {
  const batchMs = parseInt(process.env.SOCKET_BROADCAST_BATCH_MS, 10);
  const enabled = Number.isFinite(batchMs) && batchMs > 0;

  if (!enabled) {
    return {
      emitChatMessage(socket, room, payload) {
        socket.to(room).emit('new-message', payload);
      },
      shutdown() {},
    };
  }

  /** @type {Map<string, { timer: ReturnType<typeof setTimeout>, entries: { socket: import('socket.io').Socket, payload: object }[] }>} */
  const buckets = new Map();

  function bucketKey(room, socketId) {
    return `${room}\0${socketId}`;
  }

  return {
    emitChatMessage(socket, room, payload) {
      const key = bucketKey(room, socket.id);
      let b = buckets.get(key);
      if (!b) {
        b = {
          entries: [],
          timer: setTimeout(() => flushBucket(buckets, key), batchMs),
        };
        buckets.set(key, b);
      }
      b.entries.push({ socket, payload });
    },
    shutdown() {
      for (const key of [...buckets.keys()]) {
        flushBucket(buckets, key);
      }
    },
  };
}

module.exports = { createMessageBroadcaster };
