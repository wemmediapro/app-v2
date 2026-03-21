/**
 * Pool MongoDB : options par défaut, monitoring CMAP simulé.
 */
jest.mock('../../../src/lib/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
}));

const { EventEmitter } = require('events');

describe('mongoose-connection', () => {
  const origMax = process.env.MONGODB_MAX_POOL_SIZE;
  const origMin = process.env.MONGODB_MIN_POOL_SIZE;

  afterEach(() => {
    if (origMax === undefined) delete process.env.MONGODB_MAX_POOL_SIZE;
    else process.env.MONGODB_MAX_POOL_SIZE = origMax;
    if (origMin === undefined) delete process.env.MONGODB_MIN_POOL_SIZE;
    else process.env.MONGODB_MIN_POOL_SIZE = origMin;
    jest.resetModules();
  });

  it('buildMongoPoolOptions : défaut 20 / 10', () => {
    delete process.env.MONGODB_MAX_POOL_SIZE;
    delete process.env.MONGODB_MIN_POOL_SIZE;
    const { buildMongoPoolOptions } = require('../../../src/lib/mongoose-connection');
    expect(buildMongoPoolOptions()).toEqual({ maxPoolSize: 20, minPoolSize: 10 });
  });

  it('buildMongoPoolOptions : respecte env et borne min ≤ max', () => {
    process.env.MONGODB_MAX_POOL_SIZE = '5';
    process.env.MONGODB_MIN_POOL_SIZE = '20';
    const { buildMongoPoolOptions } = require('../../../src/lib/mongoose-connection');
    const o = buildMongoPoolOptions();
    expect(o.maxPoolSize).toBe(5);
    expect(o.minPoolSize).toBe(5);
  });

  it('startMongoPoolMonitoring + événements CMAP → métriques checkedOut', () => {
    jest.useFakeTimers();
    const logger = require('../../../src/lib/logger');
    const client = new EventEmitter();
    const conn = { getClient: () => client };
    const {
      startMongoPoolMonitoring,
      stopMongoPoolMonitoring,
      getMongoPoolMetrics,
    } = require('../../../src/lib/mongoose-connection');

    startMongoPoolMonitoring(conn, { maxPoolSize: 10 });
    client.emit('connectionCheckOutStarted');
    client.emit('connectionCheckedOut');
    expect(getMongoPoolMetrics().checkedOut).toBe(1);

    client.emit('connectionCheckedIn');
    expect(getMongoPoolMetrics().checkedOut).toBe(0);

    client.emit('connectionCheckOutStarted');
    client.emit('connectionCheckOutFailed');
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'mongodb_connection_checkout_failed' })
    );

    stopMongoPoolMonitoring();
    jest.useRealTimers();
  });

  it('alerte pool > 90 % : warn throttlé (cooldown)', () => {
    jest.useFakeTimers();
    process.env.MONGODB_POOL_ALERT_COOLDOWN_MS = '0';
    process.env.MONGODB_POOL_MONITOR_INTERVAL_MS = '1000';
    jest.resetModules();
    const logger = require('../../../src/lib/logger');
    const client = new EventEmitter();
    const conn = { getClient: () => client };
    const mod = require('../../../src/lib/mongoose-connection');
    mod.startMongoPoolMonitoring(conn, { maxPoolSize: 10 });

    for (let i = 0; i < 10; i += 1) {
      client.emit('connectionCheckOutStarted');
      client.emit('connectionCheckedOut');
    }
    jest.advanceTimersByTime(2000);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'mongodb_pool_utilization_high' })
    );
    mod.stopMongoPoolMonitoring();
    jest.useRealTimers();
    delete process.env.MONGODB_POOL_ALERT_COOLDOWN_MS;
    delete process.env.MONGODB_POOL_MONITOR_INTERVAL_MS;
    jest.clearAllMocks();
  });
});
