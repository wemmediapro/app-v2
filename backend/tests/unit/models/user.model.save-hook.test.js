/**
 * Hook pre('save') User (bcrypt, skip si password inchangé, catch bcrypt).
 * MongoMemoryServer : exécution autonome sans Mongo externe.
 */
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { MongoMemoryServer } = require('mongodb-memory-server');

jest.setTimeout(120000);

const User = require('../../../src/models/User');

describe('User model — pre save', () => {
  let mongod;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongod) await mongod.stop();
  });

  beforeEach(async () => {
    await User.deleteMany({});
  });

  it('hash le mot de passe à la création', async () => {
    const plain = 'MySecret12!';
    const u = new User({
      firstName: 'A',
      lastName: 'B',
      email: 'new@test.com',
      password: plain,
      role: 'passenger',
    });
    await u.save();
    expect(u.password).not.toBe(plain);
    expect(await bcrypt.compare(plain, u.password)).toBe(true);
  });

  it('ne re-hash pas si le mot de passe n’est pas modifié', async () => {
    const plain = 'MySecret12!';
    const u = new User({
      firstName: 'A',
      lastName: 'B',
      email: 'same@test.com',
      password: plain,
      role: 'passenger',
    });
    await u.save();
    const hashAfterFirst = u.password;

    u.firstName = 'AA';
    const genSaltSpy = jest.spyOn(bcrypt, 'genSalt');
    await u.save();

    expect(u.password).toBe(hashAfterFirst);
    expect(genSaltSpy).not.toHaveBeenCalled();
    genSaltSpy.mockRestore();
  });

  it('propage une erreur si bcrypt.genSalt échoue', async () => {
    jest.spyOn(bcrypt, 'genSalt').mockRejectedValueOnce(new Error('bcrypt overload'));
    const u = new User({
      firstName: 'A',
      lastName: 'B',
      email: 'err@test.com',
      password: 'MySecret12!',
      role: 'passenger',
    });
    await expect(u.save()).rejects.toThrow(/bcrypt overload/);
    bcrypt.genSalt.mockRestore();
  });
});
