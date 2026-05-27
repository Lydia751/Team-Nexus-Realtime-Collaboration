const express = require('express');
const router = express.Router();

// Import and use all route modules
router.use('/api/auth', require('./auth'));
router.use('/api/boards', require('./boards'));
router.use('/api/messages', require('./messages'));
router.use('/api/protected', require('./protected'));
router.use('/api/rooms', require('./rooms'));
router.use('/api/tasks', require('./tasks'));
router.use('/api/workplaces', require('./workplaces'));
router.use('/api/chat-status', require('./chatStatus'));
router.use('/api/notifications', require('./notifications'));
// NEW: File routes
router.use('/api/files', require('./files'));
router.use('/api/links', require('./links'));

module.exports = router;
