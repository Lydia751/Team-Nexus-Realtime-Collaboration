const jwt = require('jsonwebtoken');
const User  = require('../models/User');

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Missing or invalid token' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // 1. Verify JWT
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'default_secret');
    // 2. Load the actual user from the DB
    const user = await User.findById(payload.userId).select('email name');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }  
    // 3. Attach full user document
    req.user = user;
    next();   
    //const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret');
    //req.user = decoded; // userId, email
    //next();
  } catch (err) {
    console.error('Auth error', err);
    //return res.status(403).json({ message: 'Invalid or expired token' });
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

module.exports = authMiddleware;
