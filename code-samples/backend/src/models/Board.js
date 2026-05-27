const mongoose = require('mongoose');

const boardSchema = new mongoose.Schema({
  userEmail: { type: String, required: true }, // associate with user
  title: { type: String, required: true }, // board title
  workplaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workplace', required: true },
  teamMembers: [{ type: [String],  default: []}], // list of user emails
  columns: [
    {
      id: String,
      title: String,
      tasks: [
        {
          _id: mongoose.Schema.Types.ObjectId,
          id: String,
          title: String,
          completed: { type: Boolean, default: false }
        }
      ]
    }
  ]
}, { timestamps: true });


module.exports = mongoose.model('Board', boardSchema);
