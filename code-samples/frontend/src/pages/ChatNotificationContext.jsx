import React, { createContext, useState, useEffect, useContext, useRef } from 'react';
import api from '../api';
import socket from '../socket';

// Create context
export const ChatNotificationContext = createContext();

export const ChatNotificationProvider = ({ children }) => {
  const [unreadCounts, setUnreadCounts] = useState({});
  const [roomsWithUnread, setRoomsWithUnread] = useState([]);
  const [totalUnread, setTotalUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  // Add debounce and fetching flag
  const debounceTimeoutRef = useRef(null);
  const isFetchingRef = useRef(false);
  const lastFetchTimestampRef = useRef(0);
  const roomLastMarkTimeRef = useRef({});

  // Function to fetch unread counts
  const fetchUnreadCounts = async () => {
    // Don't fetch if already fetching
    const now = Date.now();
    if (isFetchingRef.current || (now - lastFetchTimestampRef.current < 10000)) return;
    
    try {
      isFetchingRef.current = true;
      lastFetchTimestampRef.current = now;
      
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        isFetchingRef.current = false;
        return;
      }
      
      console.log("Fetching unread counts...");
      
      const response = await api.get('/api/chat-status');
      console.log("Unread counts response:", response.data);
      
      setUnreadCounts(response.data.unreadCounts || {});
      setRoomsWithUnread(response.data.roomsWithUnread || []);
      setTotalUnread(response.data.totalUnread || 0);
    } catch (error) {
      console.error('Failed to fetch unread counts:', error);
      // Set defaults on error to prevent UI issues
      setUnreadCounts({});
      setRoomsWithUnread([]);
      setTotalUnread(0);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  };

  // Mark a room as read
const markRoomAsRead = async (roomName) => {
  if (!roomName) return;
  
  // Add a protection against repeated calls for the same room in a short time
  const now = Date.now();
  const lastMarkTime = roomLastMarkTimeRef.current[roomName] || 0;
  
  // Only allow marking as read once every 5 seconds per room
  if (now - lastMarkTime < 5000) {
    console.log(`Skipping mark-read for ${roomName}, last marked ${now - lastMarkTime}ms ago`);
    return;
  }
  
  // Record this mark time
  roomLastMarkTimeRef.current[roomName] = now;
  
  console.log(`Marking room as read: ${roomName}`);
  
  try {
    await api.post(`/api/chat-status/${encodeURIComponent(roomName)}/mark-read`);
    
    // Update local state
    setUnreadCounts(prev => {
      const newCounts = { ...prev };
      delete newCounts[roomName];
      return newCounts;
    });
    
    setRoomsWithUnread(prev => prev.filter(room => room !== roomName));
    
    // Recalculate total
    setTotalUnread(prev => {
      const roomCount = unreadCounts[roomName] || 0;
      return Math.max(0, prev - roomCount);
    });
  } catch (error) {
    console.error(`Failed to mark room ${roomName} as read:`, error);
  }
};

  // Listen for new messages via socket
  useEffect(() => {
    const handleNewUnreadMessage = (data) => {
      // Only update if the message is not from the current user
      const userEmail = JSON.parse(localStorage.getItem('user'))?.email;
      if (data.sender !== userEmail) {
        setUnreadCounts(prev => ({
          ...prev,
          [data.room]: (prev[data.room] || 0) + 1
        }));
        
        setRoomsWithUnread(prev => {
          if (!prev.includes(data.room)) {
            return [...prev, data.room];
          }
          return prev;
        });
        
        setTotalUnread(prev => prev + 1);
      }
    };

    socket.on('new_unread_message', handleNewUnreadMessage);

    return () => {
      socket.off('new_unread_message', handleNewUnreadMessage);
    };
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchUnreadCounts();
    
    // Set periodic refresh, but with longer interval
    const intervalId = setInterval(fetchUnreadCounts, 60000); // Refresh every minute
    
    return () => {
      clearInterval(intervalId);
      clearTimeout(debounceTimeoutRef.current);
    };
  }, []);

  return (
    <ChatNotificationContext.Provider
      value={{
        unreadCounts,
        roomsWithUnread,
        totalUnread,
        loading,
        markRoomAsRead,
        refreshUnreadCounts: fetchUnreadCounts
      }}
    >
      {children}
    </ChatNotificationContext.Provider>
  );
};

// Custom hook to use the chat notification context
export const useChatNotifications = () => {
  const context = useContext(ChatNotificationContext);
  if (!context) {
    // Add safe defaults
    console.warn('useChatNotifications must be used within a ChatNotificationProvider');
    return {
      unreadCounts: {},
      roomsWithUnread: [],
      totalUnread: 0,
      loading: false,
      markRoomAsRead: () => {},
      refreshUnreadCounts: () => {}
    };
  }
  return context;
};