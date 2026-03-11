/**
 * Compteur de connexions Socket.io sur le serveur local (une seule instance).
 * La limite maxConnections est celle du serveur où tourne le backend (configurable au dashboard).
 */
let totalConnections = 0;

function getShipId(socket) {
  return socket.handshake?.auth?.shipId || socket.handshake?.query?.shipId || null;
}

function increment() {
  totalConnections += 1;
}

function decrement() {
  if (totalConnections > 0) totalConnections -= 1;
}

function getTotalCount() {
  return totalConnections;
}

module.exports = {
  getShipId,
  increment,
  decrement,
  getTotalCount
};
