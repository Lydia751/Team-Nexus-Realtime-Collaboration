const Notification = require('../models/Notification');
const { getIo } = require('../socket');

/**
 * Create a notification and emit a socket event
 * 
 * @param {Object} data Notification data
 * @param {String} data.recipientEmail Email of the recipient
 * @param {String} data.type Type of notification
 * @param {String} data.content Content of notification
 * @param {Object} data.metadata Additional data related to notification
 * @returns {Promise<Object>} Created notification
 */
const createNotification = async (data) => {
  try {
    // Create the notification
    const notification = new Notification(data);
    await notification.save();
    
    // Send socket notification
    const io = getIo();
    if (io) {
      io.emit('new_notification', {
        recipientEmail: data.recipientEmail,
        notification
      });
    }
    
    return notification;
  } catch (err) {
    console.error('Error creating notification:', err);
    return null;
  }
};

/**
 * Create a workspace added notification
 * 
 * @param {String} recipientEmail Email of the recipient
 * @param {String} workspaceId ID of the workspace
 * @param {String} workspaceName Name of the workspace
 * @param {String} senderEmail Email of the sender
 * @returns {Promise<Object>} Created notification
 */
const createWorkspaceAddedNotification = async (recipientEmail, workspaceId, workspaceName, senderEmail) => {
  return createNotification({
    recipientEmail: recipientEmail.toLowerCase(),
    type: 'workspace_added',
    content: `You have been added to workspace: ${workspaceName}`,
    metadata: {
      workspaceId,
      workspaceName,
      senderEmail
    }
  });
};

/**
 * Create a workspace removed notification
 * 
 * @param {String} recipientEmail Email of the recipient
 * @param {String} workspaceId ID of the workspace
 * @param {String} workspaceName Name of the workspace
 * @param {String} senderEmail Email of the sender
 * @returns {Promise<Object>} Created notification
 */
const createWorkspaceRemovedNotification = async (recipientEmail, workspaceId, workspaceName, senderEmail) => {
  return createNotification({
    recipientEmail: recipientEmail.toLowerCase(),
    type: 'workspace_removed',
    content: `You have been removed from workspace: ${workspaceName}`,
    metadata: {
      workspaceId,
      workspaceName,
      senderEmail
    }
  });
};

module.exports = {
  createNotification,
  createWorkspaceAddedNotification,
  createWorkspaceRemovedNotification
};