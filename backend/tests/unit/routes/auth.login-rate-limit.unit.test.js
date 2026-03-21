/**
 * getLoginRateLimitMax() — même logique que le rate limiter login (routes/auth).
 */
const authRouter = require('../../../src/routes/auth');

describe('getLoginRateLimitMax (__test)', () => {
  const orig = process.env.LOGIN_RATE_LIMIT_MAX;

  afterEach(() => {
    if (orig === undefined) delete process.env.LOGIN_RATE_LIMIT_MAX;
    else process.env.LOGIN_RATE_LIMIT_MAX = orig;
  });

  it('5 si variable absente ou NaN', () => {
    delete process.env.LOGIN_RATE_LIMIT_MAX;
    expect(authRouter.__testGetLoginRateLimitMax()).toBe(5);
    process.env.LOGIN_RATE_LIMIT_MAX = 'not-a-number';
    expect(authRouter.__testGetLoginRateLimitMax()).toBe(5);
  });

  it('parse la valeur numérique', () => {
    process.env.LOGIN_RATE_LIMIT_MAX = '42';
    expect(authRouter.__testGetLoginRateLimitMax()).toBe(42);
  });

  it('0 ou chaîne "0" → repli 5 (falsy)', () => {
    process.env.LOGIN_RATE_LIMIT_MAX = '0';
    expect(authRouter.__testGetLoginRateLimitMax()).toBe(5);
  });
});
