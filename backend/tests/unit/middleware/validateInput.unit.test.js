const mongoose = require('mongoose');
const {
  validateMongoId,
  sanitizeSearchString,
  createValidatePagination,
  handleValidationErrors,
} = require('../../../src/middleware/validateInput');

describe('validateInput', () => {
  describe('validateMongoId', () => {
    it('400 si id invalide', () => {
      const mw = validateMongoId('id');
      const req = { params: { id: 'not-an-objectid' } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();
      mw(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_ID' }));
      expect(next).not.toHaveBeenCalled();
    });

    it('next si ObjectId valide', () => {
      const mw = validateMongoId('userId');
      const id = new mongoose.Types.ObjectId().toString();
      const req = { params: { userId: id } };
      const res = { status: jest.fn(), json: jest.fn() };
      const next = jest.fn();
      mw(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('sanitizeSearchString', () => {
    it('échappe les métacaractères regex', () => {
      expect(sanitizeSearchString('a+b')).toBe('a\\+b');
    });

    it('retourne vide pour entrée non string', () => {
      expect(sanitizeSearchString(null)).toBe('');
    });
  });

  describe('createValidatePagination', () => {
    it('applique defaultLimit et calcule skip', () => {
      const mw = createValidatePagination({ defaultLimit: 50 });
      const req = { query: { page: '2', limit: '10' } };
      const res = {};
      const next = jest.fn();
      mw(req, res, next);
      expect(req.pagination).toEqual({ page: 2, limit: 10, skip: 10 });
      expect(next).toHaveBeenCalled();
    });
  });
});
