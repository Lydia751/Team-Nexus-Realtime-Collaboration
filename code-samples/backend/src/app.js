const authRoutes = require('./routes/auth');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
require('dotenv').config();
const protectedRoutes = require('./routes/protected');
const taskRoutes = require('./routes/tasks');
const messageRoutes = require('./routes/messages');
const roomRoutes = require('./routes/rooms');
const Room = require('./models/Room');
const workplaceRoutes = require('./routes/workplaces');
const boardRoutes = require('./routes/boards');
const usersRouter = require('./routes/users');
const chatStatusRoutes = require('./routes/chatStatus');
const notificationsRouter = require('./routes/notifications');
const express = require('express');
const app = express();
const path = require('path');
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

const server = http.createServer(app); // create HTTP server manually
const { createIo } = require("./socket");
createIo(server);

const routes = require('./routes/routes');
app.use((req, res, next) => {
  console.log(`[LOG] Incoming request: ${req.method} ${req.url}`);
  next();
});
app.use(routes); 

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

// Check Mongo URI
if (!MONGO_URI) {
  console.error('[ERROR] MONGO_URI is not defined in .env');
  process.exit(1);
}

// Connect to MongoDB
mongoose.connect(MONGO_URI)
  .then(async () => {
    console.log('[SUCCESS] Connected to MongoDB');

    try {
      const existing = await Room.findOne({ name: 'general' });
      if (!existing) {
        await Room.create({
          name: 'general',
          type: 'group',
          members: []
        });
        console.log('[INFO] Default room "general" created');
      }
    } catch (err) {
      console.error('[ERROR] Failed to check/create default room:', err.message);
    }
  })
  .catch((err) => {
    console.error('[ERROR] Failed to connect to MongoDB:', err.message);
    process.exit(1);
  });

// Mount routes

app.use('/api/tasks', taskRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api', authRoutes);
app.use('/api', protectedRoutes);
app.use('/api/workplaces', workplaceRoutes);
app.use('/api/boards', boardRoutes);
app.use('/api/users', usersRouter);
app.use('/api', authRoutes);
app.use('/api/chat-status', chatStatusRoutes);
app.use('/api/notifications', notificationsRouter);
if (process.env.NODE_ENV !== 'test') {
  require('./utils/cleanup');
}


if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    console.log(`[INFO] Server is running on http://localhost:${PORT}`);
  });
}

module.exports = app; 

