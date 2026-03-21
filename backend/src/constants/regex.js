/**
 * Expressions régulières précompilées (chemins chauds : validation, upload, cache, auth).
 * Évite de recréer des RegExp à chaque requête dans les closures / handlers.
 */

/** Téléphone (validation souple, alignée express-validator) */
const RE_PHONE_LOOSE = /^[+]?[\d\s\-()]+$/;

const RE_STRONG_PWD_UPPER = /[A-Z]/;
const RE_STRONG_PWD_LOWER = /[a-z]/;
const RE_STRONG_PWD_DIGIT = /[0-9]/;
const RE_STRONG_PWD_SYMBOL = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/;

/** Code TOTP / 2FA (6 chiffres) */
const RE_TOTP_SIX_DIGITS = /^\d{6}$/;

/** Nettoyage espaces TOTP */
const RE_WHITESPACE_ALL = /\s/g;

/** En-tête Content-Type image png/jpeg (filtre compression HTTP) */
const RE_IMAGE_PNG_JPEG_CT = /^image\/(png|jpe?g)(;|\s|$)/i;

/** Préfixe en-tête HTTP Range */
const RE_HTTP_RANGE_BYTES = /^bytes=/;

/** Multer / MIME — upload */
const RE_UPLOAD_VIDEO_MIME = /video\/(mp4|webm|ogg|quicktime|x-msvideo|mpeg)/;
const RE_UPLOAD_VIDEO_EXT = /\.(mp4|webm|ogg|mov|avi|mpeg|mpg)$/i;
const RE_UPLOAD_IMAGE_MIME = /image\/(jpeg|jpg|png|gif|webp)/;
const RE_UPLOAD_IMAGE_EXT = /\.(jpe?g|png|gif|webp)$/i;
const RE_UPLOAD_AUDIO_MIME = /audio\/(mpeg|mp3|wav|ogg|webm|x-wav)/;
const RE_UPLOAD_AUDIO_EXT = /\.(mp3|wav|ogg|m4a)$/i;
const RE_UPLOAD_IMAGE_EXT_STRICT = /\.(png|jpe?g|gif|webp)$/i;

/** Enfant — tranche d’âge « … ans » */
const RE_ENFANT_ANS_AT_END = /ans\s*$/i;
const RE_ENFANT_STRIP_ANS_SUFFIX = /\s*ans\s*$/i;

/** Cache réponse GET — suffixe API (voir getApiPathSuffix) */
const RE_CACHE_SUB_MOVIES = /^\/movies(\/|$)/;
const RE_CACHE_SUB_MAGAZINE = /^\/magazine(\/|$)/;
const RE_CACHE_SUB_RADIO = /^\/radio(\/|$)/;
const RE_CACHE_SUB_BANNERS = /^\/banners(\/|$)/;
const RE_CACHE_SUB_SHOP = /^\/shop(\/|$)/;
const RE_CACHE_SUB_RESTAURANTS = /^\/restaurants(\/|$)/;
const RE_CACHE_SUB_WEBTV = /^\/webtv(\/|$)/;
const RE_CACHE_SUB_ENFANT = /^\/enfant(\/|$)/;
const RE_CACHE_SUB_SHIPMAP = /^\/shipmap(\/|$)/;
const RE_CACHE_SUB_GNV = /^\/gnv(\/|$)/;

/** Échappement caractères spéciaux pour $regex MongoDB */
const RE_REGEX_METACHAR_ESCAPER = /[.*+?^${}()|[\]\\]/g;

module.exports = {
  RE_PHONE_LOOSE,
  RE_STRONG_PWD_UPPER,
  RE_STRONG_PWD_LOWER,
  RE_STRONG_PWD_DIGIT,
  RE_STRONG_PWD_SYMBOL,
  RE_TOTP_SIX_DIGITS,
  RE_WHITESPACE_ALL,
  RE_IMAGE_PNG_JPEG_CT,
  RE_HTTP_RANGE_BYTES,
  RE_UPLOAD_VIDEO_MIME,
  RE_UPLOAD_VIDEO_EXT,
  RE_UPLOAD_IMAGE_MIME,
  RE_UPLOAD_IMAGE_EXT,
  RE_UPLOAD_AUDIO_MIME,
  RE_UPLOAD_AUDIO_EXT,
  RE_UPLOAD_IMAGE_EXT_STRICT,
  RE_ENFANT_ANS_AT_END,
  RE_ENFANT_STRIP_ANS_SUFFIX,
  RE_CACHE_SUB_MOVIES,
  RE_CACHE_SUB_MAGAZINE,
  RE_CACHE_SUB_RADIO,
  RE_CACHE_SUB_BANNERS,
  RE_CACHE_SUB_SHOP,
  RE_CACHE_SUB_RESTAURANTS,
  RE_CACHE_SUB_WEBTV,
  RE_CACHE_SUB_ENFANT,
  RE_CACHE_SUB_SHIPMAP,
  RE_CACHE_SUB_GNV,
  RE_REGEX_METACHAR_ESCAPER,
};
