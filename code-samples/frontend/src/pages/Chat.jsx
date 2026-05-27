import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import './Chat.css';
import socket from '../socket';
import api from '../api';
import { useChatNotifications } from './ChatNotificationContext';
import NotificationBadge from './NotificationBadge';

function Chat({ user }) {
  const [message, setMessage] = useState('');
  const [chatLog, setChatLog] = useState([]);
  const [roomList, setRoomList] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [token] = useState(localStorage.getItem('token'));
  const email = user?.email;
  const chatLogRef = useRef(null);
  const messagesEndRef = useRef(null);
  const { unreadCounts, markRoomAsRead, refreshUnreadCounts } = useChatNotifications();
  const location = useLocation();
  const navRoom = location.state?.selectedRoomName;
  const handleReceiveRef = useRef(null);
  const isInitialSelection = useRef(true);
  const refreshTimerRef = useRef(null);

  // Automatically scroll to the latest news
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Load rooms from backend
  const loadRooms = useCallback(() => {
    if (!token) return;
    api.get('/api/rooms')
      .then(res => setRoomList(res.data))
      .catch(err => console.error('Failed to load room list:', err));
  }, [token]);

  // Fetch rooms on mount and when notified of new rooms
  useEffect(() => {
    loadRooms();
    refreshTimerRef.current = setInterval(() => {
      loadRooms();
    }, 30000)

    const handleNewRoom = () => {
      loadRooms();
    };
    socket.on('new_room', handleNewRoom);
    return () => {
      clearInterval(refreshTimerRef.current);
      socket.off('new_room', handleNewRoom);
    };
  }, [loadRooms]);

  // after you load and filter `roomList` and define `email`, etc.
  useEffect(() => {
    if (!roomList.length) return;

    // first filter to only rooms user belong to:
    const myRooms = roomList.filter(r =>
      Array.isArray(r.members) && r.members.includes(email)
    );

    if (!myRooms.length) {
      setSelectedRoom(null);
      return;
    }

    // If someone navigated in with a roomName, use that:
    if (navRoom && isInitialSelection.current) {
      const found = myRooms.find(r => r.name === navRoom);
      if (found) {
        setSelectedRoom(found);
        isInitialSelection.current = false;
        return;
      }
    }
// Otherwise default to the very first room:
    if (isInitialSelection.current) {
      setSelectedRoom(myRooms[0]);
      isInitialSelection.current = false;
    }

  }, [roomList, navRoom, email]);

  // Load messages and join socket room whenever selectedRoom changes
  useEffect(() => {
    if (!selectedRoom) return;
    let isCancelled = false;
    markRoomAsRead(selectedRoom.name);

    // Fetch existing messages
    api.get(`/api/messages/${encodeURIComponent(selectedRoom.name)}`)
      .then(res => {
        if (isCancelled) return;
        const msgs = Array.isArray(res.data) ? res.data : [];
        setChatLog(msgs);
        // When the message is loaded scroll to the bottom
        setTimeout(scrollToBottom, 100);
      })
      .catch(err => console.error('Failed to fetch messages:', err));

    // Join socket.io room
    socket.emit('join_room', selectedRoom.name);

    handleReceiveRef.current = data => {
      if (data.room === selectedRoom.name) {
        setChatLog(prev => [...prev, data]);
        
        // If receive a message that is not sent by self, mark it as read
        if (data.sender !== email) {
          markRoomAsRead(selectedRoom.name);
        }

        setTimeout(scrollToBottom, 100);
      }
    };
    
    socket.on('receive_message', handleReceiveRef.current);
  
    return () => {
      isCancelled = true;
      socket.off('receive_message', handleReceiveRef.current);
    };
  }, [selectedRoom, email, markRoomAsRead]);

    // Refresh unread counts when component mounts
  useEffect(() => {
    refreshUnreadCounts();
  }, []);

  // Scroll to the bottom when the chat history is updated
  useEffect(() => {
    scrollToBottom();
  }, [chatLog]);

  // Send a new message
  const sendMessage = async () => {
    if (!message.trim() || !selectedRoom) return;

    try {
      const { data: newMsg } = await api.post('/api/messages', {
        content: message,
        room: selectedRoom.name,
      });

      socket.emit('send_message', newMsg);

      setChatLog(prev => [...prev, newMsg]);

      setMessage('');

    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

    // Handle room selection, marking as read
  const handleRoomSelect = (room) => {
    setSelectedRoom(room);
    markRoomAsRead(room.name);
  };

  // If no room selected yet, show list of rooms
  if (!selectedRoom) {
    return (
      <div className="chat-container">
        <aside className="rooms-sidebar">
          <h3>Your Rooms</h3>
          {roomList
          .filter(r => Array.isArray(r.members) && r.members.includes(email))
          .map(r => (
            <div
              key={r.name}
              className={`room-card ${r.name === r.name ? 'selected' : ''}`}
              onClick={() => handleRoomSelect(r)}
            >
              <div className="room-card-content">
                <h4>{r.displayName || r.name}</h4>
                <p>{r.type === 'private' ? 'Private' : 'Group'}</p>
              </div>
              {unreadCounts[r.name] > 0 && (
                <NotificationBadge count={unreadCounts[r.name]} />
              )}
            </div>
          ))}
        </aside>
      </div>
    );
  }

  // Main chat view
  return (
    <div className="chat-container">
      {/* Rooms sidebar */}
      <aside className="rooms-sidebar">
        <h3>Rooms</h3>
        {roomList
        .filter(r => Array.isArray(r.members) && r.members.includes(email))
        .map(r => (
          <div
            key={r.name}
            className={`room-card ${selectedRoom.name === r.name ? 'selected' : ''}`}
            onClick={() => handleRoomSelect(r)}
          >
            <div className="room-card-content">
              <h4>{r.displayName || r.name}</h4>
              <p>{r.type === 'private' ? 'Private' : 'Group'}</p>
            </div>
            {unreadCounts[r.name] > 0 && (
              <NotificationBadge count={unreadCounts[r.name]} />
            )}
          </div>
        ))}
      </aside>

      {/* Chat area */}
      <section className="chat-main">
        <header className="chat-header">
          <h2>{selectedRoom.displayName || selectedRoom.name}</h2>
        </header>

        <div className="chat-log" ref={chatLogRef}>
          {chatLog.map((m, idx) => {
            const isCurrentUser = m.sender === email; 
            return (
              <div 
                key={idx} 
                className={`chat-message ${isCurrentUser ? 'current-user' : ''}`}
              >
                <strong 
                  className={`chat-sender ${isCurrentUser ? 'current-user' : ''}`}
                >
                  {isCurrentUser ? 'You' : m.sender}
                </strong>
                <span className="chat-time">
                  {new Date(m.createdAt).toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </span>
                <p className="chat-text">{m.content}</p>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        <div className="chat-input-area">
          <input
            className="chat-input"
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Type a message…"
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
          />
          <button className="chat-send-button" onClick={sendMessage}>
            Send
          </button>
        </div>
      </section>

      {/* Members sidebar */}
      <aside className="members-sidebar">
        <h3>Members</h3>
        {selectedRoom.members.map((mem, idx) => (
          <div key={idx} className="member-card">
            <div className="member-avatar" />
            <div className="member-name">{mem.includes('@') ? mem.split('@')[0] : mem}</div>
          </div>
        ))}
      </aside>
    </div>
  );
}

export default Chat;