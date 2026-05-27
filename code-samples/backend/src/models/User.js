const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['manager', 'member'], default: 'member' },
  locked: { type: Boolean, default: false }, 
  failedLogins: { type: [Date], default: [] }
});

const UserEntry = mongoose.model('UserEntry', userSchema);

module.exports = UserEntry;

