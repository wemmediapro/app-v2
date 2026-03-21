/**
 * Synchronisation batch des messages hors ligne (PWA / Service Worker).
 * POST /api/sync/offline-queue — idempotence via clientSyncId (= id file client).
 */
const express = require('express');
const { body } = require('express-validator');
const mongoose = require('mongoose');
const { authMiddleware } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validateInput');
const Message = require('../models/Message');
const User = require('../models/User');
const { logRouteError } = require('../lib/route-logger');

const router = express.Router();

function parseReceiverFromChatRoom(room, myUserId) {
  if (!room || myUserId == null) {
    return null;
  }
  const prefix = 'chat:';
  const r = String(room);
  if (!r.startsWith(prefix)) {
    return null;
  }
  const rest = r.slice(prefix.length);
  const parts = rest.split('_');
  if (parts.length !== 2) {
    return null;
  }
  const [a, b] = parts;
  const me = String(myUserId);
  if (a === me) {
    return b;
  }
  if (b === me) {
    return a;
  }
  return null;
}

/**
 * Fusion simple par timestamp serveur (createdAt) — préfère le serveur pour le même clientSyncId.
 * @param {Array} mergedRows — entrées { clientSyncId, message, duplicate? }
 */
function mergeByServerTimestamp(mergedRows) {
  return [...mergedRows].sort((x, y) => {
    const ta = x.message?.createdAt ? new Date(x.message.createdAt).getTime() : 0;
    const tb = y.message?.createdAt ? new Date(y.message.createdAt).getTime() : 0;
    return ta - tb;
  });
}

// @route   POST /api/sync/offline-queue
// @desc    Persister un lot de messages hors ligne (idempotent)
// @access  Private
router.post(
  '/offline-queue',
  authMiddleware,
  [
    body('items').isArray({ min: 1, max: 100 }).withMessage('items doit être un tableau non vide (max 100)'),
    body('items.*.id').isString().isLength({ min: 1, max: 128 }).withMessage('id client requis'),
    body('items.*.room').isString().isLength({ min: 3, max: 200 }),
    body('items.*.content').isString().trim().notEmpty().isLength({ max: 1000 }).withMessage('content invalide'),
    body('items.*.timestamp').optional().isISO8601(),
    body('items.*.type').optional().isIn(['text', 'image', 'file']),
    body('mergeStrategy').optional().isIn(['server_timestamp', 'prefer_server']),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { items, mergeStrategy = 'server_timestamp' } = req.body;
      const senderId = req.user.id;
      const merged = [];
      const skipped = [];
      const processedIds = [];

      for (const raw of items) {
        const clientSyncId = String(raw.id).trim();
        const room = String(raw.room);
        const content = String(raw.content).trim();
        const type = raw.type && ['text', 'image', 'file'].includes(raw.type) ? raw.type : 'text';

        const existing = await Message.findOne({
          sender: senderId,
          clientSyncId,
        })
          .populate('sender', 'firstName lastName avatar')
          .populate('receiver', 'firstName lastName avatar');

        if (existing) {
          merged.push({
            clientSyncId,
            duplicate: true,
            message: existing.toObject ? existing.toObject() : existing,
          });
          processedIds.push(clientSyncId);
          skipped.push({ clientSyncId, reason: 'duplicate' });
          continue;
        }

        const receiverStr = parseReceiverFromChatRoom(room, senderId);
        if (!receiverStr || !mongoose.Types.ObjectId.isValid(receiverStr)) {
          skipped.push({ clientSyncId, reason: 'invalid_room' });
          continue;
        }

        const receiverUser = await User.findById(receiverStr);
        if (!receiverUser) {
          skipped.push({ clientSyncId, reason: 'receiver_not_found' });
          continue;
        }

        const message = new Message({
          sender: senderId,
          receiver: receiverStr,
          content,
          type,
          clientSyncId,
        });

        try {
          await message.save();
        } catch (saveErr) {
          if (saveErr && saveErr.code === 11000) {
            const again = await Message.findOne({
              sender: senderId,
              clientSyncId,
            })
              .populate('sender', 'firstName lastName avatar')
              .populate('receiver', 'firstName lastName avatar');
            if (again) {
              merged.push({
                clientSyncId,
                duplicate: true,
                message: again.toObject ? again.toObject() : again,
              });
              processedIds.push(clientSyncId);
              skipped.push({ clientSyncId, reason: 'duplicate' });
            }
            continue;
          }
          throw saveErr;
        }

        const populated = await Message.findById(message._id)
          .populate('sender', 'firstName lastName avatar')
          .populate('receiver', 'firstName lastName avatar');

        merged.push({
          clientSyncId,
          duplicate: false,
          message: populated,
        });
        processedIds.push(clientSyncId);
      }

      let orderedMerged = merged;
      if (mergeStrategy === 'server_timestamp' || mergeStrategy === 'prefer_server') {
        orderedMerged = mergeByServerTimestamp(merged);
      }

      return res.status(200).json({
        success: true,
        processedIds,
        merged: orderedMerged,
        skipped,
        mergeStrategy,
      });
    } catch (error) {
      logRouteError(req, 'sync_offline_queue_failed', error);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la synchronisation des messages',
        error: error.message,
      });
    }
  }
);

module.exports = router;

if (process.env.NODE_ENV === 'test') {
  module.exports.__testParseReceiver = parseReceiverFromChatRoom;
}
