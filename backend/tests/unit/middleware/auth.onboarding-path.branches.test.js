/**
 * isAdminTwoFactorOnboardingPath — branche (sub || '/') quand getApiPathSuffix retourne ''.
 */
const apiPath = require('../../../src/lib/apiPath');
const authMiddleware = require('../../../src/middleware/auth');

describe('__testIsAdminTwoFactorOnboardingPath', () => {
  const fn = authMiddleware.__testIsAdminTwoFactorOnboardingPath;

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sub falsy → pathOnly / (hors liste onboarding)', () => {
    jest.spyOn(apiPath, 'getApiPathSuffix').mockReturnValue('');
    expect(fn({ originalUrl: '/api/admin/x' })).toBe(false);
  });

  it('sub /auth/me → true', () => {
    jest.spyOn(apiPath, 'getApiPathSuffix').mockReturnValue('/auth/me');
    expect(fn({ originalUrl: '/api/v1/auth/me' })).toBe(true);
  });
});
