
const express = require('express');
const router  = express.Router();
const User    = require('../models/User');

// GET /api/users/search?q=<term>
router.get('/search', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json([]);

    // case-insensitive contains on email or name
    const re = new RegExp(q.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i');
    const users = await User
      .find({ $or: [
        { email: { $regex: re } },
        { name:  { $regex: re } }
      ]})
      .limit(10)
      .select('email name');

    res.json(users);
  } catch (err) {
    console.error('User search error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
