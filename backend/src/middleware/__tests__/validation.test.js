/**
 * Tests unitaires — middleware de validation (profileValidation, loginValidation, strongPassword, etc.)
 */
const request = require('supertest');
const express = require('express');
const { profileValidation, loginValidation, handleValidationErrors, strongPassword } = require('../validation');

const app = express();
app.use(express.json());
app.put('/profile', profileValidation, (req, res) => res.json({ ok: true }));
app.post('/login', loginValidation, (req, res) => res.json({ ok: true }));

describe('validation middleware', () => {
  describe('profileValidation', () => {
    it('accepte un body vide (tous champs optionnels)', async () => {
      const res = await request(app).put('/profile').send({}).expect(200);
      expect(res.body).toEqual({ ok: true });
    });

    it('accepte des champs valides', async () => {
      const res = await request(app)
        .put('/profile')
        .send({
          firstName: 'Jean',
          lastName: 'Dupont',
          phone: '+33 6 12 34 56 78',
          country: 'France',
          cabinNumber: 'A101',
        })
        .expect(200);
      expect(res.body).toEqual({ ok: true });
    });

    it('accepte dateOfBirth ISO 8601', async () => {
      const res = await request(app).put('/profile').send({ dateOfBirth: '1990-01-15' }).expect(200);
      expect(res.body).toEqual({ ok: true });
    });

    it('rejette firstName > 50 caractères', async () => {
      const res = await request(app)
        .put('/profile')
        .send({ firstName: 'A'.repeat(51) })
        .expect(400);
      expect(res.body).toHaveProperty('message', 'Validation failed');
      expect(res.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: 'firstName',
            msg: expect.stringMatching(/50/),
          }),
        ])
      );
    });

    it('rejette dateOfBirth invalide', async () => {
      const res = await request(app).put('/profile').send({ dateOfBirth: 'not-a-date' }).expect(400);
      expect(res.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: 'dateOfBirth',
          }),
        ])
      );
    });

    it('rejette preferences non objet', async () => {
      const res = await request(app).put('/profile').send({ preferences: 'string' }).expect(400);
      expect(res.body.errors.some((e) => e.path === 'preferences')).toBe(true);
    });
  });

  describe('loginValidation', () => {
    it('rejette sans email', async () => {
      const res = await request(app).post('/login').send({ password: 'secret123' }).expect(400);
      expect(res.body.errors.some((e) => e.path === 'email')).toBe(true);
    });

    it('rejette sans password', async () => {
      const res = await request(app).post('/login').send({ email: 'u@test.com' }).expect(400);
      expect(res.body.errors.some((e) => e.path === 'password')).toBe(true);
    });

    it('accepte email + password valides', async () => {
      const res = await request(app).post('/login').send({ email: 'u@test.com', password: 'secret123' }).expect(200);
      expect(res.body).toEqual({ ok: true });
    });
  });

  describe('strongPassword', () => {
    it('retourne false pour mot de passe trop court', () => {
      expect(strongPassword('Ab1!')).toBe(false);
    });
    it('retourne false sans majuscule', () => {
      expect(strongPassword('abc123!@#')).toBe(false);
    });
    it('retourne false sans minuscule', () => {
      expect(strongPassword('ABC123!@#')).toBe(false);
    });
    it('retourne false sans chiffre', () => {
      expect(strongPassword('Abcdefg!')).toBe(false);
    });
    it('retourne false sans symbole', () => {
      expect(strongPassword('Abcdefg1')).toBe(false);
    });
    it('retourne true pour mot de passe fort', () => {
      expect(strongPassword('Abcdef1!')).toBe(true);
    });
  });
});
