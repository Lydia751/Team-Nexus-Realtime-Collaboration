import React, { useState, useEffect, useRef} from 'react';
import { useNavigate } from 'react-router-dom';
import './TaskBoard.css';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import api from '../api';
import socket from '../socket';



export default function Taskboard({user, taskId }) {
  //const { taskId } = useParams();
  const navigate = useNavigate();
  const [task, setTask] = useState(null);
  const [error, setError] = useState(null);
  const [showLeave, setShowLeave] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [showLabels, setShowLabels] = useState(false);
  const [showChecklist, setShowChecklist] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [members, setMembers] = useState([]);
  const [labels, setLabels] = useState([]);
  const [newLabel, setNewLabel] = useState('');
  const [checklist, setChecklist] = useState([]);
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [workplaceMembers, setWorkplaceMembers] = useState([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState('');
  const dropdownRef = useRef(null);

  if (!user) {
    console.warn('TaskBoard: user prop is missing');
    return <div className="loading-container">Missing user information...</div>;
  }

  const currentUserEmail = user?.email;


  useEffect(() => {

    if (!taskId) {
      setError('Invalid task ID');
      return;
    }
    // 1) Load the task
    api.get(`/api/tasks/${taskId}`)
      .then(taskRes => {
        const taskData = taskRes.data;
        console.log("Fetched task:", taskData);
        console.log("Task members array:", taskData.members || []);
        console.log("Task completedBy array:", taskData.completedBy || []);
        if (!taskData) {
          setError('Task not found');
          return;
        }
  
        // 2) Seed local state
        setTask(taskData);
        setMembers(taskData.members   || []);
        setLabels(taskData.labels     || []);
        setChecklist(taskData.checklist || []);
  
        // 3) If it’s a workplace task, pull in the allowed members+owner
        if (taskData.workplaceId) {
            api.get(`/api/boards/${taskData.workplaceId}/team`) 
            .then(({ data }) => {
              const owner = String(data.creator || '')
            .trim()
            .toLowerCase();
              // robustly normalize each entry in data.members
              const memberEmails = (data.members || []).map(m => {
                  if (typeof m === 'string') {
                    return m.trim().toLowerCase();
                  }
                  if (m && typeof m.email === 'string') {
                    return m.email.trim().toLowerCase();
                  }
                  // fallback: turn anything else into a string
                  return String(m).trim().toLowerCase();
                });

            const allAllowed = Array.from(new Set([ owner, ...memberEmails]));
            console.log("Members allowed on this task:", allAllowed);
            setWorkplaceMembers(allAllowed);
          })
          .catch(err => console.error("Error fetching team:", err));
        }
      }
    )
      .catch(err => {
        console.error('Error fetching task:', err);
        setError('Error fetching task');
      });
  }, [taskId]);

  useEffect(() => {
  const handleClickOutside = (event) => {
    if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
      setDropdownOpen(false);
    }
  };

  document.addEventListener('mousedown', handleClickOutside);
  return () => {
    document.removeEventListener('mousedown', handleClickOutside);
  };
}, []);

  const handleSave = () => {
    console.log("handleSave called");
  console.log("Current task state:", task);
  console.log("Current members before save:", members);
    const payload = {
      title: task.title,
      description: task.description,
      assignee: task.assignee,
      startDate: task.startDate ? new Date(task.startDate) : null,
      endDate: task.endDate ? new Date(task.endDate) : null,
      members,
      labels,
      checklist
    };
    console.log("Payload sent to server during save:", payload);

    api.put(`/api/tasks/${taskId}`, payload) 
      .then(res => {
        const updated = res.data;
        console.log("Server response after save:", updated);
      console.log("Server returned members array after save:", updated.members || []);
      
        setTask(updated);
        setMembers(updated.members || []);
        setLabels(updated.labels || []);
        setChecklist(updated.checklist || []);

        setShowToast(true);
        setTimeout(() => {
          setShowToast(false);
          // navigate(-1); 
        }, 1000); 
      })
      .catch(err => {
        console.error('Error saving task:', err);
        console.error('Error details:', err.response ? err.response.data : err.message);
        alert('Error saving task: ' + err.message);
      });
  };

  const handleSelectUser = (email) => {
    setSelectedUser(email);
    setDropdownOpen(false);
  };

  const handleAddUser = async () => {
  console.log("handleAddUser called");
  
  if (!selectedUser || members.includes(selectedUser)) {
    console.log(`User ${selectedUser} is already in members array or no user selected`);
    return;
  }
  
  // Update local member array
  const updatedMembers = [...members, selectedUser];
  
  // Modify local state directly
  setMembers(updatedMembers);
  setSelectedUser('');
  setDropdownOpen(false);
  
  // Construct a payload with the same structure as handleSave
  const payload = {
    title: task.title,
    description: task.description,
    assignee: task.assignee,
    startDate: task.startDate ? new Date(task.startDate) : null,
    endDate: task.endDate ? new Date(task.endDate) : null,
    members: updatedMembers,  // Use the updated member array
    labels: labels,
    checklist: checklist
  };
  
  console.log("Sending payload to server:", payload);
  
  // Use the same API call as handleSave
  api.put(`/api/tasks/${taskId}`, payload)
    .then(res => {
      const updated = res.data;
      console.log("Server response after save:", updated);
      
      // Same as handleSave, updates all states
      setTask(updated);
      setMembers(updated.members || []);
      setLabels(updated.labels || []);
      setChecklist(updated.checklist || []);
      
      // Add socket notification
      if (typeof socket !== 'undefined' && socket) {
        socket.emit('task_assigned', {
          taskId,
          title: task.title,
          assignedTo: [selectedUser],
          assignedBy: currentUserEmail || 'unknown',
          task: updated
        });
      }
      
      // Display success message
      setShowToast(true);
      setTimeout(() => {
        setShowToast(false);
      }, 1000);
    })
    .catch(err => {
      console.error('Error saving task:', err);
      console.error('Error details:', err.response ? err.response.data : err.message);
      alert('Error saving task: ' + err.message);
      
      // Rollback local state
      setMembers(members);
    });
};

  const handleRemoveMember = async (memberToRemove) => {
    const confirmDelete = window.confirm(`Are you sure you want to remove ${memberToRemove} from this task?`);
      if (!confirmDelete) {
        return;
      }
      
    // update loacal state
    const updatedMembers = members.filter(m => m !== memberToRemove);
    setMembers(updatedMembers);
    
    // save to backend
    try {
      const payload = {
        ...task,
        members: updatedMembers,
        startDate: task.startDate ? new Date(task.startDate) : null,
        endDate: task.endDate ? new Date(task.endDate) : null,
        removedMember: memberToRemove
      };
      
      const response = await api.put(`/api/tasks/${taskId}`, payload); 
      
      // update task
      setTask(response.data);

    if (typeof socket !== 'undefined' && socket) {
      socket.emit('task_member_removed', {
        taskId,
        title: task.title,
        removedMember: memberToRemove,
        removedBy: currentUserEmail || 'unknow' 
      });
    }

      setShowToast(true);
      setTimeout(() => {
        setShowToast(false);
      }, 1000);
    } catch (err) {
      console.error('Error removing member:', err);
      alert('Failed to remove member: ' + (err.message || 'Unknown error'));
      // rollback
      setMembers(members);
    }
};
    
  if (error) return <div className="error">{error}</div>;
  if (task === null) {
    return <div className="loading-container">Loading task...</div>;
  }

  console.log("Members allowed on this task:", workplaceMembers);
  return (
    <div className="taskboard-container">
      <div className="taskboard-main">
        {/* title */}
        <h2 className="task-title-display">{task.title || 'No Title Yet'}</h2>

        {/* Members */}
        <div className="task-section">
          <h3>Assignee</h3>
          <div className="members-container">
            {members.length === 0 ? (
              <p>No members assigned.</p>
            ) : (
              members.map((member, idx) => (
                <div key={idx} className="member-avatar">
                  {member.charAt(0).toUpperCase()}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Description */}
        <div className="task-section">
          <h3>Description</h3>
          <textarea
            placeholder="Add a more detailed description..."
            value={task.description}
            onChange={(e) => setTask({ ...task, description: e.target.value })}
          />
        </div>

        {/* Start Date */}
        <div className="task-section">
          <h3>Start Date</h3>
          <DatePicker
            selected={task.startDate ? new Date(task.startDate) : null}
            onChange={(date) => setTask({ ...task, startDate: date })}
            dateFormat="yyyy/MM/dd"
            placeholderText="Start Date"/>
        </div>

        {/* End Date */}
        <div className="task-section">
          <h3>End Date</h3>
          <DatePicker
              selected={task.endDate ? new Date(task.endDate) : null}
              onChange={(date) => setTask({ ...task, endDate: date })}
              dateFormat="yyyy/MM/dd"
              placeholderText="End Date"/>
        </div>
      </div>

      {/* Sidebar */}
      <div className="taskboard-sidebar">
        <h3>Actions</h3>
        <SidebarButton label="Assignee" onClick={() => setShowMembers(true)} />
        <SidebarButton label="Save" onClick={handleSave} />
      </div>

      {/* Pop-up Windows */}
      {showLeave && (
        <Modal title="Leave Task" onClose={() => setShowLeave(false)}>
          <p>Are you sure you want to leave this task?</p>
          <button onClick={() => navigate(-1)}>Confirm</button>
        </Modal>
      )}

    {showMembers && (
      <Modal title="Assignee" onClose={() => setShowMembers(false)}>
        <div className="assignee-section">
          <div className="assignee-list">
            {members.map((m, i) => (
              <div key={i} className="assignee-item">
                <div className="assignee-email">
                  <div className="assignee-avatar">
                    {m.charAt(0).toUpperCase()}
                  </div>
                  {m}
                </div>
                <button 
                  className="remove-btn" 
                  onClick={() => handleRemoveMember(m)}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          <div className="dropdown-container" ref={dropdownRef}>
            <div 
              className={`dropdown-input ${dropdownOpen ? 'dropdown-open' : ''}`}
              onClick={() => setDropdownOpen(!dropdownOpen)}
            >
              {selectedUser || 'Add people by email...'}
              <span className="dropdown-icon">▼</span>
            </div>
            
            {dropdownOpen && (
              <div className="dropdown-menu">
                {workplaceMembers
                  .filter(email => !members.includes(email))
                  .map((email, index) => (
                    <div 
                      key={index} 
                      className="dropdown-item"
                      onClick={() => handleSelectUser(email)}
                    >
                      {email}
                    </div>
                  ))}
              </div>
            )}
          </div>

          <div className="button-group">
            <button 
              className="add-btn" 
              onClick={handleAddUser} 
              disabled={!selectedUser}
            >
              Add
            </button>
            <button 
              className="secondary-btn" 
              onClick={() => setShowMembers(false)}
            >
              Close
            </button>
          </div>
        </div>
      </Modal>
    )}

      {showLabels && (
        <Modal title="Manage Labels" onClose={() => setShowLabels(false)}>
          {labels.map((l, idx) => (
            <div key={idx}>
              {l} <button onClick={() => setLabels(labels.filter(lbl => lbl !== l))}>Remove</button>
            </div>
          ))}
          <input
            type="text"
            placeholder="Add label"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
          />
          <button onClick={() => {
            if (newLabel.trim()) {
              setLabels([...labels, newLabel.trim()]);
              setNewLabel('');
            }
          }}>Add Label</button>
        </Modal>
      )}

      {showChecklist && (
        <Modal title="Manage Checklist" onClose={() => setShowChecklist(false)}>
          {checklist.map((item, idx) => (
            <div key={idx}>
              <input
                type="checkbox"
                checked={item.completed}
                onChange={() => {
                  setChecklist(checklist.map((item, i) =>
                    i === idx ? { ...item, completed: !item.completed } : item
                  ));
                }}
              />
              {item.text}
              <button onClick={() => setChecklist(checklist.filter((_, i) => i !== idx))}>Delete</button>
            </div>
          ))}
          <input
            type="text"
            placeholder="Add checklist item"
            value={newChecklistItem}
            onChange={(e) => setNewChecklistItem(e.target.value)}
          />
          <button onClick={() => {
            if (newChecklistItem.trim()) {
              setChecklist([...checklist, { text: newChecklistItem.trim(), completed: false }]);
              setNewChecklistItem('');
            }
          }}>Add Item</button>
        </Modal>
      )}

      {/* Save success prompt */}
      {showToast && (
        <div className="toast">
          Task saved successfully!
        </div>
      )}
    </div>
  );
}


function SidebarButton({ label, onClick }) {
  return (
    <button className="sidebar-btn" onClick={onClick}>
      {label}
    </button>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div className="modal">
      <h3>{title}</h3>
      {children}
      {/* <button onClick={onClose}>Close</button> */}
    </div>
  );
}