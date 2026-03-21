/**
 * Monitoring driver MongoDB : hooks commandSucceeded / commandFailed.
 */
process.env.MONGODB_QUERY_MONITOR = '1';
process.env.MONGODB_SLOW_QUERY_MS = '10';

jest.mock('../../../src/lib/logger', () => ({
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
}));

const logger = require('../../../src/lib/logger');
const {
  startMongoQueryMonitoring,
  stopMongoQueryMonitoring,
  getMongoQueryMonitorStats,
} = require('../../../src/lib/mongo-query-monitor');

describe('mongo-query-monitor', () => {
  afterEach(() => {
    stopMongoQueryMonitoring();
    jest.clearAllMocks();
  });

  it('enregistre une commande lente (≥ seuil)', () => {
    const handlers = {};
    const client = {
      on(ev, fn) {
        handlers[ev] = fn;
      },
      off(ev, fn) {
        if (handlers[ev] === fn) {
          delete handlers[ev];
        }
      },
    };
    const connection = { getClient: () => client };

    startMongoQueryMonitoring(connection);
    handlers.commandSucceeded({
      commandName: 'find',
      duration: 500,
      databaseName: 'gnv_onboard',
      address: 'localhost:27017',
    });

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'mongodb_slow_command',
        commandName: 'find',
        durationMs: 500,
      })
    );
  });

  it('ignore les commandes bruit (hello)', () => {
    const handlers = {};
    const client = {
      on(ev, fn) {
        handlers[ev] = fn;
      },
      off() {},
    };
    startMongoQueryMonitoring({ getClient: () => client });
    handlers.commandSucceeded({
      commandName: 'hello',
      duration: 9999,
      databaseName: 'admin',
    });
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('log les échecs de commande', () => {
    const handlers = {};
    const client = {
      on(ev, fn) {
        handlers[ev] = fn;
      },
      off() {},
    };
    startMongoQueryMonitoring({ getClient: () => client });
    handlers.commandFailed({
      commandName: 'find',
      databaseName: 'gnv_onboard',
      failure: new Error('mock fail'),
    });
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'mongodb_command_failed',
        commandName: 'find',
      })
    );
  });

  it('getMongoQueryMonitorStats expose le seuil', () => {
    const s = getMongoQueryMonitorStats();
    expect(s.enabled).toBe(true);
    expect(s.slowThresholdMs).toBe(10);
  });
});
