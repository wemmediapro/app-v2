const express = require('express');
const { body, query } = require('express-validator');
const { authMiddleware } = require('../middleware/auth');
const {
  createValidatePagination,
  validatePagination,
  validateMongoId,
  sanitizeSearchString,
  handleValidationErrors,
} = require('../middleware/validateInput');

/** Historique messages : 50 par page (comportement historique) */
const validateMessagesPagination = createValidatePagination({ defaultLimit: 50 });
const Message = require('../models/Message');
const User = require('../models/User');
const { logRouteError } = require('../lib/route-logger');
const queryCache = require('../lib/queryCache');
const { withSecondaryRead } = require('../utils/queryOptimizer');

const router = express.Router();

/**
 * @swagger
 * /api/v1/messages:
 *   get:
 *     summary: Conversations de l'utilisateur connecté
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1 }
 *     responses:
 *       200:
 *         description: Liste des fils (pagination serveur)
 *       401:
 *         description: Non authentifié
 */
// @route   GET /api/messages
// @desc    Get user's conversations
// @access  Private
router.get('/', authMiddleware, validatePagination, handleValidationErrors, async (req, res) => {
  try {
    const { skip, limit } = req.pagination;
    const userId = String(req.user.id);
    const cacheKey = `messages:conversations:${userId}:${skip}:${limit}`;

    const conversations = await queryCache.getCached(cacheKey, () =>
      Message.aggregate([
        {
          $match: {
            $or: [{ sender: req.user.id }, { receiver: req.user.id }],
          },
        },
        { $sort: { createdAt: -1 } },
        {
          $group: {
            _id: {
              $cond: [{ $eq: ['$sender', req.user.id] }, '$receiver', '$sender'],
            },
            lastMessage: { $first: '$$ROOT' },
            unreadCount: {
              $sum: {
                $cond: [
                  {
                    $and: [{ $eq: ['$receiver', req.user.id] }, { $eq: ['$isRead', false] }],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'user',
          },
        },
        { $unwind: '$user' },
        {
          $project: {
            user: {
              _id: 1,
              firstName: 1,
              lastName: 1,
              email: 1,
              avatar: 1,
              cabinNumber: 1,
            },
            lastMessage: 1,
            unreadCount: 1,
          },
        },
        { $sort: { 'lastMessage.createdAt': -1 } },
        { $skip: skip },
        { $limit: limit },
      ])
    );

    res.json(conversations);
  } catch (error) {
    logRouteError(req, 'messages_list_conversations_failed', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/messages/users/search — doit être déclaré AVANT /:userId
// @desc    Search users for messaging by phone number or email
// @access  Private
router.get(
  '/users/search',
  authMiddleware,
  [query('q').optional().isString().isLength({ max: 200 })],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { q } = req.query;
      const qTrimmed = typeof q === 'string' ? q.trim() : '';

      if (!qTrimmed || qTrimmed.length < 2) {
        return res.json([]);
      }

      // Check if query is an email (contains @)
      const isEmail = qTrimmed.includes('@');
      // Extract phone number (digits only)
      const phoneNumber = qTrimmed.replace(/\D/g, '');
      const isPhone = phoneNumber.length >= 3;

      if (!isEmail && !isPhone) {
        return res.json([]);
      }

      // Build search query
      const searchQuery = {
        _id: { $ne: req.user.id },
        isActive: true,
      };

      if (isEmail) {
        const safe = sanitizeSearchString(qTrimmed);
        if (safe) {
          searchQuery.email = { $regex: safe, $options: 'i' };
        }
      } else if (isPhone) {
        const safe = sanitizeSearchString(phoneNumber);
        if (safe) {
          searchQuery.phone = { $regex: safe, $options: 'i' };
        }
      }

      const users = await withSecondaryRead(User.find(searchQuery))
        .select('firstName lastName email phone cabinNumber avatar')
        .limit(10)
        .lean();

      res.json(users);
    } catch (error) {
      logRouteError(req, 'messages_search_users_failed', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// @route   GET /api/messages/:userId
// @desc    Get messages with specific user
// @access  Private
router.get(
  '/:userId',
  authMiddleware,
  validateMongoId('userId'),
  validateMessagesPagination,
  handleValidationErrors,
  async (req, res) => {
    try {
      const { limit, skip } = req.pagination;

      const updated = await Message.updateMany(
        {
          sender: req.params.userId,
          receiver: req.user.id,
          isRead: false,
        },
        {
          isRead: true,
          readAt: new Date(),
        }
      );

      if (updated.modifiedCount > 0) {
        void queryCache.invalidate(`messages:conversations:${String(req.user.id)}`);
      }

      const messages = await Message.find({
        $or: [
          { sender: req.user.id, receiver: req.params.userId },
          { sender: req.params.userId, receiver: req.user.id },
        ],
      })
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip)
        .populate('sender', 'firstName lastName avatar')
        .populate('receiver', 'firstName lastName avatar')
        .lean();

      res.json(messages.reverse());
    } catch (error) {
      logRouteError(req, 'messages_thread_failed', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// @route   POST /api/messages
// @desc    Send message
// @access  Private
router.post(
  '/',
  authMiddleware,
  [
    body('receiver').isMongoId().withMessage('Invalid receiver id'),
    body('content')
      .trim()
      .notEmpty()
      .withMessage('Content is required')
      .isLength({ max: 1000 })
      .withMessage('Content too long'),
    body('type').optional().isIn(['text', 'image', 'file']),
    body('attachments').optional().isArray(),
    body('clientSyncId').optional().isString().isLength({ min: 1, max: 128 }).withMessage('clientSyncId invalide'),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { receiver, content, type = 'text', attachments = [], clientSyncId } = req.body;

      const receiverExists = await User.exists({ _id: receiver });
      if (!receiverExists) {
        return res.status(404).json({ message: 'Receiver not found' });
      }

      if (clientSyncId) {
        const existing = await Message.findOne({
          sender: req.user.id,
          clientSyncId: String(clientSyncId).trim(),
        })
          .populate('sender', 'firstName lastName avatar')
          .populate('receiver', 'firstName lastName avatar')
          .lean();
        if (existing) {
          return res.status(200).json({
            message: 'Message already synced',
            data: existing,
          });
        }
      }

      const message = new Message({
        sender: req.user.id,
        receiver,
        content,
        type,
        attachments,
        ...(clientSyncId ? { clientSyncId: String(clientSyncId).trim() } : {}),
      });

      try {
        await message.save();
      } catch (saveErr) {
        if (saveErr && saveErr.code === 11000 && clientSyncId) {
          const again = await Message.findOne({
            sender: req.user.id,
            clientSyncId: String(clientSyncId).trim(),
          })
            .populate('sender', 'firstName lastName avatar')
            .populate('receiver', 'firstName lastName avatar')
            .lean();
          if (again) {
            return res.status(200).json({
              message: 'Message already synced',
              data: again,
            });
          }
        }
        throw saveErr;
      }

      await message.populate([
        { path: 'sender', select: 'firstName lastName avatar' },
        { path: 'receiver', select: 'firstName lastName avatar' },
      ]);

      void queryCache.invalidate('messages:conversations');

      res.status(201).json({
        message: 'Message sent successfully',
        data: message,
      });
    } catch (error) {
      logRouteError(req, 'messages_send_failed', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

module.exports = router;
