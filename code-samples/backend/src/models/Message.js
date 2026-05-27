const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  sender: String,
  content: String,
  room: String
}, {
  timestamps: true // Automatically adds createdAt/updatedAt fields
});

module.exports = mongoose.model('Message', MessageSchema);
