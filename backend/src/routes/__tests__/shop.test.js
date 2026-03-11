/**
 * Tests API Shop — produits, catégories, recherche.
 * Les routes qui touchent MongoDB peuvent retourner [] ou 503 selon l'état de connexion.
 */
const request = require('supertest');
const express = require('express');
const shopRouter = require('../shop');

// App minimale pour tester le routeur shop
const app = express();
app.use(express.json());
app.use('/api/shop', shopRouter);

describe('API Shop', () => {
  describe('GET /api/shop/categories/list', () => {
    it('retourne 200 et la liste des catégories avec id, name, icon', async () => {
      const res = await request(app)
        .get('/api/shop/categories/list')
        .expect(200);
      expect(res.body).toHaveProperty('categories');
      expect(Array.isArray(res.body.categories)).toBe(true);
      expect(res.body.categories.length).toBeGreaterThanOrEqual(5);
      const ids = res.body.categories.map((c) => c.id);
      expect(ids).toContain('souvenirs');
      expect(ids).toContain('dutyfree');
      expect(ids).toContain('fashion');
      expect(ids).toContain('electronics');
      expect(ids).toContain('food');
      res.body.categories.forEach((cat) => {
        expect(cat).toHaveProperty('id');
        expect(cat).toHaveProperty('name');
        expect(cat).toHaveProperty('icon');
      });
    });
  });

  describe('GET /api/shop', () => {
    it('retourne 200 et un tableau (liste produits ou vide)', async () => {
      const res = await request(app)
        .get('/api/shop')
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('accepte page=1 et limit entre 1 et 100', async () => {
      const res = await request(app)
        .get('/api/shop?page=1&limit=10')
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('retourne 400 si limit > 100', async () => {
      await request(app)
        .get('/api/shop?limit=101')
        .expect(400);
    });
  });

  describe('GET /api/shop/search/query', () => {
    it('retourne 400 si q manquant ou trop court', async () => {
      await request(app)
        .get('/api/shop/search/query')
        .expect(400);
      await request(app)
        .get('/api/shop/search/query?q=a')
        .expect(400);
    });

    it('retourne 200 avec { products } pour une requête valide (≥2 caractères)', async () => {
      const res = await request(app)
        .get('/api/shop/search/query?q=test')
        .expect(200);
      expect(res.body).toHaveProperty('products');
      expect(Array.isArray(res.body.products)).toBe(true);
    });
  });

  describe('POST /api/shop (création produit — admin)', () => {
    it('retourne 401 sans token', async () => {
      await request(app)
        .post('/api/shop')
        .send({ name: 'Test', description: 'Desc', category: 'souvenirs' })
        .expect(401);
    });
  });
});
