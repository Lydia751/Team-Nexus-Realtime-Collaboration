
import { io } from 'socket.io-client';

const socket = io('/', {
  path: '/socket.io',
  transports: ['websocket'],
  reconnectionAttempts: 5,  
  reconnectionDelay: 1000,  
  timeout: 10000            
});


socket.on('connect', () => {
  console.log('Socket connected: ', socket.id);
});


socket.on('connect_error', (error) => {
  console.error('Socket connect error: ', error);
});


socket.on('disconnect', (reason) => {
  console.log('Socket dicconnect: ', reason);
});

// Listen for new notification events
socket.on('new_notification', (data) => {
  console.log('New notification received:', data);
  // The actual handling will be done in NotificationContext
});

// listener for task completion status updates
socket.on('task_completion_updated', (data) => {
  console.log('Task completion status updated:', data);
});

export default socket;