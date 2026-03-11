const express = require('express');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// All messaging routes require authentication
router.use(authenticateToken);

// Mock data for messages
const messages = [
  {
    id: '1',
    senderId: 'user1',
    receiverId: 'user2',
    content: 'Bonjour ! Comment allez-vous ?',
    timestamp: new Date('2024-01-15T10:30:00Z'),
    isRead: false
  }
];

// Get user's conversations
router.get('/conversations', async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Mock conversations
    const conversations = [
      {
        id: 'conv1',
        participant: {
          id: 'user2',
          name: 'Marie Dubois',
          avatar: null
        },
        lastMessage: {
          content: 'Bonjour ! Comment allez-vous ?',
          timestamp: new Date('2024-01-15T10:30:00Z'),
          senderId: 'user2'
        },
        unreadCount: 2
      }
    ];

    res.json({ conversations });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({
      message: 'Failed to get conversations',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get messages for a conversation
router.get('/conversations/:conversationId/messages', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    // Mock messages
    const conversationMessages = messages.filter(msg => 
      msg.conversationId === conversationId
    );

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const paginatedMessages = conversationMessages
      .slice(skip, skip + parseInt(limit))
      .reverse(); // Most recent first

    res.json({
      messages: paginatedMessages,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: conversationMessages.length,
        pages: Math.ceil(conversationMessages.length / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({
      message: 'Failed to get messages',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Send a message
router.post('/send', async (req, res) => {
  try {
    const { receiverId, content, conversationId } = req.body;
    const senderId = req.user._id;

    if (!receiverId || !content) {
      return res.status(400).json({
        message: 'Receiver ID and content are required'
      });
    }

    // Mock message creation
    const newMessage = {
      id: Date.now().toString(),
      senderId,
      receiverId,
      content,
      conversationId: conversationId || `conv_${senderId}_${receiverId}`,
      timestamp: new Date(),
      isRead: false
    };

    messages.push(newMessage);

    res.status(201).json({
      message: 'Message sent successfully',
      message: newMessage
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      message: 'Failed to send message',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Mark messages as read
router.put('/conversations/:conversationId/read', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id;

    // Mock marking messages as read
    const updatedMessages = messages.filter(msg => 
      msg.conversationId === conversationId && 
      msg.receiverId === userId
    ).map(msg => ({ ...msg, isRead: true }));

    res.json({
      message: 'Messages marked as read',
      updatedCount: updatedMessages.length
    });
  } catch (error) {
    console.error('Mark messages as read error:', error);
    res.status(500).json({
      message: 'Failed to mark messages as read',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Search users for messaging
router.get('/users/search', async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        message: 'Search query must be at least 2 characters long'
      });
    }

    // Mock user search
    const users = [
      {
        id: 'user2',
        name: 'Marie Dubois',
        email: 'marie@example.com',
        avatar: null,
        isOnline: true
      }
    ].filter(user => 
      user.name.toLowerCase().includes(q.toLowerCase()) ||
      user.email.toLowerCase().includes(q.toLowerCase())
    );

    res.json({ users });
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({
      message: 'Failed to search users',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;



