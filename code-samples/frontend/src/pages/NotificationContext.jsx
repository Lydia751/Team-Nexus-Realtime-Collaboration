import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import api from '../api';
import socket from '../socket';

// Create context
export const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Function to fetch notifications - use useCallback to stabilize this function reference
  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }
      
      // Fetch notifications from the API
      const response = await api.get('/api/notifications');
      setNotifications(response.data);
      
      // Calculate unread count
      const unread = response.data.filter(notification => !notification.read).length;
      setUnreadCount(unread);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  }, []); // Empty dependency array since this doesn't depend on any props or state

  // Mark notifications as read
  const markAsRead = useCallback(async (notificationIds = []) => {
    try {
      await api.post('/api/notifications/markread', { notificationIds });
      
      if (notificationIds.length > 0) {
        // Mark specific notifications as read
        setNotifications(prev => 
          prev.map(notification => 
            notificationIds.includes(notification._id) 
              ? { ...notification, read: true } 
              : notification
          )
        );
        
        // Update unread count based on the current state, not by recalculating
        setUnreadCount(prev => Math.max(0, prev - notificationIds.length));
      } else {
        // Mark all as read
        setNotifications(prev => 
          prev.map(notification => ({ ...notification, read: true }))
        );
        
        // Set unread count to 0
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Failed to mark notifications as read:', error);
    }
  }, []);

  // Fetch notifications initially
  useEffect(() => {
    fetchNotifications();
    
    // Set up periodic refresh
    const intervalId = setInterval(() => {
      fetchNotifications();
    }, 60000); // Refresh every minute
    
    return () => clearInterval(intervalId);
  }, [fetchNotifications]); // Add fetchNotifications as a dependency

  // Listen for new notifications via socket
  useEffect(() => {
    const handleNewNotification = (data) => {
      // Only update if notification is for current user
      const userEmail = JSON.parse(localStorage.getItem('user'))?.email?.toLowerCase();
      if (data.recipientEmail === userEmail) {
        // Add notification to state
        setNotifications(prev => [data.notification, ...prev]);
        // Increment unread count
        setUnreadCount(prev => prev + 1);
      }
    };

    socket.on('new_notification', handleNewNotification);

    return () => {
      socket.off('new_notification', handleNewNotification);
    };
  }, []); // Empty dependency array because this doesn't depend on any props or state

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        fetchNotifications,
        markAsRead
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

// Custom hook to use the notification context
export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    console.warn('useNotifications must be used within a NotificationProvider');
    return {
      notifications: [],
      unreadCount: 0,
      loading: false,
      fetchNotifications: () => {},
      markAsRead: () => {}
    };
  }
  return context;
};