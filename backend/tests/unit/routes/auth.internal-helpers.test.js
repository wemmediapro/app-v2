/**
 * Helpers internes auth.js exposés seulement si NODE_ENV=test.
 */
const authRouter = require('../../../src/routes/auth');

describe('auth routes — helpers test (__testGetAdminPasswordHash)', () => {
  it('retourne null si adminPassword est absent', async () => {
    expect(authRouter.__testGetAdminPasswordHash).toBeDefined();
    expect(await authRouter.__testGetAdminPasswordHash('')).toBeNull();
    expect(await authRouter.__testGetAdminPasswordHash(null)).toBeNull();
  });
});
