/**
 * Autorisation des rooms Socket.io (paire utilisateurs, notifications, ship).
 */
const mongoose = require('mongoose');
const { chatDmRoomName, isRoomAuthorizedForUser, hasAllowedPrefix } = require('../socket/roomUtils');

const ID_A = '507f1f77bcf86cd799439011';
const ID_B = '507f1f77bcf86cd799439012';

function mockSocket(userId, shipId = null) {
  return {
    userId,
    _shipId: shipId,
  };
}

describe('roomUtils', () => {
  describe('chatDmRoomName', () => {
    it('produit un nom stable trié', () => {
      const r1 = chatDmRoomName(ID_A, ID_B);
      const r2 = chatDmRoomName(ID_B, ID_A);
      expect(r1).toBe(r2);
      expect(r1).toBe(`chat:${ID_A}_${ID_B}`);
    });

    it('rejette des ids invalides', () => {
      expect(() => chatDmRoomName('bad', ID_B)).toThrow();
    });
  });

  describe('hasAllowedPrefix', () => {
    it('accepte les préfixes connus', () => {
      expect(hasAllowedPrefix(`chat:${ID_A}_${ID_B}`)).toBe(true);
      expect(hasAllowedPrefix(`notifications:${ID_A}`)).toBe(true);
      expect(hasAllowedPrefix('ship:gnv-1')).toBe(true);
    });
    it('refuse les rooms arbitraires', () => {
      expect(hasAllowedPrefix('room-foo')).toBe(false);
      expect(hasAllowedPrefix('general')).toBe(false);
    });
  });

  describe('isRoomAuthorizedForUser', () => {
    it('autorise chat si le user est un des deux participants', () => {
      const room = chatDmRoomName(ID_A, ID_B);
      expect(isRoomAuthorizedForUser(mockSocket(ID_A), room)).toBe(true);
      expect(isRoomAuthorizedForUser(mockSocket(ID_B), room)).toBe(true);
    });

    it('refuse un tiers dans la même room chat', () => {
      const room = chatDmRoomName(ID_A, ID_B);
      const other = new mongoose.Types.ObjectId().toString();
      expect(isRoomAuthorizedForUser(mockSocket(other), room)).toBe(false);
    });

    it('notifications: uniquement pour soi', () => {
      expect(isRoomAuthorizedForUser(mockSocket(ID_A), `notifications:${ID_A}`)).toBe(true);
      expect(isRoomAuthorizedForUser(mockSocket(ID_B), `notifications:${ID_A}`)).toBe(false);
    });

    it('ship: uniquement si shipId correspond', () => {
      expect(isRoomAuthorizedForUser(mockSocket(ID_A, 'ship-1'), 'ship:ship-1')).toBe(true);
      expect(isRoomAuthorizedForUser(mockSocket(ID_A, 'ship-2'), 'ship:ship-1')).toBe(false);
      expect(isRoomAuthorizedForUser(mockSocket(ID_A, null), 'ship:ship-1')).toBe(false);
    });
  });
});
