const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/dashboard', authMiddleware, (req, res) => {
  res.json({ message: `Hello ${req.user.email}, you accessed a protected route!` });
});

module.exports = router;
