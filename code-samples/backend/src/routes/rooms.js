const express = require('express');
const router = express.Router();
const Room = require('../models/Room');
const authMiddleware = require('../middleware/authMiddleware'); // Use JWT auth middleware

// GET /api/rooms
// Retrieve all rooms accessible to the authenticated user
router.get('/', authMiddleware, async (req, res) => {
  const username = req.user.email;
  console.log(`[INFO] Fetching rooms for user: ${username}`);

  try {
    const rooms = await Room.find({
      $or: [
        // { type: 'group' }, 
        { type: 'private', members: { $in: [username] } },
        { type: 'workplace', members: { $in: [username] } }
      ]
    });

    console.log(`[SUCCESS] Found ${rooms.length} rooms`);
    res.json(rooms);
  } catch (err) {
    console.error('[ERROR] Failed to fetch rooms:', err.message);
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

router.get('/:name', authMiddleware, async (req, res) => {
  try {
    const room = await Room.findOne({ name: req.params.name });
    if (!room) return res.status(404).json({ message: 'Room not found' });
    
    res.json(room);
  } catch (err) {
    console.error('[ERROR] Failed to get room:', err.message);
    res.status(500).json({ error: 'Failed to get room' });
  }
});

// POST /api/rooms
// Create a new room (group, private, or workplace)
router.post('/', authMiddleware, async (req, res) => {
  const { name, displayName, type = 'group', members = [] } = req.body;
  
  try {
    const existing = await Room.findOne({ name });
    
    if (existing) {
      // If room exists but displayName changed, update it
      if (displayName && existing.displayName !== displayName) {
        existing.displayName = displayName;
        await existing.save();
      }
      return res.status(200).json(existing);
    }
    
    const room = new Room({ 
      name, 
      displayName: displayName || name, 
      type, 
      members: type === 'private' || type === 'workplace' ? members : [] 
    });
    await room.save();
    
    res.status(201).json(room);
  } catch (err) {
    console.error('[ERROR] Failed to create room:', err.message);
    res.status(500).json({ error: 'Failed to create room' });
  }
});


// In the PATCH /api/rooms/:name route:
router.patch('/:name', authMiddleware, async (req, res) => {
  const { members, displayName } = req.body;
  
  try {
    const room = await Room.findOne({ name: req.params.name });
    if (!room) return res.status(404).json({ message: 'Room not found' });

    // Update members if provided
    if (Array.isArray(members)) {
      const updatedMembers = Array.from(new Set([...room.members, ...members]));
      room.members = updatedMembers;
    }
    
    // Update displayName if provided
    if (displayName) {
      room.displayName = displayName;
    }
    

    await room.save();
    
    const io = require('../socket').getIo();
    if (io) {
      io.emit('new_room');
    }
    
    res.json(room);
  } catch (err) {
    console.error('[ERROR] Failed to update room:', err.message);
    res.status(500).json({ error: 'Failed to update room' });
  }
});

module.exports = router;


