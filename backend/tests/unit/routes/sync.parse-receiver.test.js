/**
 * parseReceiverFromChatRoom — garde initiale (room / myUserId).
 */
const syncRouter = require('../../../src/routes/sync');

describe('sync parseReceiverFromChatRoom (__testParseReceiver)', () => {
  const parse = syncRouter.__testParseReceiver;
  const uid = '507f1f77bcf86cd799439011';

  it('null si room vide ou myUserId absent', () => {
    expect(parse).toBeDefined();
    expect(parse('', uid)).toBeNull();
    expect(parse('chat:a_b', null)).toBeNull();
    expect(parse('chat:a_b', undefined)).toBeNull();
  });

  it('null si préfixe chat: absent ou format room invalide', () => {
    expect(parse('dm:a_b', uid)).toBeNull();
    expect(parse('chat:a_b_c', uid)).toBeNull();
    expect(parse('chat:seul', uid)).toBeNull();
  });
});
