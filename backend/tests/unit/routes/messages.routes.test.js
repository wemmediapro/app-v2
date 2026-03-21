/**
 * GET /api/messages (conversations) — mock Message.aggregate.
 */
jest.mock('../../../src/lib/cache-manager', () => ({
  isConnected: false,
  get: jest.fn(),
  set: jest.fn(),
}));

jest.mock('../../../src/models/User', () => {
  const M = function UserMock() {};
  M.findById = jest.fn();
  return M;
});

const mongoose = require('mongoose');
const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const messagesRouter = require('../../../src/routes/messages');
const User = require('../../../src/models/User');
const Message = require('../../../src/models/Message');
const { generateToken } = require('../../../src/middleware/auth');

const uid = '507f1f77bcf86cd799439011';
const mockConversations = [
  {
    _id: '507f1f77bcf86cd799439012',
    user: { _id: '507f1f77bcf86cd799439012', firstName: 'B', lastName: 'B', email: 'b@test.com' },
    lastMessage: { content: 'hi' },
    unreadCount: 0,
  },
];

describe('GET /api/messages', () => {
  let app;
  let aggregateSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    mongoose.connection.readyState = 1;
    app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use('/api/messages', messagesRouter);

    User.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: uid,
          email: 'u@test.com',
          role: 'user',
          isActive: true,
        }),
      }),
    });

    aggregateSpy = jest.spyOn(Message, 'aggregate').mockReturnValue(Promise.resolve(mockConversations));
  });

  afterEach(() => {
    aggregateSpy?.mockRestore?.();
  });

  it('401 sans token', async () => {
    await request(app).get('/api/messages').expect(401);
  });

  it('200 retourne conversations (aggregate mock)', async () => {
    const token = generateToken({ id: uid, email: 'u@test.com', role: 'user' });
    const res = await request(app)
      .get('/api/messages?page=1&limit=20')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(aggregateSpy).toHaveBeenCalled();
  });
});
