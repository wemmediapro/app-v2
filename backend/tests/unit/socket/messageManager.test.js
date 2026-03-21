const { BufferPool, compactForWire } = require('../../../src/socket/messageManager');

describe('messageManager.BufferPool', () => {
  it('acquire / release réutilise la même taille', () => {
    const pool = new BufferPool(128, 2);
    const a = pool.acquire();
    expect(a.length).toBe(128);
    pool.release(a);
    const b = pool.acquire();
    expect(b.length).toBe(128);
    pool.release(b);
    expect(pool.stats().inUse).toBe(0);
  });

  it('release ignore un buffer de mauvaise taille', () => {
    const pool = new BufferPool(64, 1);
    pool.release(Buffer.alloc(32));
    expect(pool.stats().pooled).toBe(1);
  });
});

describe('messageManager.compactForWire', () => {
  it('produit r,c,u,ts', () => {
    const c = compactForWire({
      room: 'chat:a_b',
      content: 'x',
      text: 'x',
      senderId: 'u1',
      sender: 'u1',
      timestamp: new Date(1000),
      clientSyncId: 'sync-1',
    });
    expect(c).toEqual({
      r: 'chat:a_b',
      c: 'x',
      u: 'u1',
      ts: 1000,
      cs: 'sync-1',
    });
  });
});
