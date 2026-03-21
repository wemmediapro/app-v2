const { getApiPathSuffix } = require('../../../src/lib/apiPath');

describe('getApiPathSuffix', () => {
  it('strip /api/v1 from full path', () => {
    expect(getApiPathSuffix('/api/v1/movies')).toBe('/movies');
    expect(getApiPathSuffix('/api/v1/health/ready')).toBe('/health/ready');
  });
  it('strip /api (legacy) from full path', () => {
    expect(getApiPathSuffix('/api/movies')).toBe('/movies');
    expect(getApiPathSuffix('/api/health')).toBe('/health');
  });
  it('strip /v1 when path is relative to /api mount', () => {
    expect(getApiPathSuffix('/v1/movies')).toBe('/movies');
    expect(getApiPathSuffix('/movies')).toBe('/movies');
  });
});
