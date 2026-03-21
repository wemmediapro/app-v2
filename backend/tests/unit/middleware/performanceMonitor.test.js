const {
  createSlowRequestLoggerMiddleware,
  getPerformanceMonitorStats,
} = require('../../../src/middleware/performanceMonitor');

describe('performanceMonitor', () => {
  it('getPerformanceMonitorStats expose des compteurs numériques', () => {
    const s = getPerformanceMonitorStats();
    expect(typeof s.slowCount).toBe('number');
    expect(typeof s.totalFinished).toBe('number');
    expect(typeof s.slowRequestMs).toBe('number');
    expect(s.slowRequestMs).toBeGreaterThan(0);
  });

  it('createSlowRequestLoggerMiddleware retourne une fonction', () => {
    expect(typeof createSlowRequestLoggerMiddleware()).toBe('function');
  });
});
