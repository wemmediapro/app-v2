/**
 * Gestion des émissions chat Socket.io : debounce par fenêtre, flush par taille de lot,
 * charge utile compacte (clés courtes) optionnelle, pool de buffers réutilisables.
 *
 * Conserve le batching par couple (room, socketId) : chaque expéditeur exclut toujours
 * correctement sa propre socket via `socket.to(room).emit` (pas d’`io.to(room)` global).
 *
 * Variables d’environnement :
 * - SOCKET_BROADCAST_BATCH_MS > 0 : active le batching (défaut historique inchangé si absent).
 * - SOCKET_BROADCAST_BATCH_SIZE : flush quand le lot atteint ce nombre (défaut 10).
 * - SOCKET_MESSAGE_COMPACT=1 : messages sur le fil avec clés r,c,u,ts (voir `chatSocketMessages.js` côté client).
 */

const logger = require('../lib/logger');

/**
 * Pool de buffers fixes pour sérialisations / pièces jointes binaires futures (réduit alloc GC).
 */
class BufferPool {
  /**
   * @param {number} [bufferSize]
   * @param {number} [poolSize]
   */
  constructor(bufferSize = 65536, poolSize = 100) {
    this.bufferSize = bufferSize;
    this.pool = [];
    this.inUse = new Set();
    for (let i = 0; i < poolSize; i++) {
      this.pool.push(Buffer.allocUnsafe(bufferSize));
    }
  }

  acquire() {
    let buffer = this.pool.pop();
    if (!buffer) {
      buffer = Buffer.allocUnsafe(this.bufferSize);
    }
    this.inUse.add(buffer);
    return buffer;
  }

  /**
   * @param {Buffer} buffer
   */
  release(buffer) {
    if (!Buffer.isBuffer(buffer) || buffer.length !== this.bufferSize) {
      return;
    }
    buffer.fill(0);
    this.inUse.delete(buffer);
    this.pool.push(buffer);
  }

  stats() {
    return { pooled: this.pool.length, inUse: this.inUse.size, bufferSize: this.bufferSize };
  }
}

/** @param {Record<string, unknown>} p */
function compactForWire(p) {
  const tsRaw = p.timestamp;
  let ts =
    tsRaw instanceof Date
      ? tsRaw.getTime()
      : typeof tsRaw === 'number' && Number.isFinite(tsRaw)
        ? tsRaw
        : typeof tsRaw === 'string'
          ? Date.parse(tsRaw)
          : Date.now();
  if (!Number.isFinite(ts)) {
    ts = Date.now();
  }
  const content = String(p.content ?? p.text ?? '');
  const u = p.senderId ?? p.sender;
  const out = {
    r: p.room,
    c: content,
    u,
    ts,
  };
  if (p.attachment != null && String(p.attachment).length > 0) {
    out.a = p.attachment;
  }
  if (p.clientSyncId != null && String(p.clientSyncId).trim() !== '') {
    out.cs = String(p.clientSyncId).trim();
  }
  return out;
}

/**
 * @param {Map<string, { timer: ReturnType<typeof setTimeout> | null, entries: { socket: import('socket.io').Socket, payload: object }[] }>} buckets
 * @param {string} key
 * @param {boolean} compact
 */
function flushBucket(buckets, key, compact) {
  const b = buckets.get(key);
  if (!b) {
    return;
  }
  buckets.delete(key);
  if (b.timer != null) {
    clearTimeout(b.timer);
    b.timer = null;
  }
  const entries = b.entries;
  if (!entries.length) {
    return;
  }
  const roomName = key.split('\0')[0];
  const sock = entries[0].socket;
  if (entries.length === 1) {
    const raw = entries[0].payload;
    if (compact) {
      sock.to(roomName).emit('new-message', { __compact: true, ...compactForWire(raw) });
    } else {
      sock.to(roomName).emit('new-message', raw);
    }
    return;
  }
  const sameSocket = entries.every((e) => e.socket.id === sock.id);
  if (!sameSocket) {
    for (const e of entries) {
      const raw = e.payload;
      if (compact) {
        e.socket.to(roomName).emit('new-message', { __compact: true, ...compactForWire(raw) });
      } else {
        e.socket.to(roomName).emit('new-message', raw);
      }
    }
    return;
  }
  sock.to(roomName).emit('new-message', {
    __batch: true,
    ...(compact && { __compact: true }),
    messages: compact ? entries.map((e) => compactForWire(e.payload)) : entries.map((e) => e.payload),
  });
  logger.debug({
    event: 'socket_message_manager_flush',
    room: roomName,
    count: entries.length,
    compact,
  });
}

/**
 * @param {import('socket.io').Server} _io
 */
function createMessageBroadcaster(_io) {
  const batchMs = parseInt(process.env.SOCKET_BROADCAST_BATCH_MS, 10);
  const batchSizeEnv = parseInt(process.env.SOCKET_BROADCAST_BATCH_SIZE, 10);
  const batchSizeMax = Number.isFinite(batchSizeEnv) && batchSizeEnv > 0 ? batchSizeEnv : 10;
  const enabled = Number.isFinite(batchMs) && batchMs > 0;
  const compact =
    process.env.SOCKET_MESSAGE_COMPACT === '1' ||
    String(process.env.SOCKET_MESSAGE_COMPACT || '').toLowerCase() === 'true';

  if (!enabled) {
    return {
      emitChatMessage(socket, room, payload) {
        socket.to(room).emit('new-message', payload);
      },
      shutdown() {},
    };
  }

  /** @type {Map<string, { timer: ReturnType<typeof setTimeout> | null, entries: { socket: import('socket.io').Socket, payload: object }[] }>} */
  const buckets = new Map();

  function bucketKey(room, socketId) {
    return `${room}\0${socketId}`;
  }

  return {
    emitChatMessage(socket, room, payload) {
      const key = bucketKey(room, socket.id);
      let b = buckets.get(key);
      if (!b) {
        b = { entries: [], timer: null };
        buckets.set(key, b);
      }
      b.entries.push({ socket, payload });

      if (b.entries.length >= batchSizeMax) {
        if (b.timer != null) {
          clearTimeout(b.timer);
          b.timer = null;
        }
        flushBucket(buckets, key, compact);
        return;
      }

      if (b.timer == null) {
        b.timer = setTimeout(() => {
          const cur = buckets.get(key);
          if (cur) {
            cur.timer = null;
          }
          flushBucket(buckets, key, compact);
        }, batchMs);
      }
    },
    shutdown() {
      for (const key of [...buckets.keys()]) {
        flushBucket(buckets, key, compact);
      }
    },
  };
}

module.exports = {
  createMessageBroadcaster,
  BufferPool,
  compactForWire,
};
