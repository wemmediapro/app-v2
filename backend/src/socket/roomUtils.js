/**
 * Autorisation des rooms Socket.io : un client ne peut rejoindre que des rooms qui le concernent.
 * - notifications:<userId> — uniquement si userId === socket.userId
 * - ship:<shipId> — uniquement si shipId === socket._shipId (handshake auth)
 * - chat:<idA>_<idB> — les deux ObjectIds valides, triés lexicographiquement ; le client doit être idA ou idB
 */
const mongoose = require('mongoose');

const PREFIXES = ['ship:', 'notifications:', 'chat:'];

/**
 * Nom canonique d’une room DM entre deux utilisateurs (même chaîne côté client et serveur).
 * @param {string} userIdA
 * @param {string} userIdB
 */
function chatDmRoomName(userIdA, userIdB) {
  const a = String(userIdA);
  const b = String(userIdB);
  if (!mongoose.Types.ObjectId.isValid(a) || !mongoose.Types.ObjectId.isValid(b)) {
    throw new Error('Invalid ObjectId for chat room');
  }
  return a < b ? `chat:${a}_${b}` : `chat:${b}_${a}`;
}

function hasAllowedPrefix(room) {
  return typeof room === 'string' && room.length > 0 && room.length <= 96 && PREFIXES.some((p) => room.startsWith(p));
}

/**
 * @param {import('socket.io').Socket} socket — doit avoir userId (JWT) et optionnellement _shipId
 * @param {string} room
 * @returns {boolean}
 */
function isRoomAuthorizedForUser(socket, room) {
  if (typeof room !== 'string' || room.length === 0 || room.length > 96) {return false;}
  if (!hasAllowedPrefix(room)) {return false;}

  const uid = socket.userId != null ? String(socket.userId) : '';
  if (!uid || !mongoose.Types.ObjectId.isValid(uid)) {return false;}

  if (room.startsWith('notifications:')) {
    const target = room.slice('notifications:'.length);
    return target === uid;
  }

  if (room.startsWith('ship:')) {
    const shipRoom = room.slice('ship:'.length);
    const sid = socket._shipId != null ? String(socket._shipId) : '';
    return sid.length > 0 && shipRoom === sid;
  }

  if (room.startsWith('chat:')) {
    const rest = room.slice('chat:'.length);
    const parts = rest.split('_');
    if (parts.length !== 2) {return false;}
    const [id1, id2] = parts;
    if (!mongoose.Types.ObjectId.isValid(id1) || !mongoose.Types.ObjectId.isValid(id2)) {return false;}
    return id1 === uid || id2 === uid;
  }

  return false;
}

module.exports = {
  chatDmRoomName,
  hasAllowedPrefix,
  isRoomAuthorizedForUser,
  PREFIXES,
};
