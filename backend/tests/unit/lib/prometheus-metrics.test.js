describe('prometheus-metrics', () => {
  const OLD = process.env.PROMETHEUS_METRICS_ENABLED;

  afterEach(() => {
    process.env.PROMETHEUS_METRICS_ENABLED = OLD;
    jest.resetModules();
  });

  it('désactivé par défaut', () => {
    delete process.env.PROMETHEUS_METRICS_ENABLED;
    const { isPrometheusMetricsEnabled } = require('../../../src/lib/prometheus-metrics');
    expect(isPrometheusMetricsEnabled()).toBe(false);
  });

  it('activé avec PROMETHEUS_METRICS_ENABLED=1', () => {
    process.env.PROMETHEUS_METRICS_ENABLED = '1';
    const { isPrometheusMetricsEnabled } = require('../../../src/lib/prometheus-metrics');
    expect(isPrometheusMetricsEnabled()).toBe(true);
  });
});
