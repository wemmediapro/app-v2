const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const Message = require('../models/Message');
const User = require('../models/User');
const { safeRegexSearch } = require('../utils/regex-escape');

const router = express.Router();

// @route   GET /api/messages
// @desc    Get user's conversations
// @access  Private
router.get('/', authMiddleware, async (req, res) => {
  try {
    const conversations = await Message.aggregate([
      {
        $match: {
          $or: [
            { sender: req.user.id },
            { receiver: req.user.id }
          ]
        }
      },
      {
        $sort: { createdAt: -1 }
      },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ['$sender', req.user.id] },
              '$receiver',
              '$sender'
            ]
          },
          lastMessage: { $first: '$$ROOT' },
          unreadCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$receiver', req.user.id] },
                    { $eq: ['$isRead', false] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $unwind: '$user'
      },
      {
        $project: {
          user: {
            _id: 1,
            firstName: 1,
            lastName: 1,
            email: 1,
            avatar: 1,
            cabinNumber: 1
          },
          lastMessage: 1,
          unreadCount: 1
        }
      }
    ]);

    res.json(conversations);
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/messages/:userId
// @desc    Get messages with specific user
// @access  Private
router.get('/:userId', authMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    
    const messages = await Message.find({
      $or: [
        { sender: req.user.id, receiver: req.params.userId },
        { sender: req.params.userId, receiver: req.user.id }
      ]
    })
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .populate('sender', 'firstName lastName avatar')
    .populate('receiver', 'firstName lastName avatar');

    // Mark messages as read
    await Message.updateMany(
      {
        sender: req.params.userId,
        receiver: req.user.id,
        isRead: false
      },
      {
        isRead: true,
        readAt: new Date()
      }
    );

    res.json(messages.reverse());
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/messages
// @desc    Send message
// @access  Private
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { receiver, content, type = 'text', attachments = [] } = req.body;

    // Check if receiver exists
    const receiverUser = await User.findById(receiver);
    if (!receiverUser) {
      return res.status(404).json({ message: 'Receiver not found' });
    }

    const message = new Message({
      sender: req.user.id,
      receiver,
      content,
      type,
      attachments
    });

    await message.save();

    const populatedMessage = await Message.findById(message._id)
      .populate('sender', 'firstName lastName avatar')
      .populate('receiver', 'firstName lastName avatar');

    res.status(201).json({
      message: 'Message sent successfully',
      data: populatedMessage
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/messages/users/search
// @desc    Search users for messaging by phone number or email
// @access  Private
router.get('/users/search', authMiddleware, async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.length < 2) {
      return res.json([]);
    }

    // Check if query is an email (contains @)
    const isEmail = q.includes('@');
    // Extract phone number (digits only)
    const phoneNumber = q.replace(/\D/g, '');
    const isPhone = phoneNumber.length >= 3;

    if (!isEmail && !isPhone) {
      return res.json([]);
    }

    // Build search query
    let searchQuery = {
      _id: { $ne: req.user.id },
      isActive: true
    };

    if (isEmail) {
      const safe = safeRegexSearch(q);
      if (safe) searchQuery.email = { $regex: safe, $options: 'i' };
    } else if (isPhone) {
      const safe = safeRegexSearch(phoneNumber);
      if (safe) searchQuery.phone = { $regex: safe, $options: 'i' };
    }

    const users = await User.find(searchQuery)
    .select('firstName lastName email phone cabinNumber avatar')
    .limit(10);

    res.json(users);
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;


