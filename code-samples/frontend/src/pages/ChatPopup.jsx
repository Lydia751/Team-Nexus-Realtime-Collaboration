

import React, { useState, useEffect, useRef } from 'react';
import socket from '../socket';
import api from '../api';
import './ChatPopup.css';
import { useChatNotifications } from './ChatNotificationContext';

export default function ChatPopup({ roomName, roomId, members, onClose }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const popupRef = useRef();
  const headerRef = useRef();
  const messagesEndRef = useRef();
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [size, setSize] = useState({ width: 400, height: 300 });
  const { markRoomAsRead } = useChatNotifications();

  // Use roomId for API calls, fall back to roomName if not provided
  const actualRoomId = roomId || roomName;
  const displayName = roomName || actualRoomId;
  const firstLoadRef = useRef(true);
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // load messages + join room + mark as read
useEffect(() => {
  if (!actualRoomId) return;
  
  let isMounted = true;
  const firstLoad = firstLoadRef.current;
  
  // Only mark as read on first load
  if (firstLoad) {
    markRoomAsRead(actualRoomId);
    firstLoadRef.current = false;
  }
  
  // Fetch messages for this room - only if component still mounted
  api.get(`/api/messages/${encodeURIComponent(actualRoomId)}`)
    .then(res => {
      if (isMounted) {
        setMessages(Array.isArray(res.data) ? res.data : []);
        // Scroll to bottom after messages load
        setTimeout(scrollToBottom, 100);
      }
    })
    .catch(err => {
      if (isMounted) {
        console.error('Failed to fetch messages:', err);
      }
    });

  // Join socket room - ONCE
  if (firstLoad) {
    socket.emit('join_room', actualRoomId);
    console.log(`Joined room: ${actualRoomId}`);
  }
  
  const handler = data => {
    if (data.room === actualRoomId && isMounted) {
      setMessages(prev => [...prev, data]);
      // Mark room as read ONLY when receiving a new message
      if (data.sender !== user?.email) {
        markRoomAsRead(actualRoomId);
      }
      setTimeout(scrollToBottom, 100); 
    }
  };
  
  socket.on('receive_message', handler);
  
  return () => {
    isMounted = false;
    socket.off('receive_message', handler);
  };
}, [actualRoomId]); // Remove any dependencies that cause this to run repeatedly


  const send = async () => {
    if (!text.trim() || !actualRoomId) return;
    try {
      const { data: msg } = await api.post('/api/messages', { 
        room: actualRoomId, 
        content: text 
      });
      socket.emit('send_message', msg);
      setMessages(prev => [...prev, msg]);
      setTimeout(scrollToBottom, 100);
      setText('');
    } catch (err) {
      console.error('Failed to send message:', err);
      alert('Failed to send message. Please try again.');
    }
  };

  // dragging
  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    let startX, startY, origX, origY;
    const down = e => {
      startX = e.clientX;
      startY = e.clientY;
      origX = position.x;
      origY = position.y;
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', up);
    };
    const move = e => {
      setPosition({ x: origX + e.clientX - startX, y: origY + e.clientY - startY });
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    header.addEventListener('mousedown', down);
    return () => header.removeEventListener('mousedown', down);
  }, [position]);

  // Handle close - ensure we clean up properly
  const handleClose = () => {
    onClose();
  };

  return (
    <div
      ref={popupRef}
      className="chat-popup"
      style={{ top: position.y, left: position.x, width: size.width, height: size.height }}
    >
      <div ref={headerRef} className="chat-popup-header">
        <span>{displayName}</span>
        <button className="close-btn" onClick={handleClose}>×</button>
      </div>
      <div className="chat-popup-body">
        <div className="chat-messages">
          {messages.map((m, i) => (
            <div key={i} className="msg">
              <strong>{m.sender}</strong>: {m.content}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        <div className="chat-popup-input">
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
            placeholder="Type..."
          />
          <button onClick={send}>Send</button>
        </div>
      </div>
      <div
        className="chat-popup-resize"
        onMouseDown={e => {
          e.stopPropagation();
          const startW = size.width;
          const startH = size.height;
          const startX = e.clientX;
          const startY = e.clientY;
          const onMove = evt => {
            setSize({
              width: Math.max(300, startW + evt.clientX - startX),
              height: Math.max(200, startH + evt.clientY - startY)
            });
          };
          const onUp = () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
          };
          window.addEventListener('mousemove', onMove);
          window.addEventListener('mouseup', onUp);
        }}
      />
    </div>
  );
}