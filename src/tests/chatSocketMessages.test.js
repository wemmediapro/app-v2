import { describe, it, expect } from 'vitest';
import { appendIncomingSocketMessages } from '../lib/chatSocketMessages';

describe('appendIncomingSocketMessages', () => {
  it('ajoute un message simple', () => {
    const prev = [{ id: 1, clientSyncId: 'a' }];
    const next = appendIncomingSocketMessages(prev, { id: 2, clientSyncId: 'b', content: 'hi' });
    expect(next).toHaveLength(2);
    expect(next[1].clientSyncId).toBe('b');
  });

  it('ignore un doublon clientSyncId', () => {
    const prev = [{ id: 1, clientSyncId: 'same' }];
    const next = appendIncomingSocketMessages(prev, { id: 99, clientSyncId: 'same', content: 'again' });
    expect(next).toEqual(prev);
  });

  it('déduplique dans un batch', () => {
    const prev = [];
    const incoming = {
      __batch: true,
      messages: [
        { clientSyncId: 'x', content: '1' },
        { clientSyncId: 'x', content: 'dup' },
        { clientSyncId: 'y', content: '2' },
      ],
    };
    const next = appendIncomingSocketMessages(prev, incoming);
    expect(next).toHaveLength(2);
    expect(next.map((m) => m.clientSyncId)).toEqual(['x', 'y']);
  });
});
