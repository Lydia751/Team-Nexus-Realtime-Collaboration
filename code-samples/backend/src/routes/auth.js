const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const UserEntry = require("../models/User");
const authMiddleware = require('../middleware/authMiddleware');
const router = express.Router();

// Limit login attempts: up to 5 attempts in 15 minutes
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 5, // limit each IP to 5 requests per windowMs
  message: {
    message: 'Too many login attempts. Please try again after 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// POST /api/signup
router.post('/signup', async (req, res) => {
  const { name, email, password } = req.body;

  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\da-zA-Z]).{8,}$/;
  if (!passwordRegex.test(password)) {
    return res.status(400).json({
      message: 'Password must be at least 8 characters long and include uppercase, lowercase, number, and special character.'
    });
  }
  // Check if email is valid
  try {
    const existingUser = await UserEntry.findOne({ email });
    if (existingUser)
      return res.status(400).json({ message: 'Email already exists' });
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    // Save new user
    const user = new UserEntry({ name, email, password: hashedPassword });
    await user.save();

    // Generate token after successful signup
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET || 'default_secret',
      { expiresIn: '2h' }
    );

    // Send response with token and user info
    res.status(201).json({
      message: 'User created successfully',
      token,
      user: { email: user.email, name: user.name }
    });
  } catch (err) {
    // Log error for debugging
    console.error('Signup error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});


// POST /api/login 
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const now = new Date();

  try {
    const user = await UserEntry.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' })
    };

    if (user.locked) {
      return res.status(403).json({ message: 'Account is locked due to too many failed login attempts.' });
    }

    // Check if the user has made too many login attempts
    const attempts = user.failedLogins || [];

    if (attempts.length >= 5) {
      const lastFive = attempts.slice(-5);
      const oldestOfFive = lastFive[0];
      if (now - new Date(oldestOfFive) < 15 * 60 * 1000) {
        return res.status(429).json({
          message: 'Too many login attempts. Please try again after 15 minutes.'
        });
      }
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      user.failedLogins.push(now);

      // if the user has 10 or more failed attempts, lock the account
      if (user.failedLogins.length >= 10) {
        user.locked = true;
      }

      await user.save();
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // clear failed login attempts on successful login
    user.failedLogins = [];
    await user.save();

    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET || 'default_secret',
      { expiresIn: '2h' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: { email: user.email, name: user.name }
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/me — returns the current user’s profile
router.get('/me', authMiddleware, (req, res) => {
  // This req.user now comes from MongoDB thanks to the updated middleware
  res.json({
    email: req.user.email,
    name:  req.user.name
  });
});

module.exports = router;

