import React from 'react';
//import { useNavigate } from 'react-router-dom';
import './NotificationItem.css';

const NotificationItem = ({ notification, onMarkAsRead }) => {
  //const navigate = useNavigate();
  
  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString(undefined, { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  // const handleClick = () => {
  //   // Mark as read
  //   if (!notification.read) {
  //     onMarkAsRead(notification._id);
  //   }
    
  //   // Navigate based on notification type and available metadata
  //   if (notification.type === 'workspace_added' && notification.metadata?.workspaceId) {
  //     navigate(`/workspace/${notification.metadata.workspaceId}`);
  //   }
  // };
  
  // Determine icon based on notification type
  const getNotificationIcon = (type) => {
    switch (type) {
      case 'workspace_added':
        return '➕';
      case 'workspace_removed':
        return '❌';
      case 'task_assigned':
        return '📋';
      case 'message_received':
        return '💬';
      default:
        return '🔔';
    }
  };

  return (
    <div 
      className={`notification-item ${notification.read ? 'read' : 'unread'}`}
      //onClick={handleClick}
    >
      <div className="notification-icon">
        {getNotificationIcon(notification.type)}
      </div>
      <div className="notification-content">
        <div className="notification-text">{notification.content}</div>
        <div className="notification-time">{formatTimestamp(notification.createdAt)}</div>
      </div>
    </div>
  );
};

export default NotificationItem;