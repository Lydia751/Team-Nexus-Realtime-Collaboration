import React, { useState, useEffect, useRef, useCallback} from 'react';
import { useParams, useNavigate} from 'react-router-dom';
import { createPortal } from 'react-dom';
import api from '../api';
import './SharedWorkspace.css';
import { FiEdit } from 'react-icons/fi';
import { v4 as uuidv4 } from 'uuid';
import ChatPopup from './ChatPopup';
import TaskPopup from './TaskPopup';
import { useChatNotifications } from './ChatNotificationContext';
import NotificationBadge from './NotificationBadge';
import socket from '../socket';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable 
} from '@dnd-kit/core';

import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';

import { CSS } from '@dnd-kit/utilities';

const SortableTask = (props) => {
  const [showTaskPopup, setShowTaskPopup] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [isCompletedByUser, setIsCompletedByUser] = useState(false);
  const [isCompletedByAll, setIsCompletedByAll] = useState(false);
  const navigate = useNavigate();
  const {
    task, columnId, editingTaskId, editedText,
    setEditedText, handleSaveEdit,
    handleEditClick, showActionsId, setShowActionsId,
    handleArchive, cardActionsRef, cardButtonRef, user,socket 
    } = props;
  const safeTaskId = task._id || task.id; 
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: task.id || task._id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  };
// Ref to the card actions dropdown menu
  const [dropdownPos, setDropdownPos] = useState({ x: 0, y: 0 });
  const currentUserEmail = user?.email?.toLowerCase();
    // Get the task completion status of the current user
  useEffect(() => {
    const fetchCompletionStatus = async () => {
      try {
        console.log(`[Task ${safeTaskId}] Fetching completion status...`);
        const response = await api.get(`/api/tasks/${safeTaskId}/completion-status`);
        console.log(`Task ${safeTaskId} completion status:`, response.data);
        setIsCompletedByUser(response.data.isCompletedByUser);

        // Check if all assignees have completed the task
        const completedBy = response.data.completedBy || [];
        const members = task.members || [];
        console.log(`Task ${safeTaskId} members:`, members);
        console.log(`Task ${safeTaskId} completedBy:`, completedBy);

        // If there are no members assigned, task can't be "completed by all"
        if (members.length === 0) {
          console.log(`Task ${safeTaskId} has no members, cannot be completed by all`);
          setIsCompletedByAll(false);
          return;
        }

        // Check if all members have completed the task
        const allCompleted = members.every(member => {
          const memberLower = member.toLowerCase();
          const isCompleted = completedBy.some(email => email.toLowerCase() === memberLower);
          console.log(`Member ${member}: completed = ${isCompleted}`);
          return isCompleted;
        });

        console.log(`Task ${safeTaskId} all members completed: ${allCompleted}`);
        setIsCompletedByAll(allCompleted);
      } catch (err) {
        console.error('Error fetching task completion status:', err);
        if (err.response) {
        console.error(`[Task ${safeTaskId}] Error response:`, err.response.data);
      }
      }
    };

    if (safeTaskId && currentUserEmail) {
      fetchCompletionStatus();
    }
  }, [safeTaskId, currentUserEmail, task.members]);

  // Listen for Socket events of task completion status changes
  useEffect(() => {
    const handleTaskCompletionUpdate = (data) => {
      if (data.taskId === safeTaskId) {
        // Checks whether the current user has marked this task as complete
        const isCompleted = data.completedBy.includes(currentUserEmail);
        setIsCompletedByUser(isCompleted);

        // Check if all members have completed the task
        const members = task.members || [];

        if (members.length === 0) {
          setIsCompletedByAll(false);
          return;
        }

        const allCompleted = members.every(member => 
          data.completedBy.some(email => email.toLowerCase() === member.toLowerCase())
        );

        setIsCompletedByAll(allCompleted);
      }
    };

    if (socket) {
      socket.on('task_completion_updated', handleTaskCompletionUpdate);

    return () => {
      socket.off('task_completion_updated', handleTaskCompletionUpdate);
    };
  }
  }, [safeTaskId, currentUserEmail, socket, task.members]);

  useEffect(() => {
    if (showActionsId === safeTaskId && cardButtonRef?.current) {
      const rect = cardButtonRef.current.getBoundingClientRect();
      setDropdownPos({ x: rect.right + 4, y: rect.top }); // right of edit icon
    }
  }, [showActionsId]);


  return (
    <>
    {console.log(`Rendering task ${safeTaskId}: completedByUser=${isCompletedByUser}, completedByAll=${isCompletedByAll}`)}
     <div 
      ref={setNodeRef} 
      style={style} 
      {...attributes} 
      {...listeners} 
      className={`task-card${isCompletedByAll ? ' task-completed' : (isCompletedByUser ? ' task-completed-by-user' : '')}`}
    >
          {/* The "Complete" checkmark is only displayed when the current user completes the task. */}
      {isCompletedByAll && (
          <span className="complete-badge">✓</span>
        )}
        {!isCompletedByAll && isCompletedByUser && (
          <span className="user-complete-badge">✓</span>
        )}

      {editingTaskId === safeTaskId ? (
        // Editable textarea shown only when this task is being edited
        <div className="card-edit-box">
          <textarea
            className="task-textarea"
            onPointerDown={(e) => e.stopPropagation()}
            value={editedText[safeTaskId] || ''}
            onChange={(e) =>
              setEditedText(prev => ({
                ...prev,
                [safeTaskId]: e.target.value
              }))
            }
          />
          <button className="save-edit-btn" 
          onClick={() => {
            handleSaveEdit(columnId, safeTaskId);

          }}>
            Save
          </button>
        </div>

        
      ) : (
        // Default task view with text and action buttons
        <div className="card-content">
          <span className="card-text">{task.title}</span>
           <button
            className="edit-btn"
            ref={cardButtonRef}
            onClick={(e) => {
              e.stopPropagation(); // Prevent bubbling to outside-click handler
              e.preventDefault();
              setShowActionsId((prev) => (prev === safeTaskId ? null : safeTaskId ));
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <FiEdit />
          </button> 


          {/* Action dropdown menu shown for the selected task */}
          {showActionsId === safeTaskId && 
          createPortal(
            
            <div 
              className="card-actions" 
              ref={cardActionsRef} 
              onPointerDown={(e) => e.stopPropagation()}
              style={{ top: dropdownPos.y, left: dropdownPos.x, position: 'absolute' }}
            >
                <button onClick={() => {
                  setSelectedTaskId(safeTaskId);
                  setShowTaskPopup(true);
                  setShowActionsId(null);
                }}>Open card</button>
                <button onClick={() => handleEditClick(safeTaskId, task.title || task.text)}>Edit card title</button>
                <button onClick={() => handleArchive(columnId, safeTaskId)}>Archive</button>
                
            </div>,
            document.body           

          )} 
          

        </div>
        
      )}
    </div>

    {showTaskPopup && (
      <TaskPopup 
        taskId={selectedTaskId} 
        user={user}
        onClose={() => setShowTaskPopup(false)}
      />
    )}
  </>
  );
};

// AddCardInput Component: Provides the textarea input to add a new task (card) in a column
// Memoized with React.memo to prevent unnecessary re-renders during typing
const AddCardInput = React.memo(({ columnId, value, onChange, onAdd, onCancel, inputRef }) => {
  return (
    <div className="task-input-box">
      <textarea
        ref={inputRef} // Used to programmatically focus the textarea
        className="task-textarea"
        placeholder="Enter a title for this card..."
        value={value}
        onChange={(e) => onChange(columnId, e.target.value)}
      />
      <div className="task-input-controls">
        <button className="add-task-btn" onClick={() => onAdd(columnId)}>Add card</button>
        <button className="cancel-btn" onClick={onCancel}>✕</button>
      </div>
    </div>
  );
});

// Column Component: Renders a single column (list) on the board
// Includes title, dropdown menu, list of tasks, and an AddCardInput if open
// Memoized with React.memo to avoid unnecessary re-renders when only other columns change
const Column = React.memo(({
  column,
  addingCardColumnId,
  setAddingCardColumnId,
  newTaskText,
  handleCardInputChange,
  handleAddTask,
  handleCancelCardInput,
  taskInputRefs,
  editingTaskId,
  editedText,
  setEditedText,
  handleSaveEdit,
  handleEditClick,
  showActionsId,
  setShowActionsId,
  handleArchive,
  cardActionsRefs,
  cardButtonRefs,
  showListMenuId,
  setShowListMenuId,
  handleArchiveList,
  handleArchiveAllTasks,
  listMenuRef,
  navigate,
  user
}) => {
  const { setNodeRef } = useDroppable({ id: column.id }); // Make the column a drop zone
  const [listMenuPos, setListMenuPos] = useState({ x: 0, y: 0 });
  const buttonRef = useRef(null);
  

  return (
    <div ref={setNodeRef} className="column">
      <div className="column-header">
        <h3>{column.title}</h3>
        <button className="column-menu-btn" ref={buttonRef} onClick={(e) => {
          const rect = buttonRef.current.getBoundingClientRect();
          setListMenuPos({ x: rect.right + 4, y: rect.top }); // menu shows right of the button
          setShowListMenuId(showListMenuId === column.id ? null : column.id);
        }}
        >⋯</button>
          {showListMenuId === column.id &&
            createPortal(
              <div
                className="list-menu"
                ref={listMenuRef}
                style={{
                  position: 'absolute',
                  top: `${listMenuPos.y}px`,
                  left: `${listMenuPos.x}px`,
                  zIndex: 9999,
                  background: 'white',
                  padding: '8px',
                  borderRadius: '6px',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.15)'
                }}
              >
                <button onClick={() => handleArchiveList(column.id)}>Archive this list</button>
                <button onClick={() => handleArchiveAllTasks(column.id)}>Archive all cards in this list</button>
              </div>,
              document.body
            )
          }
      </div>
        {/* Render Tasks */}
        {column.tasks.map(task => {
          const safeTaskId = task._id || task.id;
          return (
            <SortableTask
              key={safeTaskId}
              task={task}
              columnId={column.id}
              editingTaskId={editingTaskId}
              editedText={editedText}
              setEditedText={setEditedText}
              handleSaveEdit={handleSaveEdit}
              handleEditClick={handleEditClick}
              showActionsId={showActionsId}
              setShowActionsId={setShowActionsId}
              handleArchive={handleArchive}
              cardActionsRef={
                cardActionsRefs.current[safeTaskId] ||
                (cardActionsRefs.current[safeTaskId] = React.createRef())
              }
              cardButtonRef={
                cardButtonRefs.current[safeTaskId] ||
                (cardButtonRefs.current[safeTaskId] = React.createRef())
              }
              navigate={navigate}
              user={user}
              socket={socket}
            />
          );
        })}

      {/* Add Card Section */}
      {addingCardColumnId === column.id ? (
        <AddCardInput
          columnId={column.id}
          value={newTaskText[column.id] || ''}
          onChange={handleCardInputChange}
          onAdd={() => handleAddTask(column.id)}
          onCancel={handleCancelCardInput}
          inputRef={(el) => {
            if (el && taskInputRefs.current[column.id] !== el) {
              taskInputRefs.current[column.id] = el;
            }
          }}
        />
      ) : (
        <button
          className="add-card-toggle"
          onClick={() => setAddingCardColumnId(column.id)}
        >
          + Add a card
        </button>
      )}
    </div>
  );
});



const SharedWorkspace =( {user}) => {
  const navigate = useNavigate(); // For navigation
  const [columns, setColumns] = useState([]); // Stores all workspace columns
  const [newColumnTitle, setNewColumnTitle] = useState(''); // New column title
  const [newTaskText, setNewTaskText] = useState({}); // Tracks input text per column
  const [editingTaskId, setEditingTaskId] = useState(null); // Currently editing task ID
  const [editedText, setEditedText] = useState({}); // Currently edited task text
  const [showActionsId, setShowActionsId] = useState(null); // Shows side menu actions
  const [addingColumn, setAddingColumn] = useState(false); // Toggles new column input
  const [addingCardColumnId, setAddingCardColumnId] = useState(null); // Column ID where card input is shown
  const [showListMenuId, setShowListMenuId] = useState(null); // Controls visibility of list menu
  const { id: workplaceId } = useParams(); // Extracts workplace ID from URL
  const taskInputRefs = useRef({}); // Ref to store task input elements
  const cardActionsRefs = useRef({}); // Ref to store card action elements
  const cardButtonRefs = useRef({}); // Ref to store card button elements
  const [teamMembers, setTeamMembers] = useState([]); // List of team members
  const [showInviteBox, setShowInviteBox] = useState(false); // Toggles invite box visibility
  const [inviteEmail, setInviteEmail] = useState(''); // Email to invite
  const [creatorEmail, setCreatorEmail] = useState(''); // Creator's email
  const currentUserEmail = user.email; // Current user's email
  const [boardTitle, setBoardTitle] = useState(''); // Board title
  const [suggestions, setSuggestions] = useState([]); // Search suggestions
  const debounceRef = useRef(); // Ref for debounce timer
  // suggestions that aren’t the exact value just typed
  const visibleSuggestions = suggestions.filter(u => 
    u.email.toLowerCase() !== inviteEmail.trim().toLowerCase()
  );
  const [showChat, setShowChat] = useState(false);
  const { unreadCounts, markRoomAsRead } = useChatNotifications();
  const chatRoomId = `workspace-${workplaceId}`;
  const hasUnreadMessages = boardTitle && unreadCounts[boardTitle] > 0;
  const lastMarkAsReadTimeRef = useRef(0);
  const chatButtonDisabledRef = useRef(false);


  // fetch/save board data
  useEffect(() => {
  const fetchBoard = async () => {
    try {
      const response = await api.get(`/api/boards/${workplaceId}`);
      setColumns(response.data.columns || []);
      setBoardTitle(response.data.title || '');
    } catch (err) {
      console.error("Failed to get workplace:", err);
      alert("Failed to obtain workplace data");
    }
  };
    // Fetch team information when board data changes
  const fetchTeamInfo = async () => {
    try {
      const response = await api.get(`/api/boards/${workplaceId}/team`);
      setCreatorEmail(response.data.creator);
      
      const membersArray = Array.isArray(response.data.members)
        ? response.data.members.map(m =>
            typeof m === 'string'
              ? m
              : m.email || String(m)
          )
        : [];
      setTeamMembers(membersArray);
    } catch (err) {
      console.error("Failed to obtain team information:", err);
    }
  };

  fetchBoard();
  fetchTeamInfo();

  }, [workplaceId]);

  // Focus on the task input when adding a new card
  useEffect(() => {
    if (addingCardColumnId && taskInputRefs.current[addingCardColumnId]) {
      taskInputRefs.current[addingCardColumnId].focus();
    }
  }, [addingCardColumnId]);

  // Save board data to backend when columns change
  const saveBoard = async (updatedCols) => {
    setColumns(updatedCols); 
    
    try {
      await api.put(`/api/boards/${workplaceId}`, {
        columns: updatedCols
      });
    } catch (err) {
      console.error("Failed to save workplace:", err);
      alert("Failed to save workplace");
    }
  };


    // debounce lookup as the user types
    useEffect(() => {
      clearTimeout(debounceRef.current);
      const q = inviteEmail.trim();
      if (q.length < 2) {
        setSuggestions([]);
        return;
      }
      debounceRef.current = setTimeout(() => {
        api
          .get('/api/users/search', { params: { q } })
          .then(res => setSuggestions(res.data))
          .catch(() => setSuggestions([]));
      }, 300);
      return () => clearTimeout(debounceRef.current);
    }, [inviteEmail]);
  
  // Invite a user to the board
  const handleInvite = async () => {

    if (!inviteEmail.trim()) {
      setShowInviteBox(false);    // ← close modal when blank
      return;
    }

    const email = inviteEmail.trim().toLowerCase();
    // duplicate‐check: owner or already invited?
    if (email === creatorEmail.toLowerCase() ||
        teamMembers.map(m => m.toLowerCase()).includes(email)
    ) {
      alert(`${inviteEmail} is already a member`); 
      return;
    }

    // Keep a copy of current members in case need to roll back
    const prevMembers = [...teamMembers];

    try {
      const response = await api.post(`/api/boards/${workplaceId}/invite`, {
            inviteEmail
          });

          if (Array.isArray(response.data.teamMembers)) {
            setTeamMembers(response.data.teamMembers);
          }
          setInviteEmail('');
  
    } catch (err) {
      console.error('invite error', err);
      alert("Network error—please try again");
      // Rollback to previous state if invite fails
      setTeamMembers(prevMembers);
    }
  };

  // Remove a member
  const handleRemove = async (email) => {
    try {
      const response = await api.delete(`/api/boards/${workplaceId}/member`, {
        data: { 
          removeEmail: email.trim().toLowerCase() 
        }
      });

      const data = response.data;

      setTeamMembers(Array.isArray(data.teamMembers) ? data.teamMembers : []);
    } catch (err) {
      console.error('Failed to remove member:', err);

      if (err.response && err.response.data && err.response.data.message) {
        alert(err.response.data.message);
      } else {
        alert(err.message || 'Failed to remove member');
      }
    }
  };



  // Edit button clicked
  const handleEditClick = (taskId, taskTitle) => {
    setEditingTaskId(taskId);
    setEditedText(prev => ({ ...prev, [taskId]: taskTitle }));
    //setEditedText(taskTitle);
  };

  // Save edited task
  const handleSaveEdit = async (colId, taskId) => {
    const updatedCols = columns.map(col => {
      if (col.id === colId) {
        const updatedTasks = col.tasks.map(task => {
          const safeTaskId = task._id || task.id;
          return safeTaskId === taskId
            ? { ...task, title: editedText[taskId] || '' }
            : task;
        });
        return { ...col, tasks: updatedTasks };
      }
      return col;
    });

      // Save to MongoDB tasks collection
    await api.put(`/api/tasks/${taskId}`, {
      title: editedText[taskId] || ''
    });
    //Save board state (columns) as usual
    saveBoard(updatedCols);
    setEditingTaskId(null);
    setShowActionsId(null);
  };

  // Archive a single card by removing it from the specified column
  const handleArchive = async (colId, taskId) => {

    try {
      // 1. Call backend to delete the task from MongoDB
      await api.delete(`/api/tasks/${taskId}`);
  
      // 2. Update frontend: remove task from column
      const updatedCols = columns.map((col) => {
        if (col.id === colId) {
          return {
            ...col,
            tasks: col.tasks.filter((task) => task._id !== taskId && task.id !== taskId),
          };
        }
        return col;
      });

      setColumns(updatedCols);
      setShowActionsId(null);
  
      // 3. Save changes to the board
      await saveBoard(updatedCols);
    } catch (err) {
      console.error('Error archiving task:', err);
      if (err.response && err.response.data) {
      alert(`Failed to archive task: ${err.response.data.error || err.response.data.message || 'Unknown error'}`);
    } else {
      alert('Failed to archive task.');
    }
    }
  };

  // Archive all cards in a list
  const handleArchiveAllTasks = (colId) => {
    const updatedCols = columns.map(col =>
      col.id === colId ? { ...col, tasks: [] } : col
    );
    //setColumns(updatedCols);
    saveBoard(updatedCols); // Save to backend
    setShowListMenuId(null);
  };

  // Archive the whole list
  const handleArchiveList = (colId) => {
    const filteredCols = columns.filter(col => col.id !== colId);
    //setColumns(filteredCols);
    saveBoard(filteredCols); // Save to backend
    setShowListMenuId(null);
  };

  // Add a task to column
  const handleAddTask = async (colId) => {
    const text = newTaskText[colId]?.trim();
    if (!text) return;
  
    try {
      // Create task in DB
      const response = await api.post("/api/tasks", {
        title: text, 
        workplaceId, 
        columnId: colId
      });

      const savedTask = response.data;
      savedTask.id = savedTask._id; // Ensure 'id' exists
  
      // Add task to correct column in board
      const updatedCols = columns.map((col) => {
        if (col.id === colId) {
          return {
            ...col,
            tasks: [...col.tasks, savedTask], // use the task returned from DB
          };
        }
        return col;
      });
  
      await saveBoard(updatedCols);
      setNewTaskText({ ...newTaskText, [colId]: "" });
      setAddingCardColumnId(null);
  
    } catch (err) {
      console.error("Failed to create task:", err);
      if (err.response && err.response.data) {
        alert(`Failed to add task: ${err.response.data.message || 'Unknown error'}`);
      } else {
        alert("Failed to add task");
      }
    }
  };

  // Add a new column
  const handleAddColumn = () => {
    if (!newColumnTitle.trim()) return;
    const newCol = {
      id: uuidv4(),
      title: newColumnTitle,
      tasks: []
    };
    const updated = [...columns, newCol];
    saveBoard(updated); // Save to backend
    //setColumns([...columns, newCol]);
    setNewColumnTitle('');
    setAddingColumn(false);
  };

  const listMenuRef = useRef(null); // ref to list menu container
  //Close dropdowns when clicking outside
  //This effect listens for clicks outside the card actions and list menu to close them
  useEffect(() => {
    const handleClickOutside = (event) => {
      setTimeout(() => {
        const clickedInsideAnyCardAction = Object.values(cardActionsRefs.current).some(
          (ref) => ref.current && ref.current.contains(event.target)
        );
        
        // New check for SVG or anything inside the dropdown
        const isInsideDropdown = event.target.closest('.card-actions');

        if (!clickedInsideAnyCardAction && !isInsideDropdown) {
          setShowActionsId(null);
        }
  
        if (
          listMenuRef.current &&
          !listMenuRef.current.contains(event.target)
        ) {
          setShowListMenuId(null);
        }
      }, 50);
    };
  
    document.addEventListener('mousedown', handleClickOutside, true);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over) return;
  
    const activeId = active.id;
    const overId = over.id;
  
    if (activeId === overId) return;
  
    let sourceColIndex = null;
    let sourceTaskIndex = null;
    let destinationColIndex = null;
    let destinationTaskIndex = null;
    let taskToMove = null;
  
    // Find source column and task
    columns.forEach((col, colIdx) => {
      const idx = col.tasks.findIndex(task => task.id === activeId);
      if (idx !== -1) {
        sourceColIndex = colIdx;
        sourceTaskIndex = idx;
        taskToMove = col.tasks[idx];
      }
    });
  
    // Find destination column and task position
    columns.forEach((col, colIdx) => {
      const idx = col.tasks.findIndex(task => task.id === overId);
      if (idx !== -1) {
        destinationColIndex = colIdx;
        destinationTaskIndex = idx;
      }
    });
  
    // Handle dropping on an empty column
    if (destinationColIndex === null) {
      destinationColIndex = columns.findIndex(col => col.id === overId);
      destinationTaskIndex = columns[destinationColIndex]?.tasks.length || 0;
    }
  
    if (sourceColIndex === null || destinationColIndex === null || !taskToMove) return;
  
    const updatedCols = [...columns];
    // Remove from source
    updatedCols[sourceColIndex].tasks.splice(sourceTaskIndex, 1);
    // Insert into destination
    updatedCols[destinationColIndex].tasks.splice(destinationTaskIndex, 0, taskToMove);
  
    saveBoard(updatedCols);
  };

  const handleCardInputChange = useCallback((columnId, text) => {
    setNewTaskText((prev) => ({
      ...prev,
      [columnId]: text,
    }));
  }, []);
  
  const handleCancelCardInput = useCallback(() => {
    setAddingCardColumnId(null);
  }, []);
  

const handleWorkplaceChat = async () => {
  // Prevent multiple rapid calls
  if (chatButtonDisabledRef.current) return;
  chatButtonDisabledRef.current = true;
  
  // Re-enable after 2 seconds
  setTimeout(() => {
    chatButtonDisabledRef.current = false;
  }, 2000);
  
  try {
    // Mark room as read only once when opening chat
    const now = Date.now();
    if (now - lastMarkAsReadTimeRef.current > 5000) {
      lastMarkAsReadTimeRef.current = now;
      markRoomAsRead(chatRoomId);
    }
    
    // Ensure member array is correct
    const allMembers = Array.from(new Set([creatorEmail, ...teamMembers].flat()))
      .filter(Boolean);
    
    // Show chat window first to avoid delay
    setShowChat(true);
    
    // Then update room in background
    try {
      await api.patch(`/api/rooms/${encodeURIComponent(chatRoomId)}`, {
        members: allMembers, 
        displayName: boardTitle
      });
    } catch (err) {
      // Only create if it doesn't exist (status 404)
      if (err.response?.status === 404) {
        await api.post('/api/rooms', {
          name: chatRoomId,
          displayName: boardTitle,
          type: 'workplace',
          members: allMembers
        });
      } else {
        console.error('Error updating room:', err);
      }
    }
  } catch (err) {
    console.error('Error initializing chat:', err);
  }
};


  
// ===== File Upload Related State =====
const [uploadFile, setUploadFile] = useState(null);
const [uploadedFiles, setUploadedFiles] = useState([]);
const fileInputRef = useRef(null);

const handleFileUpload = async (e) => {
  e.preventDefault();
  if (!uploadFile || !workplaceId) return alert("Please select a file");

  const formData = new FormData();
  formData.append("file", uploadFile);
  formData.append("workplaceId", workplaceId);

  try {
    await api.post('/api/files/upload', formData);
    alert("Upload successful");

    setUploadFile(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    fetchUploadedFiles(); // refresh list
  } catch (error) {
    console.error("Upload error:", error);
    alert("Upload failed");
  }
};

const fetchUploadedFiles = async () => {
  try {
    const res = await api.get(`/api/files/${workplaceId}`);
    setUploadedFiles(res.data);
  } catch (err) {
    console.error("Error fetching uploaded files:", err);
  }
};

const handleDeleteFile = async (id) => {
  if (!window.confirm('Are you sure you want to delete this file?')) return;
  
  try {
    await api.delete(`/api/files/${id}`);
    fetchUploadedFiles(); // Refresh the file list
  } catch (err) {
    console.error('Error deleting file:', err);
    alert('Failed to delete file');
  }
};

useEffect(() => {
  if (workplaceId) {
    fetchUploadedFiles();
  }
}, [workplaceId]);

  return (
    <div className="board-container">
      <h2 className="board-title">{boardTitle}</h2>

      {/* Add List and manage team Section */}
      <div className="add-column-actions">
        {addingColumn ? (
          <div className="add-column-form">
            <input
              className="column-input"
              type="text"
              placeholder="Enter list name..."
              value={newColumnTitle}
              onChange={(e) => setNewColumnTitle(e.target.value)}
            />
            <div className="add-column-controls">
              <button className="create-btn" onClick={handleAddColumn}>Add list</button>
              <button className="cancel-btn" onClick={() => {setAddingColumn(false); setNewColumnTitle(""); }}>✕</button>
            </div>
          </div>
        ) : (
          
            <button className="new-column-btn" onClick={() => setAddingColumn(true)}>+ Add new list</button>
          
        )}

      {creatorEmail?.trim().toLowerCase() === currentUserEmail?.trim().toLowerCase() && (
          <button
            className="new-column-btn"
            onClick={() => {setShowInviteBox((b) => !b); setInviteEmail("");}}
          >
            Manage Team
          </button>
        )}

          {/*Chat button */}
          <button
            className="new-column-btn"
            onClick={handleWorkplaceChat} 
            style={{ position: 'relative' }}
          >
            Chat
            {hasUnreadMessages && <span className="notification-dot"></span>}
          </button>

        {showInviteBox && (
          <div className="manage-team-modal">
            <div className="mt-header">
              {/* <h3>Share “{workspaceName || 'project'}”</h3> */}
              <h3>Manage Team</h3>
              <button className="mt-close" onClick={() => {setShowInviteBox(false); setInviteEmail(""); }}>×</button>
            </div>
            <div style={{ position: 'relative' }}>
            <input
              className="mt-input"
              type="email"
              placeholder="Invite people by email..."
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleInvite()}
              autoComplete="off"
            />

            {suggestions.length > 0 && (
              <ul className="autocomplete-list">
                {visibleSuggestions.map(u => (
                  <li key={u.email}
                      onClick={() => {
                        setInviteEmail(u.email);
                        setSuggestions([]);
                      }}>
                    <strong>{u.email}</strong><br/>
                    <small>{u.name}</small>
                  </li>
                ))}
              </ul>
            )}
          </div>

            <div className="mt-people-list">
              {/* Owner */}
              <div className="mt-person owner">
                <span className="mt-avatar"></span>
                <div>
                  <strong>{currentUserEmail} (you)</strong><br/>
                  <small>Owner</small>
                </div>
              </div>
              {/* member */}
              {teamMembers.map(email => (
                <div key={email} className="mt-person editor">
                  <span className="mt-avatar">👤</span>
                  <div>
                    <strong>{email}</strong><br/>
                    <small>Member</small>
                  </div>
                  <button
                    className="mt-remove-btn"
                    onClick={() => {
                      if(window.confirm(`Are you sure you want to remove ${email} from this workplace?`)) {
                        handleRemove(email);
                      }

                    }}
                      // handleRemove(email)}
                  >
                    remove
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-footer">
              <button className="mt-done" onClick={handleInvite}>Save</button>
            </div>
          </div>
        )}


      </div>
      
      {/* Render Popup */}
      {showChat && (
        <ChatPopup
          roomName={boardTitle}
          roomId={`workspace-${workplaceId}`}
          members={[creatorEmail, ...teamMembers]}
          onClose={() => setShowChat(false)}
        />
      )}


      <div className="board-spacer" />

      {/* Render Columns */}
      <DndContext
        // sensors={useSensors(useSensor(PointerSensor))}
        sensors={useSensors(
          useSensor(PointerSensor, {
            activationConstraint: {
              distance: 5, // user must move 5px before dragging starts
            },
          })
        )}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div className="board-columns">
          {columns.map((column) => (
            <SortableContext
              key={column.id}
              items={column.tasks.map(task => task._id || task.id)}
              strategy={verticalListSortingStrategy}
            >
              <Column
                column={column}
                addingCardColumnId={addingCardColumnId}
                setAddingCardColumnId={setAddingCardColumnId}
                newTaskText={newTaskText}
                handleCardInputChange={handleCardInputChange}
                handleAddTask={handleAddTask}
                handleCancelCardInput={handleCancelCardInput}
                taskInputRefs={taskInputRefs}
                editingTaskId={editingTaskId}
                editedText={editedText}
                setEditedText={setEditedText}
                handleSaveEdit={handleSaveEdit}
                handleEditClick={handleEditClick}
                showActionsId={showActionsId}
                setShowActionsId={setShowActionsId}
                handleArchive={handleArchive}
                cardActionsRefs={cardActionsRefs}
                showListMenuId={showListMenuId}
                setShowListMenuId={setShowListMenuId}
                handleArchiveList={handleArchiveList}
                handleArchiveAllTasks={handleArchiveAllTasks}
                listMenuRef={listMenuRef}
                cardButtonRefs={cardButtonRefs}
                user={user}
              />
            </SortableContext>
          ))}
        </div>

      </DndContext>
     
      {/* File Upload Section */}
<div className="file-upload-section" style={{ marginTop: "40px" }}>
  <h3>Shared Files</h3>

  <form onSubmit={handleFileUpload} style={{ marginBottom: "20px" }}>
    <input
      type="file"
      ref={fileInputRef}
      onChange={(e) => setUploadFile(e.target.files[0])}
      className="file-input"
    />
    <button type="submit" className="upload-btn">
      Upload File
    </button>
  </form>

  {uploadedFiles.length > 0 ? (
    <ul className="files-list">
      {uploadedFiles.map((file) => (
        <li key={file._id} className="file-item">
          <span className="file-name">
            {file.filename.split('-').slice(1).join('-')}
          </span>
          
          <div className="file-actions">
            <a
              href={file.fileUrl}
              download
              className="download-btn"
            >
              Download
            </a>
            
            <button
              onClick={() => handleDeleteFile(file._id)}
              className="delete-btn"
            >
              Delete
            </button>
          </div>
        </li>
      ))}
    </ul>
  ) : (
    <p className="no-files-message">No files uploaded yet</p>
  )}
</div>



    </div>
  );
};

export default SharedWorkspace;