/**
 * Service TOTP / codes de secours pour l’authentification à deux facteurs (admins).
 */
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');

const APP_NAME = process.env.TWO_FACTOR_ISSUER || process.env.TWO_FACTOR_APP_NAME || 'GNV OnBoard';

/**
 * Génère un secret TOTP (base32) + otpauth_url pour QR.
 * @param {string} email
 * @returns {import('speakeasy').GeneratedSecret}
 */
function generateTOTPSecret(email) {
  const label = email ? `admin:${email}` : 'admin';
  return speakeasy.generateSecret({
    name: label,
    issuer: APP_NAME,
    length: 32,
  });
}

/**
 * @param {string} otpauthUrl
 * @returns {Promise<string>} data URL PNG
 */
async function qrCodeDataUrl(otpauthUrl) {
  return QRCode.toDataURL(otpauthUrl, { errorCorrectionLevel: 'M', width: 256 });
}

/**
 * @param {number} [count=10]
 * @returns {string[]}
 */
function generateBackupCodes(count = 10) {
  const codes = [];
  for (let i = 0; i < count; i += 1) {
    codes.push(`${crypto.randomBytes(4).toString('hex')}-${crypto.randomBytes(4).toString('hex')}`);
  }
  return codes;
}

/**
 * @param {string[]} plainCodes
 * @returns {Promise<string[]>}
 */
async function hashBackupCodes(plainCodes) {
  return Promise.all(plainCodes.map((c) => bcrypt.hash(String(c), 10)));
}

/**
 * Vérifie un code TOTP à 6 chiffres.
 * @param {string} secretBase32
 * @param {string} token
 * @returns {boolean}
 */
function verifyTOTPToken(secretBase32, token) {
  if (!secretBase32 || token == null) {return false;}
  const clean = String(token).replace(/\s/g, '');
  if (!/^\d{6}$/.test(clean)) {return false;}
  return speakeasy.totp.verify({
    secret: secretBase32,
    encoding: 'base32',
    token: clean,
    window: parseInt(process.env.TOTP_WINDOW, 10) || 1,
  });
}

/**
 * Teste le code contre les hashes stockés (usage unique — retirer l’entrée après succès côté appelant).
 * @param {{ twoFactorBackupCodes?: string[] }} userDoc — hashes bcrypt
 * @param {string} token — code saisi (ex. format xxxxxxxx-xxxxxxxx)
 * @returns {Promise<{ valid: boolean, index?: number }>}
 */
async function validateBackupCode(userDoc, token) {
  const hashes = userDoc.twoFactorBackupCodes;
  if (!Array.isArray(hashes) || hashes.length === 0 || token == null) {return { valid: false };}
  const raw = String(token).replace(/\s/g, '');
  for (let i = 0; i < hashes.length; i += 1) {
    try {
      if (await bcrypt.compare(raw, hashes[i])) {
        return { valid: true, index: i };
      }
    } catch (_) {
      /* ignore */
    }
  }
  return { valid: false };
}

module.exports = {
  generateTOTPSecret,
  qrCodeDataUrl,
  generateBackupCodes,
  hashBackupCodes,
  verifyTOTPToken,
  validateBackupCode,
  TWO_FACTOR_APP_NAME: APP_NAME,
};
