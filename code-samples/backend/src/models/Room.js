const mongoose = require('mongoose');

const RoomSchema = new mongoose.Schema({
  name: {
    type: String,
    unique: true,
    required: true
  },
  displayName: {
    type: String,
    default: function() { return this.name; } // fallback to name if no display name provided
  },
  type: {
    type: String,
    enum: ['group', 'private', 'workplace'],
    default: 'group'
  },
  members: {
    type: [String],
    default: []
  }
});

module.exports = mongoose.model('Room', RoomSchema);