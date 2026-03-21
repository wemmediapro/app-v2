const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../../../src/models/User');
const { userValid } = require('../../fixtures');

describe('User model', () => {
  it('rejette sans prénom / nom / email / mot de passe', () => {
    const u = new User({});
    const err = u.validateSync();
    expect(err).toBeDefined();
    expect(err.errors.firstName).toBeDefined();
    expect(err.errors.lastName).toBeDefined();
    expect(err.errors.email).toBeDefined();
    expect(err.errors.password).toBeDefined();
  });

  it('rejette un email invalide', () => {
    const u = new User({
      ...userValid,
      email: 'pas-un-email',
      password: 'password12',
    });
    const err = u.validateSync();
    expect(err.errors.email).toBeDefined();
  });

  it('rejette un mot de passe trop court', () => {
    const u = new User({
      ...userValid,
      password: 'short',
    });
    const err = u.validateSync();
    expect(err.errors.password).toBeDefined();
  });

  it('accepte un document valide (validateSync)', () => {
    const u = new User({
      firstName: 'A',
      lastName: 'B',
      email: 'valid@example.com',
      password: 'password12',
    });
    expect(u.validateSync()).toBeUndefined();
  });

  it('expose le virtual fullName', () => {
    const u = new User({ firstName: 'Jean', lastName: 'Martin', email: 'j@m.com', password: 'password12' });
    expect(u.fullName).toBe('Jean Martin');
  });

  it('définit des index sur cabinNumber et role', () => {
    const idx = User.schema.indexes().map((x) => x[0]);
    expect(idx.some((fields) => fields.cabinNumber === 1)).toBe(true);
    expect(idx.some((fields) => fields.role === 1)).toBe(true);
  });

  it('toJSON retire le mot de passe', () => {
    const u = new User({
      firstName: 'A',
      lastName: 'B',
      email: 'a@b.com',
      password: 'secret12345',
    });
    const json = u.toJSON();
    expect(json.password).toBeUndefined();
    expect(json.email).toBe('a@b.com');
  });

  it('comparePassword compare au hash stocké', async () => {
    const plain = 'mypass12345';
    const hash = await bcrypt.hash(plain, 8);
    const u = new User({
      firstName: 'A',
      lastName: 'B',
      email: 'cmp@example.com',
      password: hash,
    });
    await expect(u.comparePassword(plain)).resolves.toBe(true);
    await expect(u.comparePassword('wrong')).resolves.toBe(false);
  });

  it('role enum refuse une valeur invalide', () => {
    const u = new User({
      firstName: 'A',
      lastName: 'B',
      email: 'r@b.com',
      password: 'password12',
      role: 'god',
    });
    const err = u.validateSync();
    expect(err.errors.role).toBeDefined();
  });

  it('timestamps activés sur le schéma', () => {
    expect(User.schema.options.timestamps).toBe(true);
  });
});
