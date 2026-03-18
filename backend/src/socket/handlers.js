/**
 * Handlers Socket.io : autorisation stricte, sanitization messages (XSS), rate limiting par socket.
 * Sécurité : isRoomAllowed() limite les rooms (prefixes ship/notifications/chat) ; sanitizeContent() strip HTML / limite longueur (XSS).
 * C6 : rate limit send-message 60 msg/min/socket (flood), compteur nettoyé au disconnect.
 * Protection flood globale : max SOCKET_RATE_LIMIT_MAX événements par socket par fenêtre (ex. 1h) pour join-room + send-message.
 */
const logger = require('../lib/logger');

const ALLOWED_ROOM_PREFIXES = ['ship:', 'notifications:', 'chat:'];
const MAX_MESSAGE_LENGTH = 5000;

// C6 : rate limit strict send-message — 60 msg/min/socket (configurable)
const SEND_MESSAGE_RATE_WINDOW_MS = parseInt(process.env.SOCKET_SEND_MESSAGE_WINDOW_MS, 10) || 60 * 1000; // 1 min
const SEND_MESSAGE_RATE_MAX = parseInt(process.env.SOCKET_SEND_MESSAGE_MAX, 10) || 60;
const socketSendMessageCounts = new Map(); // socketId -> { count, resetAt }

// Rate limit global par socket (join-room + send-message)
const SOCKET_RATE_WINDOW_MS = parseInt(process.env.SOCKET_RATE_WINDOW_MS, 10) || 60 * 60 * 1000; // 1h
const SOCKET_RATE_MAX = parseInt(process.env.SOCKET_RATE_LIMIT_MAX, 10) || 1000;
const socketEventCounts = new Map(); // socketId -> { count, resetAt }

function checkSendMessageRateLimit(socket) {
  let rec = socketSendMessageCounts.get(socket.id);
  const now = Date.now();
  if (!rec || now >= rec.resetAt) {
    rec = { count: 0, resetAt: now + SEND_MESSAGE_RATE_WINDOW_MS };
    socketSendMessageCounts.set(socket.id, rec);
  }
  rec.count++;
  if (rec.count > SEND_MESSAGE_RATE_MAX) {
    logger.warn({ event: 'socket_send_message_rate_limit_exceeded', socketId: socket.id, count: rec.count, max: SEND_MESSAGE_RATE_MAX });
    socket.disconnect(true);
    return false;
  }
  return true;
}

function checkSocketRateLimit(socket) {
  let rec = socketEventCounts.get(socket.id);
  const now = Date.now();
  if (!rec || now >= rec.resetAt) {
    rec = { count: 0, resetAt: now + SOCKET_RATE_WINDOW_MS };
    socketEventCounts.set(socket.id, rec);
  }
  rec.count++;
  if (rec.count > SOCKET_RATE_MAX) {
    logger.warn({ event: 'socket_rate_limit_exceeded', socketId: socket.id, count: rec.count, max: SOCKET_RATE_MAX });
    socket.disconnect(true);
    return false;
  }
  return true;
}

/** C6 : nettoyer tous les compteurs au disconnect. */
function clearSocketRateLimit(socketId) {
  socketEventCounts.delete(socketId);
  socketSendMessageCounts.delete(socketId);
}

function isRoomAllowed(room) {
  if (typeof room !== 'string' || room.length > 64) return false;
  return ALLOWED_ROOM_PREFIXES.some((prefix) => room.startsWith(prefix));
}

/** Sanitize contenu (XSS) : strip HTML, limite longueur. En Node sans DOMPurify. */
function sanitizeContent(str) {
  if (str == null) return '';
  const s = String(str).replace(/<[^>]*>/g, '').trim();
  return s.slice(0, MAX_MESSAGE_LENGTH);
}

/** Applique les handlers sur une instance io déjà authentifiée. */
function attachSocketHandlers(io, connectionCounters) {
  io.on('connection', (socket) => {
    const user = socket.user;
    if (user) {
      socket.userId = user.id || user._id;
      socket.userRole = user.role;
    }

    const shipId = socket._shipId || (connectionCounters && connectionCounters.getShipId(socket));
    if (connectionCounters) connectionCounters.increment();

    logger.info({
      event: 'socket_connect',
      socketId: socket.id,
      userId: socket.userId,
      role: socket.userRole,
      shipId,
    });

    socket.on('join-room', (room, cb) => {
      if (!checkSocketRateLimit(socket)) return;
      if (!isRoomAllowed(room)) {
        if (typeof cb === 'function') cb(new Error('Invalid room'));
        return;
      }
      socket.join(room);
      if (typeof cb === 'function') cb();
      logger.debug({ event: 'socket_join_room', socketId: socket.id, room });
    });

    socket.on('send-message', (data, cb) => {
      if (!checkSocketRateLimit(socket)) return;
      if (!checkSendMessageRateLimit(socket)) return; // C6 : 60 msg/min/socket
      if (!data || !isRoomAllowed(data.room)) {
        if (typeof cb === 'function') cb(new Error('Invalid room'));
        return;
      }
      if (!socket.rooms.has(data.room)) {
        if (typeof cb === 'function') cb(new Error('Not in room'));
        return;
      }
      const content = sanitizeContent(data.content ?? data.text);
      if (content.length === 0 && !data.attachment) {
        if (typeof cb === 'function') cb(new Error('Empty message'));
        return;
      }
      const payload = {
        room: data.room,
        content,
        text: content,
        senderId: socket.userId,
        sender: socket.userId,
        timestamp: new Date(),
        ...(data.attachment && { attachment: sanitizeContent(data.attachment) }),
      };
      socket.to(data.room).emit('new-message', payload);
      if (typeof cb === 'function') cb(null, payload);
    });

    socket.on('disconnect', () => {
      clearSocketRateLimit(socket.id);
      if (connectionCounters) connectionCounters.decrement();
      logger.info({ event: 'socket_disconnect', socketId: socket.id });
    });
  });
}

module.exports = { attachSocketHandlers, isRoomAllowed, sanitizeContent, checkSocketRateLimit, checkSendMessageRateLimit, clearSocketRateLimit };
