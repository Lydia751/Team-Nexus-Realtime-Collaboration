const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const authMiddleware = require('../middleware/authMiddleware'); // Middleware to protect routes using JWT

// GET messages for a specific room (requires authentication)
router.get('/:room', authMiddleware, async (req, res) => {
  try {
    const messages = await Message.find({ room: req.params.room });
    res.json(messages);
  } catch (err) {
    console.error('Failed to retrieve messages:', err);
    res.status(500).json({ error: 'Failed to retrieve messages' });
  }
});

// POST a new message to a room (requires authentication)
router.post('/', authMiddleware, async (req, res) => {
  const { content, room } = req.body;
  const sender = req.user.email; // Authenticated user is the sender

  try {
    const message = new Message({ sender, content, room });
    await message.save();
    res.status(201).json(message);
  } catch (err) {
    console.error('Failed to save message:', err);
    res.status(500).json({ error: 'Failed to save message' });
  }
});

module.exports = router;

