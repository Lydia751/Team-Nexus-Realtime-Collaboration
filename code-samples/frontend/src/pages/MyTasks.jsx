
import React, { useState, useEffect } from 'react';
import api from '../api';
import './MyTasks.css';
import socket from '../socket';

export default function MyTasks({user}) {
  const [tasks, setTasks] = useState([]);
  const [sortKey, setSortKey] = useState('dueDate');
  const [ascending, setAsc] = useState(true);
  const [filtered, setFiltered] = useState([]);
  const [hoveredTaskId, setHoveredTaskId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [taskDescriptions, setTaskDescriptions] = useState({});
  const [readTasks, setReadTasks] = useState(new Set());
  const [taskReadStatus, setTaskReadStatus] = useState({});
  const currentUserEmail = user.email;

  useEffect(() => {
    fetchTasks();
  }, [currentUserEmail]);
  
  // Monitor socket events
  useEffect(() => {
    if (typeof socket !== 'undefined') {
      const handleTaskAssigned = (data) => {
        if (data.assignedTo && data.assignedTo.includes(currentUserEmail)) {
          console.log("New task assigned via socket, refreshing tasks");
          fetchTasks(); // Refresh Task List
        }
      };
      
      const handleTaskCompletionUpdate = (data) => {
        if (data.completedBy && Array.isArray(data.completedBy)) {
          // Update local task completion status
          setTasks(prevTasks => 
            prevTasks.map(task => {
              if (task.id === data.taskId) {
                // Check if current user marked this task as completed
                const isCompletedByCurrentUser = data.completedBy.includes(currentUserEmail);
                return {
                  ...task,
                  completedBy: data.completedBy,
                  isCompletedByCurrentUser
                };
              }
              return task;
            })
          );
        }
      };
      
      socket.on("task_assigned", handleTaskAssigned);
      socket.on("task_completion_updated", handleTaskCompletionUpdate);
      
      return () => {
        socket.off("task_assigned", handleTaskAssigned);
        socket.off("task_completion_updated", handleTaskCompletionUpdate);
      };
    }
  }, [currentUserEmail]);

  // Function to get the task list
  const fetchTasks = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/tasks/my');
      const tasksData = response.data;
      
      // Ensure each task has completedBy array and isCompletedByCurrentUser flag
      const enhancedTasks = tasksData.map(task => {
        const completedBy = Array.isArray(task.completedBy) ? task.completedBy : [];
        const isCompletedByCurrentUser = completedBy.includes(currentUserEmail);
        
        return {
          ...task,
          completedBy,
          isCompletedByCurrentUser
        };
      });
      
      setTasks(enhancedTasks);
      
      const newReadStatus = {};
      tasksData.forEach(task => {
        newReadStatus[task.id] = task.isRead === true;
      });

      console.log("Initialize task read status:", newReadStatus);
      setTaskReadStatus(newReadStatus);

    } catch (err) {
      console.error("Failed to obtain tasks:", err);
      alert("Failed to get the task list");
    } finally {
      setLoading(false);
    }
  };

  // Always sort when tasks / sortKey / ascending changes
  useEffect(() => {
    const sorted = [...tasks].sort((a, b) => {
      const av = a[sortKey] || '';
      const bv = b[sortKey] || '';
      if (av < bv) return ascending ? -1 : 1;
      if (av > bv) return ascending ?  1 : -1;
      return 0;
    });
    setFiltered(sorted);
  }, [tasks, sortKey, ascending]);

  // Flip or switch sorting
  const toggleSort = key => {
    if (sortKey === key) {
      setAsc(!ascending);
    } else {
      setSortKey(key);
      setAsc(true);
    }
  };

  // Helper to toggle a task's done-state
  const toggleDone = async (id, newDone) => {
    // Optimistically update UI
    setTasks(prev =>
      prev.map(t => t.id === id ? { 
        ...t, 
        isCompletedByCurrentUser: newDone,
        completedBy: newDone 
          ? [...(Array.isArray(t.completedBy) ? t.completedBy : []), currentUserEmail] 
          : (Array.isArray(t.completedBy) ? t.completedBy.filter(email => email !== currentUserEmail) : [])
      } : t)
    );
    
    // Persist to server
    try {
      await api.put(`/api/tasks/${id}`, { 
        completed: newDone,
        userSpecificAction: true
      });
    } catch (e) {
      console.error('Failed to persist completed:', e);
      // Roll back UI changes on error
      setTasks(prev =>
        prev.map(t => t.id === id ? {
          ...t,
          isCompletedByCurrentUser: !newDone,
          completedBy: !newDone
            ? [...(Array.isArray(t.completedBy) ? t.completedBy : []), currentUserEmail]
            : (Array.isArray(t.completedBy) ? t.completedBy.filter(email => email !== currentUserEmail) : [])
        } : t)
      );
      alert('Failed to update task status. Please try again.');
    }
  };
    
  // Remove a task from the list (UI-only)
  const handleDelete = async taskId => {
    if (!window.confirm("Remove this from your My Tasks list?")) return;
  
    try {
      // 1) Persist the hide-flag
      await api.put(`/api/tasks/${taskId}/hide`);
      // 2) Drop it from UI
      setTasks(prev => prev.filter(t => t.id !== taskId));
    } catch (err) {
      console.error("Failed to hide task:", err);
      alert("Could not remove task from My Tasks.");
    }
  };

  const markTaskAsRead = async (taskId) => {
    // Check if the task has been read
    if (taskReadStatus[taskId] === false) {
      console.log(`set task ${taskId} read`);

      setTaskReadStatus(prev => ({
        ...prev,
        [taskId]: true
      }));
      
      // Send a request to the server
      try {
        const response = await api.post(`/api/tasks/${taskId}/mark-single-read`, {
          email: currentUserEmail
        });
        console.log('Mark a response as read:', response.data);
      } catch (err) {
        console.error("Failed to mark task as read:", err);
        if (err.response) {
          console.error("Error Status:", err.response.status);
          console.error("Error Data:", err.response.data);
        }
        // Rollback if failed
        setTaskReadStatus(prev => ({
          ...prev,
          [taskId]: false
        }));
      }
    }
  };

  const handleMouseEnter = async (taskId) => {
    setHoveredTaskId(taskId);

    markTaskAsRead(taskId);

    if (!taskDescriptions[taskId]) {
      try {
        const response = await api.get(`/api/tasks/${taskId}`);
        setTaskDescriptions(prev => ({
          ...prev,
          [taskId]: response.data.description || null
        }));
      } catch (err) {
        console.error(`Failed to get task description for task ${taskId}:`, err);
        setTaskDescriptions(prev => ({
          ...prev,
          [taskId]: null
        }));
      }
    }
  };

  return (
    <div className="my-tasks-container">
      <h2>My Tasks</h2>
      {filtered.length === 0 ? (
        <div className="no-tasks">No tasks found</div>
      ) : (
        <table className="my-tasks-table">
          <thead>
            <tr>
              <th></th>
              <th>Task</th>
              <th
                className="sortable"
                onClick={() => toggleSort('dueDate')}
              >
                Due date{' '}
                <span className="sort-icon">
                  {sortKey === 'dueDate' ? (ascending ? '↑' : '↓') : '↕'}
                </span>
              </th>
              <th
                className="sortable"
                onClick={() => toggleSort('startDate')}
              >
                Start date{' '}
                <span className="sort-icon">
                  {sortKey === 'startDate' ? (ascending ? '↑' : '↓') : '↕'}
                </span>
              </th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(t => (
              <tr 
                key={t.id} 
                className={t.isCompletedByCurrentUser ? 'done' : ''}
                onMouseEnter={() => handleMouseEnter(t.id)}
                onMouseLeave={() => setHoveredTaskId(null)}
              >
                <td>
                  {t.isCompletedByCurrentUser ? (
                    <>
                      <span
                        className="done-icon"
                        onClick={() => toggleDone(t.id, false)}
                        style={{ cursor: 'pointer' }}
                      >
                        ✓
                      </span>
                      {/* Delete button appears only when done */}
                      <button
                        className="delete-btn"
                        onClick={() => handleDelete(t.id)}
                      >
                        Delete
                      </button>
                    </>
                  ) : (
                    <input
                      type="checkbox"
                      checked={false}
                      onChange={e => toggleDone(t.id, e.target.checked)}
                    />
                  )}
                </td>
                <td className={t.isCompletedByCurrentUser ? 'task-title completed' : 'task-title'} style={{ position: 'relative' }}>
                  {/* Show NEW badge for unread tasks */}
                  {taskReadStatus[t.id] === false && (
                    <span className="new-task-badge">NEW</span>
                  )}
                  {t.title}
                  {hoveredTaskId === t.id && (
                    <div className="task-description-tooltip">
                      {taskDescriptions[t.id] !== undefined
                        ? (taskDescriptions[t.id] || "No description yet.")
                        : "Loading description..."}
                    </div>
                  )}
                </td>
                <td>
                  {t.dueDate 
                    ? new Date(t.dueDate).toLocaleDateString() 
                    : ''}
                </td>
                <td>
                  {t.startDate 
                    ? new Date(t.startDate).toLocaleDateString() 
                    : ''}
                </td>
                <td>{t.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}