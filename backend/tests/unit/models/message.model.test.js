const Message = require('../../../src/models/Message');
const { messageValid } = require('../../fixtures');

describe('Message model', () => {
  it('rejette sans sender / receiver / content', () => {
    const m = new Message({});
    const err = m.validateSync();
    expect(err.errors.sender).toBeDefined();
    expect(err.errors.receiver).toBeDefined();
    expect(err.errors.content).toBeDefined();
  });

  it('accepte un message texte valide', () => {
    const m = new Message(messageValid);
    expect(m.validateSync()).toBeUndefined();
  });

  it('rejette content > 1000 caractères', () => {
    const m = new Message({
      ...messageValid,
      content: 'x'.repeat(1001),
    });
    const err = m.validateSync();
    expect(err.errors.content).toBeDefined();
  });

  it('type enum', () => {
    const m = new Message({
      ...messageValid,
      type: 'video',
    });
    const err = m.validateSync();
    expect(err.errors.type).toBeDefined();
  });

  it('définit des index sender+receiver+createdAt et receiver+isRead', () => {
    const idx = Message.schema.indexes().map((x) => JSON.stringify(x[0]));
    expect(idx.some((s) => s.includes('sender') && s.includes('receiver'))).toBe(true);
    expect(idx.some((s) => s.includes('clientSyncId'))).toBe(true);
  });

  it('timestamps activés', () => {
    expect(Message.schema.options.timestamps).toBe(true);
  });
});
