
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

// Global Settings
beforeAll(async () => {
  // If there is a connection, disconnect it first
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  
  // Creating an In-Memory MongoDB Server
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  
  // Setting test environment variables
  process.env.MONGO_URI = mongoUri;
  process.env.JWT_SECRET = 'test-jwt-secret';
  process.env.NODE_ENV = 'test';
  
  // Connecting to the test database
  await mongoose.connect(mongoUri);
});

// Preventing scheduled tasks in cleanup.js
jest.mock('../src/utils/cleanup', () => {
  const originalModule = jest.requireActual('../src/utils/cleanup');
  
  // Returns all original exports but replaces the runCleanup function
  return {
    ...originalModule,
    runCleanup: jest.fn().mockResolvedValue(undefined)
  };
});

//  node-cron
jest.mock('node-cron', () => ({
  schedule: jest.fn(() => ({
    start: jest.fn(),
    stop: jest.fn()
  }))
}));



// Cleaning up after testing
afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (mongoServer) {
    await mongoServer.stop();
  }
  
  // Make sure all timers are cleared
  jest.useRealTimers();
  
  // Force cleanup of all possible delayed operations
  const allTimers = setTimeout(() => {}, 0);
  for (let i = 0; i < allTimers; i++) {
    clearTimeout(i);
  }
});

//  socket.io
jest.mock('../src/socket', () => ({
  getIo: jest.fn().mockReturnValue({
    emit: jest.fn(),
    to: jest.fn().mockReturnThis(),
    on: jest.fn()
  }),
  createIo: jest.fn()
}));

// console.error 
const originalConsoleError = console.error;
console.error = jest.fn();

// recover console.error
afterAll(() => {
  console.error = originalConsoleError;
});