const express = require('express');
const router = express.Router();
const ChatStatus = require('../models/ChatStatus');
const Message = require('../models/Message');
const Room = require('../models/Room'); // Add this import for Room model
const authMiddleware = require('../middleware/authMiddleware');

// GET /api/chat-status - Get unread counts for all rooms
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.email;
    
    // Get user's last read timestamps for all rooms
    const userStatuses = await ChatStatus.find({ userId });
    
    // Create a map of room names to last read timestamps
    const lastReadMap = userStatuses.reduce((map, status) => {
      map[status.roomName] = status.lastReadTimestamp;
      return map;
    }, {});
    
    // For each room, count messages newer than last read
    const unreadCounts = {};
    const roomsWithUnread = [];
    
    // Get all rooms with at least one message
    const rooms = await Message.distinct('room');
    
    // IMPROVEMENT: Filter to only rooms where user is a member
    // This prevents checking unread counts for rooms the user isn't part of
    const userRooms = await Room.find({
      name: { $in: rooms },
      members: userId
    }).distinct('name');
    
    console.log(`User ${userId} is member of ${userRooms.length} rooms out of ${rooms.length} total rooms with messages`);
    
    // Process only rooms the user is a member of
    for (const roomName of userRooms) {
      const lastRead = lastReadMap[roomName] || new Date(0);
      
      // Count messages newer than last read
      const count = await Message.countDocuments({
        room: roomName,
        createdAt: { $gt: lastRead },
        sender: { $ne: userId } // Don't count user's own messages
      });
      
      if (count > 0) {
        unreadCounts[roomName] = count;
        roomsWithUnread.push(roomName);
      }
    }
    
    res.json({
      unreadCounts,
      roomsWithUnread,
      totalUnread: Object.values(unreadCounts).reduce((sum, count) => sum + count, 0)
    });
  } catch (err) {
    console.error('Failed to get unread counts:', err);
    res.status(500).json({ error: 'Failed to get unread counts' });
  }
});

// POST /api/chat-status/:roomName/mark-read - Mark a room as read
router.post('/:roomName/mark-read', authMiddleware, async (req, res) => {
  try {
    const { roomName } = req.params;
    const userId = req.user.email;
    
    // IMPROVEMENT: Check if user is a member of this room before marking as read
    const isRoomMember = await Room.exists({
      name: roomName,
      $or: [
        { type: 'group' },
        { members: userId }
      ]
    });
    
    if (!isRoomMember) {
      return res.status(403).json({ error: 'You are not a member of this room' });
    }
    
    // Upsert the chat status record
    await ChatStatus.findOneAndUpdate(
      { userId, roomName },
      { lastReadTimestamp: new Date() },
      { upsert: true, new: true }
    );
    
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to mark room as read:', err);
    res.status(500).json({ error: 'Failed to mark room as read' });
  }
});

// GET /api/chat-status/:roomName - Get unread count for a specific room
router.get('/:roomName', authMiddleware, async (req, res) => {
  try {
    const { roomName } = req.params;
    const userId = req.user.email;
    
    // IMPROVEMENT: Check if user is a member of this room before getting unread count
    const isRoomMember = await Room.exists({
      name: roomName,
      $or: [
        { type: 'group' },
        { members: userId }
      ]
    });
    
    if (!isRoomMember) {
      return res.status(403).json({ error: 'You are not a member of this room' });
    }
    
    // Get user's last read timestamp for this room
    const status = await ChatStatus.findOne({ userId, roomName });
    const lastRead = status ? status.lastReadTimestamp : new Date(0);
    
    // Count messages newer than last read
    const count = await Message.countDocuments({
      room: roomName,
      createdAt: { $gt: lastRead },
      sender: { $ne: userId } // Don't count user's own messages
    });
    
    res.json({ unreadCount: count });
  } catch (err) {
    console.error('Failed to get unread count:', err);
    res.status(500).json({ error: 'Failed to get unread count' });
  }
});

module.exports = router;