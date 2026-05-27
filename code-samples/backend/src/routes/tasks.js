const express = require('express');
const Task = require('../models/Task');
const mongoose = require('mongoose');
const router = express.Router();
const Board   = require('../models/Board');


// GET /api/tasks/my
// returns all tasks where the current user is in members OR is the assignee
router.get('/my', async (req, res) => {
  try {
    const me = req.headers['x-user-email'];
    if (!me) return res.status(401).json({ error: 'Missing user email' });

    // find tasks where user is member or assignee, AND has NOT hidden it
    const tasks = await Task.find({
      $and: [
        { hiddenFor: { $ne: me } },
        {$or: [
        { members: me.toLowerCase() },
        { assignee: { $regex: new RegExp(`^${me}$`, 'i') } }
      ]}]
    })
    // populate the workplace to show the name
    .populate({ path: 'workplaceId', select: 'name' })
    .lean();

    // column name on each task:
    // since Board stores the column/task structure, need to map columnId→column.title
    const boards = await Board.find({
      workplaceId: { $in: tasks.map(t => t.workplaceId._id) }
    })
    .select('workplaceId columns')
    .lean();

    // build a lookup: workplaceId → { columnId → columnTitle, workplaceName }
    const lookup = boards.reduce((acc, b) => {
      const byColumn = {};
      (b.columns||[]).forEach(c => byColumn[c.id] = c.title);
      acc[b.workplaceId] = {
        workplaceName: b.title || '', 
        columnTitles:  byColumn
      };
      return acc;
    }, {});

    // shape the response
    const out = tasks.map(t => {
      const wp  = t.workplaceId;
      const lu  = lookup[wp._id] || {};
      const hasRead = Array.isArray(t.read) && t.read.includes(me.toLowerCase());
      const isCompletedByCurrentUser = Array.isArray(t.completedBy) && 
        t.completedBy.includes(me.toLowerCase());
      return {
        id:           t._id,
        title:        t.title,
        dueDate:      t.endDate,
        startDate:    t.startDate,
        createdAt:    t.createdAt,
        completed: t.completed,
        completedBy: t.completedBy,
        isRead:    hasRead,
        source:       `${wp.name||''} / ${lu.columnTitles[t.columnId]||''}`,
      };
    });

    res.json(out);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/tasks/unread
router.get('/unread', async (req, res) => {
  try {
    // Get the user's email address from the request header
    const userEmail = req.headers['x-user-email'];
    
    // Add debug log
    console.log('Unread tasks request headers:', req.headers);
    console.log('User email from header:', userEmail);

    if (!userEmail) {
      return res.status(400).json({ 
        error: 'Missing user email in request headers',
        message: 'User email is required to fetch unread tasks' 
      });
    }

    // Make sure the email address is lowercase
    const normalizedEmail = userEmail.toLowerCase();
    
    // Query the number of tasks assigned to the user but not read by the user
    const count = await Task.countDocuments({
      members: normalizedEmail,
      read: { $ne: normalizedEmail }
    });

    res.json({ count });
  } catch (err) {
    console.error('Error fetching unread tasks count:', err);
    res.status(500).json({ 
      error: 'Internal server error',
      message: err.message 
    });
  }
});

// Obtain a certain task
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  // Validate MongoDB ObjectId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid task ID format' });
  }

  try {
    const task = await Task.findById(id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json(task);
  } catch (err) {
    console.error('[GET /api/tasks/:id]', err);
    res.status(500).json({ error: err.message });
  }
});


router.get('/:id/completion-status', async (req, res) => {
  try {
    const taskId = req.params.id;
    const userEmail = req.headers['x-user-email']?.toLowerCase();
    
    console.log(`[GET Completion Status] Task ID: ${taskId}, User: ${userEmail}`);
    
    if (!userEmail) {
      return res.status(400).json({ error: 'User email is required' });
    }

    const task = await Task.findById(taskId);
    if (!task) {
      console.log(`[GET Completion Status] Task ${taskId} not found`);
      return res.status(404).json({ error: 'Task not found' });
    }

    console.log(`[GET Completion Status] Task ${taskId} data:`, task);
    
    // Ensure completedBy is an array
    const completedBy = Array.isArray(task.completedBy) ? task.completedBy : [];
    const members = Array.isArray(task.members) ? task.members : [];
    
    console.log(`[GET Completion Status] Task ${taskId} members (${members.length}):`, members);
    console.log(`[GET Completion Status] Task ${taskId} completedBy (${completedBy.length}):`, completedBy);

    // Check if current user has completed this task
    const isCompletedByUser = completedBy.some(email => 
      email.toLowerCase() === userEmail.toLowerCase()
    );

    // Check if all assignees have completed the task
    const allCompleted = members.length > 0 && members.every(member => {
      const memberLower = member.toLowerCase();
      const isCompleted = completedBy.some(email => email.toLowerCase() === memberLower);
      console.log(`[GET Completion Status] Member ${member} completed: ${isCompleted}`);
      return isCompleted;
    });
    
    console.log(`[GET Completion Status] Task ${taskId} completed by user: ${isCompletedByUser}`);
    console.log(`[GET Completion Status] Task ${taskId} completed by all: ${allCompleted}`);

    res.json({ 
      taskId,
      isCompletedByUser,
      isCompletedByAll: allCompleted,
      completedBy,
      members
    });
  } catch (err) {
    console.error('Error getting task completion status:', err);
    res.status(500).json({ error: err.message });
  }
});


// Create a new task
router.post('/', async (req, res) => {
  try {
    // 1) Pull out columnId along with the other fields
    const {
      title = '',
      description = '',
      assignee = '',
      startDate = null,
      endDate = null,
      members = [],
      labels = [],
      checklist = [],
      workplaceId,
      columnId
    } = req.body;

    // 2) validate that columnId is present
    if (!columnId) {
      return res.status(400).json({ error: 'columnId is required' });
    }

    // 3) Create the task, including columnId
    const newTask = await Task.create({
      title,
      description,
      assignee,
      startDate,
      endDate,
      members,
      labels,
      checklist,
      workplaceId,   
      columnId       // ← now satisfies the Task.schema required field
    });

    return res.status(201).json(newTask);
  } catch (err) {
    console.error('Error creating task:', err);
    return res.status(500).json({ error: err.message });
  }
});


// POST /api/tasks/mark-read - Mark all tasks as read
router.post('/mark-read', async (req, res) => {
  try {
    const userEmail = req.headers['x-user-email'];
    const { notificationsOnly = false } = req.body;
    
    if (!userEmail) return res.status(401).json({ error: 'Missing user email' });

    // only clear the notification, the task status is not actually updated
    if (notificationsOnly) {
      console.log(`Clear users only ${userEmail} notification, do not update the task read status`);
      
      // Return a successful response directly
      return res.json({ 
        success: true, 
        notificationsCleared: true,
        message: 'Notifications cleared without updating task read status'
      });
    }
    
    // If not clearing notification only, update task read status normally
    console.log(`User ${userEmail} all unread tasks are read`);
    
    const tasks = await Task.find({
      members: userEmail.toLowerCase(),
      read: { $ne: userEmail.toLowerCase() }
    });

    // Add users to the read list of each task
    const updatePromises = tasks.map(task => {
      const readList = Array.isArray(task.read) ? [...task.read] : [];
      if (!readList.includes(userEmail.toLowerCase())) {
        readList.push(userEmail.toLowerCase());
      }
      return Task.updateOne({ _id: task._id }, { read: readList });
    });

    await Promise.all(updatePromises);
    res.json({ 
      success: true, 
      count: updatePromises.length,
      message: 'All tasks marked as read'
    });
  } catch (err) {
    console.error('Error marking tasks as read:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/mark-single-read', async (req, res) => {
  try {
    // Supports getting mailboxes from both request body and request header
    const userEmail = req.body.email || req.headers['x-user-email'];
    
    if (!userEmail) {
      console.error('Missing user email in request');
      return res.status(401).json({ error: 'Missing user email' });
    }
    
    // Normalize email addresses to lowercase
    const normalizedEmail = userEmail.toLowerCase();
    
    console.log(`Marking task ${req.params.id} as read for user ${normalizedEmail}`);
    
    const task = await Task.findById(req.params.id);
    if (!task) {
      console.error(`Task not found: ${req.params.id}`);
      return res.status(404).json({ error: 'Task not found' });
    }
    
    console.log(`Current read list:`, task.read);
    
    // Make sure the read field is an array
    const readList = Array.isArray(task.read) ? [...task.read] : [];
    
    // Check if the mailbox already exists (case insensitive)
    const emailExists = readList.some(email => 
      email.toLowerCase() === normalizedEmail
    );
    
    if (!emailExists) {
      // Add normalized mailbox
      readList.push(normalizedEmail);
      
      console.log(`Updated read list:`, readList);
      
      // Update the task and check the results
      const updateResult = await Task.updateOne(
        { _id: task._id }, 
        { read: readList }
      );
      
      if (updateResult.modifiedCount === 0) {
        console.warn(`Warning: Database reported no modifications for task ${task._id}`);
      } else {
        console.log(`Successfully updated read status for task ${task._id}`);
      }
    } else {
      console.log(`Email already in read list, no update needed`);
    }
    
    // Return detailed response
    res.json({ 
      success: true,
      message: 'Task marked as read',
      taskId: task._id,
      email: normalizedEmail,
      wasUpdated: !emailExists
    });
  } catch (err) {
    console.error('Error marking task as read:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update the task
router.put('/:id', async (req, res) => {
  try {
    const taskId = req.params.id;
    const userEmail = req.headers['x-user-email']?.toLowerCase();
    const { completed, userSpecificAction } = req.body;

    console.log(`[PUT Task] Task ID: ${taskId}, User: ${userEmail}`);
    console.log('[PUT Task] Request body:', req.body);
    
    if (!userEmail) {
      return res.status(400).json({ error: 'Missing user email' });
    }

    const task = await Task.findById(taskId);
    if (!task) {
      console.log(`[PUT Task] Task ${taskId} not found`);
      return res.status(404).json({ error: 'Task not found' });
    }
    console.log(`[PUT Task] Original task data:`, task);

    // Handling updates of different fields
    for (const [key, value] of Object.entries(req.body)) {
      // Do not process special fields
      if (key !== 'userSpecificAction' && key !== 'completed') {
        console.log(`[PUT Task] Updating field "${key}":`, value);
        task[key] = value;
      }
    }

    // If it is a user-specific operation, update the completedBy array
    if (userSpecificAction && completed !== undefined) {
      console.log(`[PUT Task] User specific action, completed=${completed}`);
      // Make sure completedBy is an array
      if (!Array.isArray(task.completedBy)) {
        task.completedBy = [];
      }

      if (completed) {
        // Add the user to the completed list (if not already in the list)
        if (!task.completedBy.includes(userEmail)) {
          console.log(`[PUT Task] Adding ${userEmail} to completedBy array`);
          task.completedBy.push(userEmail);
        }
      } else {
        // Remove a user from the completed list
        console.log(`[PUT Task] Removing ${userEmail} from completedBy array`);
        task.completedBy = task.completedBy.filter(email => email !== userEmail);
      }
      

    } else if (completed !== undefined) {
      // Update the global completion status only if it is not a user specific action (for backward compatibility)
      console.log(`[PUT Task] Global action, completed=${completed}`);
      task.completed = completed;
    }
    console.log(`[PUT Task] Updated task data:`, task);
    console.log(`[PUT Task] Members array after update:`, task.members);
    console.log(`[PUT Task] CompletedBy array after update:`, task.completedBy);

    await task.save();
    
    // Send a notification to let other clients know that this user's completion status has changed
    const { getIo } = require('../socket');
    const io = getIo();
    if (io && userSpecificAction) {
      console.log(`[PUT Task] Emitting task_completion_updated socket event`);
      io.emit('task_completion_updated', {
        taskId: task._id,
        completedBy: task.completedBy,
        updatedByUser: userEmail
      });
    }

    res.json(task);
  } catch (err) {
    console.error('Error updating task:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/tasks/:id/hide
router.put('/:id/hide', async (req, res) => {
  const me = req.headers['x-user-email']?.toLowerCase();
  if (!me) return res.status(400).json({ error: 'Missing user email' });

  try {
    // add me to hiddenFor, but only once
    await Task.findByIdAndUpdate(req.params.id, {
      $addToSet: { hiddenFor: me }
    });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id/toggle-completed', async (req, res) => {
  try {
    const taskId = req.params.id;
    const userEmail = req.headers['x-user-email']?.toLowerCase();
    const { completed } = req.body;
    
    if (completed === undefined) {
      return res.status(400).json({ 
        error: 'Missing completed field in request body',
        message: 'The completed field is required' 
      });
    }
    

    if (!userEmail) {
      return res.status(401).json({ error: 'User email is required' });
    }

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ 
        error: 'Task not found',
        message: `No task found with ID: ${taskId}` 
      });
    }

    if (!Array.isArray(task.completedBy)) {
      task.completedBy = [];
    }

    // Update completedBy array
    if (completed) {
      // add the user to completedBy (if not already in the list)
      if (!task.completedBy.includes(userEmail)) {
        task.completedBy.push(userEmail);
      }
    } else {
      // Remove user from completedBy
      task.completedBy = task.completedBy.filter(email => email !== userEmail);
    }

    // The global completion status is still preserved (for backward compatibility)
    task.completed = completed;

    await task.save();
    
    // Send a Socket notification to let other clients know that the task status has changed
    const { getIo } = require('../socket');
    const io = getIo();
    if (io) {
      io.emit('task_completion_updated', {
        taskId: task._id,
        completedBy: task.completedBy,
        updatedByUser: userEmail,
        completed: completed
      });
    }

    res.json({
      message: `Task marked as ${completed ? 'completed' : 'incomplete'}`,
      task: {
        _id: task._id,
        title: task.title,
        completedBy: task.completedBy,
        completed: task.completed,
        isCompletedByUser: task.completedBy.includes(userEmail)
      }
    });
  } catch (err) {
    console.error('Error toggling task completion:', err);
    res.status(500).json({ error: 'Internal server error', message: err.message});
  }
});

// Delete a task by ID
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  // Optional: validate ID
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid task ID format' });
  }

  try {
    const deleted = await Task.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.status(200).json({ message: 'Task deleted successfully' });
  } catch (err) {
    console.error('[DELETE /api/tasks/:id]', err);
    res.status(500).json({ error: err.message });
  }
});


module.exports = router;

