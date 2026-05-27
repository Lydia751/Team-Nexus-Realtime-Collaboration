const mongoose = require('mongoose');

const workplaceSchema = new mongoose.Schema({
  userEmail: {          // who created/owns this workspace
    type: String,
    required: true,
    index: true
  },
  name: {               // workspace title
    type: String,
    required: true
  },
  archived: {           // soft-delete flag
    type: Boolean,
    default: false
  }
}, {
  timestamps: true      // adds createdAt & updatedAt
});

module.exports = mongoose.model('Workplace', workplaceSchema);

