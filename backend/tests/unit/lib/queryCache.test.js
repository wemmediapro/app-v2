const { QueryCache, PREFIX, DEFAULT_TTL, hashQueryPart } = require('../../../src/lib/queryCache');

describe('queryCache', () => {
  test('hashQueryPart is stable and bounded', () => {
    expect(hashQueryPart('hello')).toBe(hashQueryPart('hello'));
    expect(hashQueryPart('hello')).toHaveLength(16);
    expect(hashQueryPart('a')).not.toBe(hashQueryPart('b'));
  });

  test('getCached runs query when Redis disconnected', async () => {
    const store = {
      isConnected: false,
      get: jest.fn(),
      set: jest.fn(),
      delPattern: jest.fn(),
    };
    const qc = new QueryCache(store);
    const q = jest.fn().mockResolvedValue({ ok: 1 });
    const out = await qc.getCached('restaurants:list:x', q);
    expect(out).toEqual({ ok: 1 });
    expect(q).toHaveBeenCalledTimes(1);
    expect(store.get).not.toHaveBeenCalled();
  });

  test('getCached returns cached value when hit', async () => {
    const store = {
      isConnected: true,
      get: jest.fn().mockResolvedValue({ cached: true }),
      set: jest.fn().mockResolvedValue(true),
      delPattern: jest.fn(),
    };
    const qc = new QueryCache(store);
    const q = jest.fn();
    const out = await qc.getCached('users:list:1:20:abc', q);
    expect(out).toEqual({ cached: true });
    expect(q).not.toHaveBeenCalled();
    expect(store.set).not.toHaveBeenCalled();
  });

  test('getCached uses statistics TTL for clés statistics:*', async () => {
    const store = {
      isConnected: true,
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(true),
      delPattern: jest.fn(),
    };
    const qc = new QueryCache(store);
    await qc.getCached('statistics:overview:v1', () => Promise.resolve({ ok: true }));
    expect(store.set).toHaveBeenCalledWith(`${PREFIX}statistics:overview:v1`, { ok: true }, DEFAULT_TTL.statistics);
  });

  test('getCached stores on miss and uses DEFAULT_TTL category', async () => {
    const store = {
      isConnected: true,
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(true),
      delPattern: jest.fn(),
    };
    const qc = new QueryCache(store);
    const q = jest.fn().mockResolvedValue([1, 2]);
    const out = await qc.getCached('messages:conversations:u1:0:50', q);
    expect(out).toEqual([1, 2]);
    expect(store.set).toHaveBeenCalledWith(`${PREFIX}messages:conversations:u1:0:50`, [1, 2], DEFAULT_TTL.messages);
  });

  test('getCached does not store null results', async () => {
    const store = {
      isConnected: true,
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(true),
      delPattern: jest.fn(),
    };
    const qc = new QueryCache(store);
    const q = jest.fn().mockResolvedValue(null);
    await qc.getCached('restaurants:byId:x:fr', q);
    expect(store.set).not.toHaveBeenCalled();
  });

  test('invalidate builds SCAN pattern', async () => {
    const store = {
      isConnected: true,
      get: jest.fn(),
      set: jest.fn(),
      delPattern: jest.fn().mockResolvedValue(3),
    };
    const qc = new QueryCache(store);
    const n = await qc.invalidate('restaurants');
    expect(n).toBe(3);
    expect(store.delPattern).toHaveBeenCalledWith(`${PREFIX}restaurants*`);
  });

  test('invalidate returns 0 when disconnected', async () => {
    const store = { isConnected: false, delPattern: jest.fn() };
    const qc = new QueryCache(store);
    expect(await qc.invalidate('x')).toBe(0);
    expect(store.delPattern).not.toHaveBeenCalled();
  });
});
