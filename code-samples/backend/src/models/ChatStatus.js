const mongoose = require('mongoose');

const chatStatusSchema = new mongoose.Schema({
  userId: {
    type: String,  // store the user's email as identifier
    required: true,
    index: true
  },
  roomName: {
    type: String,
    required: true
  },
  lastReadTimestamp: {
    type: Date,
    default: new Date(0)  // Default to Unix epoch (indicating never read)
  }
}, {
  timestamps: true
});

// Compound index to ensure unique user-room combinations
chatStatusSchema.index({ userId: 1, roomName: 1 }, { unique: true });

module.exports = mongoose.model('ChatStatus', chatStatusSchema);