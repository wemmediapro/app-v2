const jwt = require('jsonwebtoken');

/**
 * Verifies the strength of the JWT secret key.
 * @param {string} secret - The JWT secret to validate.
 * @returns {boolean} - Returns true if the secret is strong, otherwise false.
 */
function verifyJWTSecretStrength(secret) {
  const minLength = 32; // Minimum length for a strong secret
  return typeof secret === 'string' && secret.length >= minLength;
}

/**
 * Validates admin credentials configuration.
 * @param {Object} credentials - The admin credentials object.
 * @returns {boolean} - Returns true if credentials are valid, otherwise false.
 */
function validateAdminCredentials(credentials) {
  if (!credentials || typeof credentials !== 'object') {
    return false;
  }
  const { username, password } = credentials;
  return typeof username === 'string' && typeof password === 'string' && password.length >= 8;
}

/**
 * Logs the results of security validation.
 * @param {string} message - The log message to record.
 * @param {boolean} status - The status of the validation.
 */
function logSecurityValidationResults(message, status) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}: ${status}`);
}

module.exports = { verifyJWTSecretStrength, validateAdminCredentials, logSecurityValidationResults };
