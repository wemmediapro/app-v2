// Middleware pour gérer les langues dans le backend
const supportedLanguages = ['fr', 'en', 'ar', 'es', 'it', 'de'];
const defaultLanguage = 'fr';

const languageMiddleware = (req, res, next) => {
  // Récupérer la langue depuis :
  // 1. Header Accept-Language
  // 2. Query parameter ?lang=
  // 3. Cookie
  // 4. Défaut: français

  let language = defaultLanguage;

  // Vérifier le header Accept-Language
  const acceptLanguage = req.headers['accept-language'];
  if (acceptLanguage) {
    const preferredLang = acceptLanguage.split(',')[0].split('-')[0].toLowerCase();
    if (supportedLanguages.includes(preferredLang)) {
      language = preferredLang;
    }
  }

  // Vérifier le paramètre de requête (lang peut être une string ou un tableau)
  const queryLang = req.query.lang;
  const langStr = Array.isArray(queryLang) ? queryLang[0] : queryLang;
  if (langStr && typeof langStr === 'string' && supportedLanguages.includes(langStr.toLowerCase())) {
    language = langStr.toLowerCase();
  }

  // Vérifier le cookie
  if (req.cookies && req.cookies.language && supportedLanguages.includes(req.cookies.language)) {
    language = req.cookies.language;
  }

  // Ajouter la langue à la requête
  req.language = language;
  res.setHeader('Content-Language', language);

  next();
};

module.exports = languageMiddleware;
