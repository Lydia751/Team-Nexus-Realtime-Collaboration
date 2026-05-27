const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const authMiddleware = require('../middleware/authMiddleware');

// GET /api/notifications - Get all notifications for the current user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userEmail = req.user.email.toLowerCase();
    const notifications = await Notification.find({ 
      recipientEmail: userEmail 
    }).sort({ createdAt: -1 });

    res.json(notifications);
  } catch (err) {
    console.error('Error fetching notifications:', err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// GET /api/notifications/unread - Get count of unread notifications
router.get('/unread', authMiddleware, async (req, res) => {
  try {
    const userEmail = req.user.email.toLowerCase();
    const count = await Notification.countDocuments({ 
      recipientEmail: userEmail,
      read: false
    });

    res.json({ count });
  } catch (err) {
    console.error('Error counting unread notifications:', err);
    res.status(500).json({ error: 'Failed to count unread notifications' });
  }
});

// POST /api/notifications/markread - Mark notifications as read
router.post('/markread', authMiddleware, async (req, res) => {
  try {
    const userEmail = req.user.email.toLowerCase();
    const { notificationIds } = req.body;

    if (Array.isArray(notificationIds) && notificationIds.length > 0) {
      // Mark specific notifications as read
      await Notification.updateMany(
        { 
          _id: { $in: notificationIds },
          recipientEmail: userEmail 
        },
        { read: true }
      );
    } else {
      // Mark all notifications as read
      await Notification.updateMany(
        { recipientEmail: userEmail },
        { read: true }
      );
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error marking notifications as read:', err);
    res.status(500).json({ error: 'Failed to mark notifications as read' });
  }
});

module.exports = router;

// Export function to create notifications (for use in other modules)
exports.createNotification = async (data) => {
  try {
    const notification = new Notification(data);
    await notification.save();
    return notification;
  } catch (err) {
    console.error('Error creating notification:', err);
    return null;
  }
};