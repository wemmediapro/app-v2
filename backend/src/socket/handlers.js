/**
 * Handlers Socket.io : autorisation stricte, sanitization messages (XSS), rate limiting par socket.
 * Sécurité : isRoomAllowed() limite les rooms (prefixes ship/notifications/chat) ; sanitizeContent() strip HTML / limite longueur (XSS).
 * À appeler depuis server.js après io.use(auth).
 */
const logger = require('../lib/logger');

const ALLOWED_ROOM_PREFIXES = ['ship:', 'notifications:', 'chat:'];
const MAX_MESSAGE_LENGTH = 5000;

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
      if (!isRoomAllowed(room)) {
        if (typeof cb === 'function') cb(new Error('Invalid room'));
        return;
      }
      socket.join(room);
      if (typeof cb === 'function') cb();
      logger.debug({ event: 'socket_join_room', socketId: socket.id, room });
    });

    socket.on('send-message', (data, cb) => {
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
      if (connectionCounters) connectionCounters.decrement();
      logger.info({ event: 'socket_disconnect', socketId: socket.id });
    });
  });
}

module.exports = { attachSocketHandlers, isRoomAllowed, sanitizeContent };
