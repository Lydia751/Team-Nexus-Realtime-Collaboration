import React, { useEffect } from 'react';
import { useNotifications } from './NotificationContext';
import NotificationItem from './NotificationItem';
import './NotificationPage.css';

const NotificationPage = () => {
  const { notifications, loading, fetchNotifications, markAsRead, unreadCount } = useNotifications();
  
  useEffect(() => {
    // Refresh notifications when page is opened
    fetchNotifications();
  }, [fetchNotifications]);
  
  const handleMarkAllAsRead = () => {
    markAsRead(); // Mark all as read
  };
  
  const handleMarkOneAsRead = (notificationId) => {
    markAsRead([notificationId]); // Mark specific notification as read
  };
  
  if (loading) {
    return (
      <div className="notification-page">
        <div className="notification-header">
          <h2>Notifications</h2>
        </div>
        <div className="notification-loading">Loading notifications...</div>
      </div>
    );
  }
  
  return (
    <div className="notification-page">
      <div className="notification-header">
        <h2>Notifications</h2>
        {unreadCount > 0 && (
          <button 
            className="mark-all-read-btn"
            onClick={handleMarkAllAsRead}
          >
            Mark all as read
          </button>
        )}
      </div>
      
      {notifications.length === 0 ? (
        <div className="no-notifications">
          You have no notifications.
        </div>
      ) : (
        <div className="notification-list">
          {notifications.map(notification => (
            <NotificationItem 
              key={notification._id}
              notification={notification}
              onMarkAsRead={handleMarkOneAsRead}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default NotificationPage;