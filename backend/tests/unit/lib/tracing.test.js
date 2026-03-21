describe('tracing (désactivé par défaut)', () => {
  const OLD = process.env.OTEL_ENABLED;

  afterEach(() => {
    if (OLD === undefined) delete process.env.OTEL_ENABLED;
    else process.env.OTEL_ENABLED = OLD;
    jest.resetModules();
  });

  it('isOtelEnabled false sans OTEL_ENABLED', () => {
    delete process.env.OTEL_ENABLED;
    const { isOtelEnabled, getTraceLogFields, getCustomMetrics } = require('../../../src/lib/tracing');
    expect(isOtelEnabled()).toBe(false);
    expect(getTraceLogFields()).toEqual({});
    expect(getCustomMetrics()).toBeNull();
  });

  it('runInActiveSpan exécute le callback sans span si OTEL inactif', () => {
    delete process.env.OTEL_ENABLED;
    const { runInActiveSpan } = require('../../../src/lib/tracing');
    let seen = null;
    runInActiveSpan('x', (span) => {
      seen = span;
    });
    expect(seen).toBeNull();
  });

  it('otelHttpCustomMetricsMiddleware appelle next sans planter', () => {
    delete process.env.OTEL_ENABLED;
    const { otelHttpCustomMetricsMiddleware } = require('../../../src/lib/tracing');
    const mw = otelHttpCustomMetricsMiddleware();
    const next = jest.fn();
    const req = { method: 'GET', path: '/x', route: undefined };
    const res = { statusCode: 200, on: jest.fn() };
    mw(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
