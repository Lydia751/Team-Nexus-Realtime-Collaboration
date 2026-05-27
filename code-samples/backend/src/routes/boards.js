const express = require('express');
const router = express.Router();
const Board = require('../models/Board');
const User = require('../models/User');
const { createWorkspaceAddedNotification, createWorkspaceRemovedNotification } = require('../utils/notificationUtils');

// GET board by workplaceId
router.get('/:workplaceId', async (req, res) => {
  try {
    let board = await Board.findOne({
      workplaceId: req.params.workplaceId,
      //userEmail: req.headers['x-user-email']  // scope by user
      $or: [
        { userEmail: req.headers['x-user-email'] },
        { teamMembers: req.headers['x-user-email'] }
      ]
    });
    if (!board) {
      board = new Board({
        workplaceId: req.params.workplaceId,
        userEmail: req.headers['x-user-email'],
        columns: []
      });
      await board.save();
    }
    res.json(board);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT to update columns
router.put('/:workplaceId', async (req, res) => {
  try {
    const { columns } = req.body;
    const board = await Board.findOneAndUpdate(
      { workplaceId: req.params.workplaceId, 
        //userEmail: req.headers['x-user-email'] },
        $or: [
          { userEmail: req.headers['x-user-email'] },
          { teamMembers: req.headers['x-user-email'] }
        ]},
      { columns },
      { new: true, upsert: true }
    );
    res.json(board);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE a task from a specific column
router.delete('/:workplaceId/columns/:colId/tasks/:taskId', async (req, res) => {
  const { workplaceId, colId, taskId } = req.params;

  try {
    // Find the board
    const board = await Board.findOne({ 
      workplaceId, 
      $or: [
        { userEmail: req.headers['x-user-email'] },
        { teamMembers: req.headers['x-user-email'] }
      ]
    });
    if (!board) return res.status(404).json({ error: 'Board not found' });

    // Find the column
    const column = board.columns.find(col => col.id === colId);
    if (!column) return res.status(404).json({ error: 'Column not found' });

    // Remove the task
    const initialLength = column.tasks.length;
    column.tasks = column.tasks.filter(task => task.id !== taskId);

    if (column.tasks.length === initialLength) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Save changes
    await board.save();
    res.status(200).json({ message: 'Task deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Invite a user to the board
router.post('/:workplaceId/invite', async (req, res) => {
  const { inviteEmail } = req.body;
  const userEmail = req.headers['x-user-email'];

  try {
    // 1) only the creator can invite
    const board = await Board.findOne({
      workplaceId: req.params.workplaceId,
      userEmail: userEmail      // ensure touching the creator’s board
    });
    if (!board) return res.status(404).json({ message: "Board not found or not authorized" });

    // 2) only invite real users
    const invitedUser = await User.findOne({ email: inviteEmail });
    if (!invitedUser) return res.status(400).json({ message: "That email isn't registered." });

    // 3) add them—only to this board
    await Board.updateOne(
      { _id: board._id },
      { $addToSet: { teamMembers: inviteEmail } }
    );

    // Create notification for the invited user
    await createWorkspaceAddedNotification(
      inviteEmail,
      board._id,
      board.title,
      userEmail
    );
    // 4) return the updated member list
    const updated = await Board.findById(board._id);
    return res.json({ teamMembers: updated.teamMembers });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: err.message });
  }
});

// Get the team members of the board
router.get('/:workplaceId/team', async (req, res) => {
  try {
    const board = await Board.findOne({ workplaceId: req.params.workplaceId });
    if (!board) return res.status(404).json({ message: "Board not found" });

    //res.json({ creator: board.userEmail, members: board.teamMembers });
    res.json({
      creator: board.userEmail,
      members: Array.isArray(board.teamMembers) ? board.teamMembers : []
      });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Remove a member from this board
router.delete('/:workplaceId/member', async (req, res) => {
  const { removeEmail } = req.body;
  const userEmail = req.headers['x-user-email'];

  try {
    // Only the creator may remove members
    const board = await Board.findOne({
      workplaceId: req.params.workplaceId,
      userEmail: userEmail
    });
    if (!board) {
      return res.status(404).json({ message: "Board not found or not authorized" });
    }

    // Pull the member out of teamMembers
    //board.teamMembers = board.teamMembers.filter(e => e !== removeEmail);
    const target = removeEmail.trim().toLowerCase();

     board.teamMembers = board.teamMembers.filter(raw => {
         // turn whatever you stored into a string
         const emailStr = typeof raw === 'string'
           ? raw
           : // if you ever stored objects, pull their email field; else coerce
             (raw.email || raw.toString());
      
         // now safely trim & lowercase
         return emailStr.trim().toLowerCase() !== target;
       });


    await board.save();

      // Create notification for removed user
    await createWorkspaceRemovedNotification(
      target,
      board._id,
      board.title,
      userEmail
    );  

    return res.json({ teamMembers: board.teamMembers });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: err.message });
  }
});


module.exports = router;
