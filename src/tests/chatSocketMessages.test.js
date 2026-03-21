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

  it('réhydrate un message compact seul', () => {
    const prev = [];
    const next = appendIncomingSocketMessages(prev, {
      __compact: true,
      r: 'chat:1_2',
      c: 'hello',
      u: 'u9',
      ts: 1700000000000,
      cs: 'abc',
    });
    expect(next).toHaveLength(1);
    expect(next[0].content).toBe('hello');
    expect(next[0].senderId).toBe('u9');
    expect(next[0].clientSyncId).toBe('abc');
    expect(next[0].timestamp).toBeInstanceOf(Date);
  });

  it('réhydrate un batch de messages compacts', () => {
    const prev = [];
    const incoming = {
      __batch: true,
      messages: [
        { r: 'chat:x', c: 'a', u: '1', ts: 1000 },
        { r: 'chat:x', c: 'b', u: '2', ts: 2000 },
      ],
    };
    const next = appendIncomingSocketMessages(prev, incoming);
    expect(next).toHaveLength(2);
    expect(next[0].text).toBe('a');
    expect(next[1].senderId).toBe('2');
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
