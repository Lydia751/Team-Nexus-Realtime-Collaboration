const express = require('express');
const router = express.Router();
const Workplace = require('../models/Workplace');
const Board     = require('../models/Board');
const Task = require('../models/Task'); // Added
const File = require('../models/File'); // Added
const Room = require('../models/Room'); // Added
const fs = require('fs');               // Added for file deletion
const path = require('path');           // Added for file path handling
const { getIo } = require('../socket');  // Added for real-time notification

// GET /api/workplaces/:email
// → returns both: 
//    1) workspaces the user owns (userEmail===email) 
//    2) workspaces they’ve been invited to via board.teamMembers
router.get('/:email', async (req, res) => {
  try {
    const email = req.params.email.toLowerCase();

    // 1) all owned workplaces
    const owned = await Workplace.find({ userEmail: email });

    // 2) find boards where they’re a team member
    const memberBoards = await Board.find(
      { teamMembers: email },
      'workplaceId'
    );
    const invitedIds = memberBoards.map(b => b.workplaceId);

    // 3) fetch those invited workplaces
    const invited = invitedIds.length > 0
      ? await Workplace.find({ _id: { $in: invitedIds } })
      : [];

    // 4) merge and dedupe by _id
    const map = new Map();
    owned.concat(invited).forEach(wp => map.set(wp._id.toString(), wp));
    res.json(Array.from(map.values()));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Create new workplace
router.post('/', async (req, res) => {
  const { userEmail, name } = req.body;
  if (!userEmail || !name) {
    return res.status(400).json({ message: 'Email and title are required.' });
  }

  try {
    // 1) Create the workspace
    const newWorkplace = new Workplace({ userEmail, name });
    await newWorkplace.save();

    // 2) Also create its Board with the same title
    const newBoard = new Board({
      title: name,                  // ← carry the workspace name here
      userEmail,                          // same creator
      workplaceId: newWorkplace._id,      // link it back
      teamMembers: [],                    // empty by default
      columns:     []                     // start with no columns
    });
    await newBoard.save();

    res.status(201).json(newWorkplace);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Archive a workspace
router.patch('/:id/archive', async (req, res) => {
  try {
    const wp = await Workplace.findOneAndUpdate(
      { _id: req.params.id, userEmail: req.headers['x-user-email'] },
      { archived: true },
      { new: true }
    );
    if (!wp) return res.status(404).json({ message: 'Not found or unauthorized' });
    res.json(wp);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Restore a workspace
router.patch('/:id/restore', async (req, res) => {
  try {
    const wp = await Workplace.findOneAndUpdate(
      { _id: req.params.id, userEmail: req.headers['x-user-email'] },
      { archived: false },
      { new: true }
    );
    if (!wp) return res.status(404).json({ message: 'Not found or unauthorized' });
    res.json(wp);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Permanently delete a workspace
router.delete('/:id', async (req, res) => {
  try {
    // Get workspace ID and user email
    const workplaceId = req.params.id;
    const userEmail = req.headers['x-user-email'];
    
    console.log(`Attempting to delete workspace ${workplaceId} by user ${userEmail}`);
    
    // Check if the workspace exists and user is authorized
    const workplace = await Workplace.findOne({
      _id: workplaceId,
      userEmail: userEmail
    });
    
    if (!workplace) {
      console.log('Workspace not found or user not authorized');
      return res.status(404).json({ message: 'Workspace not found or not authorized to delete' });
    }
    
    // Store the workspace name for notifications
    const workspaceName = workplace.name;
    console.log(`Deleting workspace: ${workspaceName} (${workplaceId})`);
    
    // 1. Delete tasks
    console.log('Deleting associated tasks...');
    await Task.deleteMany({ workplaceId });
    
    // 2. Delete files
    console.log('Finding files to delete...');
    const files = await File.find({ workplaceId });
    
    // Delete physical files
    for (const file of files) {
      try {
        const filePath = path.join(__dirname, '..', 'uploads', file.filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`Deleted file: ${file.filename}`);
        }
      } catch (fileErr) {
        console.error(`Error deleting file ${file.filename}:`, fileErr.message);
        // Continue with other files
      }
    }
    
    // Delete file records
    await File.deleteMany({ workplaceId });
    
    // 3. Delete the chat room
    console.log('Deleting associated chat room...');
    const roomName = `workspace-${workplaceId}`;
    await Room.deleteOne({ name: roomName });
    
    // 4. Delete the board
    console.log('Deleting associated board...');
    await Board.deleteOne({ workplaceId });
    
    // 5. Delete the workspace itself
    console.log('Deleting the workspace...');
    await Workplace.deleteOne({ _id: workplaceId });
    
    // 6. Notify via socket.io
    const io = getIo();
    if (io) {
      io.emit('workspace_deleted', {
        workplaceId,
        name: workspaceName,
        deletedBy: userEmail
      });
      console.log('Sent real-time notification about workspace deletion');
    }
    
    console.log('Workspace deletion completed successfully');
    
    // Return success
    res.json({ 
      message: 'Workspace deleted successfully',
      workspace: workspaceName
    });
    
  } catch (err) {
    console.error('Error during workspace deletion:', err.message);
    res.status(500).json({ 
      error: 'Failed to delete workspace', 
      message: err.message 
    });
  }
}); 

// workplaces.js
// GET /api/workplaces/:id/details
router.get('/:id/details', async (req, res) => {
  try {
    const wp = await Workplace.findById(req.params.id);
    if (!wp) return res.status(404).json({ message: 'Workplace not found' });

    const board = await Board.findOne({ workplaceId: wp._id });

    // Normalize existing strings:
    const memberEmails = (board?.teamMembers || [])
      .map(m => m.trim().toLowerCase());

    const ownerEmail = wp.userEmail.trim().toLowerCase();

    res.json({
      members: memberEmails,
      owner: ownerEmail,
      name: wp.name
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});


module.exports = router;
