/**
 * Protection CSRF (double-submit cookie).
 * Pas de dépendance csurf (dépréciée). Cookie csrfToken + header X-CSRF-Token requis sur mutations.
 */
const crypto = require('crypto');

const COOKIE_NAME = 'csrfToken';
const HEADER_NAME = 'x-csrf-token';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Comparaison constant-time des tokens CSRF (double-submit).
 * - N'utilise pas !== / == sur les chaînes (fuite timing).
 * - Si les longueurs diffèrent, on effectue quand même un timingSafeEqual factice
 *   pour ne pas exposer la longueur attendue par le temps de réponse.
 */
function csrfTokensEqual(cookieToken, headerToken) {
  if (cookieToken == null || headerToken == null) {return false;}
  if (typeof cookieToken !== 'string' || typeof headerToken !== 'string') {return false;}
  const bufCookie = Buffer.from(cookieToken, 'utf8');
  const bufHeader = Buffer.from(headerToken, 'utf8');
  if (bufCookie.length !== bufHeader.length) {
    crypto.timingSafeEqual(Buffer.alloc(32), Buffer.alloc(32));
    return false;
  }
  return crypto.timingSafeEqual(bufCookie, bufHeader);
}

function getToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Middleware : envoie un cookie CSRF si absent (pour SPA).
 * À monter après cookieParser.
 */
function csrfCookie(req, res, next) {
  if (!req.cookies[COOKIE_NAME]) {
    const token = getToken();
    const isSecure = process.env.NODE_ENV === 'production' && (
      req.get('X-Forwarded-Proto') === 'https' || req.secure
    );
    res.cookie(COOKIE_NAME, token, {
      httpOnly: false,
      secure: isSecure,
      sameSite: isSecure ? 'strict' : 'lax',
      maxAge: 24 * 60 * 60 * 1000,
      path: '/',
    });
    req.csrfToken = token;
  } else {
    req.csrfToken = req.cookies[COOKIE_NAME];
  }
  next();
}

/** Chemins exemptés (login/register avant que le client n'ait le cookie ; logout sans token) */
const EXEMPT_PATHS = [
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/logout',
  '/auth/2fa/complete-login',
];

/** Patterns exemptés : tracking public (impressions, clics, listeners) — pas d’auth, pas de CSRF */
/** Exemptions = tracking public only. Do not add write/admin/personal data routes. */
const EXEMPT_PATH_PATTERNS = [
  /^\/banners\/[^/]+\/impression$/,
  /^\/banners\/[^/]+\/click$/,
  /^\/ads\/[^/]+\/impression$/,
  /^\/radio\/[^/]+\/listeners$/,
];

/**
 * Middleware : vérifie le token CSRF sur les méthodes non safe.
 * À monter sur les routes API qui modifient des données.
 */
function csrfProtection(req, res, next) {
  if (SAFE_METHODS.has(req.method)) {return next();}
  // originalUrl = path + query ; path peut être relatif au mount (/api) selon Express
  const raw = (req.originalUrl || req.url || req.path || '').split('?')[0];
  const path = raw.replace(/^\/api\/?/, '/') || '/';
  if (EXEMPT_PATHS.some((p) => path === p || path.startsWith(p + '/'))) {return next();}
  if (EXEMPT_PATH_PATTERNS.some((re) => re.test(path))) {return next();}
  const cookieToken = req.cookies[COOKIE_NAME];
  const headerToken = req.get(HEADER_NAME) || req.body?._csrf;
  if (!csrfTokensEqual(cookieToken, headerToken)) {
    return res.status(403).json({ success: false, message: 'Invalid CSRF token', code: 'CSRF_INVALID' });
  }
  next();
}

module.exports = {
  csrfCookie,
  csrfProtection,
  getToken,
  csrfTokensEqual,
  COOKIE_NAME,
  HEADER_NAME,
};
