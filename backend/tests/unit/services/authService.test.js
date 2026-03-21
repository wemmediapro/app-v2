const speakeasy = require('speakeasy');
const authService = require('../../../src/services/authService');

describe('authService (TOTP / backup codes)', () => {
  it('generateBackupCodes retourne 10 codes', () => {
    const codes = authService.generateBackupCodes(10);
    expect(codes).toHaveLength(10);
    codes.forEach((c) => expect(c).toMatch(/^[a-f0-9]+-[a-f0-9]+$/));
  });

  it('verifyTOTPToken accepte un code valide', () => {
    const secret = speakeasy.generateSecret({ length: 20 });
    const token = speakeasy.totp({ secret: secret.base32, encoding: 'base32' });
    expect(authService.verifyTOTPToken(secret.base32, token)).toBe(true);
  });

  it('verifyTOTPToken refuse un code invalide', () => {
    const secret = speakeasy.generateSecret({ length: 20 });
    expect(authService.verifyTOTPToken(secret.base32, '000000')).toBe(false);
  });

  it('validateBackupCode : code valide une fois, index retourné', async () => {
    const plain = ['aaaa-bbbb-cccc-dddd'];
    const hashes = await authService.hashBackupCodes(plain);
    const doc = { twoFactorBackupCodes: hashes };
    const r1 = await authService.validateBackupCode(doc, 'aaaa-bbbb-cccc-dddd');
    expect(r1.valid).toBe(true);
    expect(typeof r1.index).toBe('number');
  });

  it('validateBackupCode : même code ne matche pas deux hashes différents après retrait simulé', async () => {
    const plain = authService.generateBackupCodes(2);
    const hashes = await authService.hashBackupCodes(plain);
    const doc = { twoFactorBackupCodes: [...hashes] };
    const r1 = await authService.validateBackupCode(doc, plain[0]);
    expect(r1.valid).toBe(true);
    doc.twoFactorBackupCodes.splice(r1.index, 1);
    const r2 = await authService.validateBackupCode(doc, plain[0]);
    expect(r2.valid).toBe(false);
  });

  it('hashBackupCodes produit des hashes distincts', async () => {
    const plain = ['code-one-aaaa', 'code-two-bbbb'];
    const hashes = await authService.hashBackupCodes(plain);
    expect(hashes[0]).not.toBe(hashes[1]);
  });
});
