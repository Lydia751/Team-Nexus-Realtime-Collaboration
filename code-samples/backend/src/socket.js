const { Server } = require("socket.io");

let io; // Declare io as a global variable

/**
 * Creates a new socket.io server instance.
 */
function createIo(server) {
  io = new Server(server, {
    cors: {
      origin: "http://localhost:5173",
      methods: ["GET", "POST"],
    },
  });
  
  io.on('connection', (socket) => {
    console.log('[SOCKET] User connected:', socket.id);

    socket.on('join_room', (room) => {
      socket.join(room);
      console.log(`[SOCKET] ${socket.id} joined room: ${room}`);
    });

    socket.on('send_message', (data) => {
      socket.to(data.room).emit('receive_message', data);
      // Emit event for new unread message
      io.emit('new_unread_message', {
        room: data.room,
        sender: data.sender
      });
    });

    socket.on('create_room_notify', () => {
      io.emit('new_room');
    });

    socket.on('task_assigned', (data) => {
      console.log(`[SOCKET] Task assigned: ${data.taskId} to ${data.assignedTo.join(', ')}`);
      socket.broadcast.emit('task_assigned', data);
    });

    socket.on('task_member_removed', (data) => {
      console.log(`[SOCKET] Member removed: ${data.removedMember} from task ${data.taskId}`);
      socket.broadcast.emit('task_member_removed', data);
    });
  // event handler for task completion status update
    socket.on('task_completion_updated', (data) => {
      console.log(`[SOCKET] Task completion updated: ${data.taskId} by ${data.updatedByUser}, completed: ${data.completed}`);
      socket.broadcast.emit('task_completion_updated', data);
    });

        // New event handler for notifications
    socket.on('new_notification', (data) => {
      console.log(`[SOCKET] New notification for: ${data.recipientEmail}`);
      socket.broadcast.emit('new_notification', data);
    });

    socket.on('disconnect', () => {
      console.log('[SOCKET] User disconnected:', socket.id);
    });
  });
  
  return io;
}

/**
 * @returns io
 */
function getIo() {
  return io;
}

module.exports = { createIo, getIo };