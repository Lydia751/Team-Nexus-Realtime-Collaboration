const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipientEmail: {
    type: String,
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['workspace_added', 'workspace_removed', 'task_assigned', 'message_received'],
    required: true
  },
  content: {
    type: String,
    required: true
  },
  metadata: {
    workspaceId: mongoose.Schema.Types.ObjectId,
    workspaceName: String,
    senderId: mongoose.Schema.Types.ObjectId,
    senderEmail: String,
    senderName: String
  },
  read: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Notification', notificationSchema);