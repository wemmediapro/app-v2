/**
 * Logique partagée : quand ignorer le rate limit API global et le rate limit par endpoint.
 */
function createApiRateLimitSkip({ getApiPathSuffix, jwtAdminSkipCache, config }) {
  const isLocalLoopbackIp = (req) => {
    const raw = req.ip || req.socket?.remoteAddress || '';
    const ip = String(raw).replace(/^::ffff:/i, '');
    return ip === '127.0.0.1' || ip === '::1' || ip === 'localhost';
  };

  return function skipApiRateLimit(req) {
    const p = getApiPathSuffix(req.path || '').toLowerCase();
    if (p === '/health' || p.startsWith('/health/') || p === '/time') {
      return true;
    }
    if (p.startsWith('/stream') || p.startsWith('/upload') || p.startsWith('/media-library')) {
      return true;
    }
    if (process.env.NODE_ENV !== 'production' && process.env.RATE_LIMIT_LOCALHOST !== '0' && isLocalLoopbackIp(req)) {
      return true;
    }
    try {
      const token = req.get('Authorization')?.replace('Bearer ', '') || req.cookies?.authToken;
      if (token && config.jwt?.secret && jwtAdminSkipCache.isAdminVerified(token, config.jwt.secret)) {
        return true;
      }
    } catch {
      /* ignore */
    }
    return false;
  };
}

module.exports = { createApiRateLimitSkip };
