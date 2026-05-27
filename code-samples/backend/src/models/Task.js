const mongoose = require('mongoose');

const checklistItemSchema = new mongoose.Schema({
  text:      String,
  completed: Boolean
});

const taskSchema = new mongoose.Schema({
  title:       { type: String,   required: true },
  description: String,
  assignee:    String,
  startDate:   Date,
  endDate:     Date,
  members:     { type: [String], default: [] },  // who’s assigned/invited
  labels:      { type: [String], default: [] },
  checklist:   { type: [checklistItemSchema], default: [] },
  workplaceId: {                                 // which workspace this belongs to
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workplace',
    required: true,
    index: true
  },
  columnId:    {                                 // which column (by id) it sits in
    type: String,
    required: true,
    index: true
  },
  completed: { type: Boolean, default: false },
  completedBy: { type: [String], default: [] },
  hiddenFor:   { type: [String], default: [] },
  read: { type: [String], default: [] }
}, {
  timestamps: true
});

module.exports = mongoose.model('Task', taskSchema);
