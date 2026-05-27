import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLocation } from 'react-router-dom';
import './Dashboard.css';
import api from '../api';
import socket from '../socket';

export default function Dashboard({ user, onLogin, onRegister }) {
  const navigate = useNavigate();

  // --- UI state ---
  //const [isSignUp,     setIsSignUp]     = useState(false);
  const [email,        setEmail]        = useState('');
  const [password,     setPassword]     = useState('');
  const [name,         setName]         = useState('');
  const [confirmPass,  setConfirmPass]  = useState('');
  const [activeWPs,    setActiveWPs]    = useState([]);
  const [archivedWPs,  setArchivedWPs]  = useState([]);
  const [showMenuId,   setShowMenuId]   = useState(null);
  const [showModal,    setShowModal]    = useState(false);
  const [newTitle,     setNewTitle]     = useState('');
  const [error,        setError]        = useState('');
  const location     = useLocation();
  const initialMode  = location.state?.isSignUp ?? false;
  const [isSignUp,   setIsSignUp]   = useState(initialMode);
  const [isDeleting,   setIsDeleting]   = useState(false);


  useEffect(() => {
    if (location.state?.isSignUp !== undefined) {
      setIsSignUp(location.state.isSignUp);
    }
  }, [location.state]);

    // Socket event listener for workspace changes
  useEffect(() => {
    if (!user?.email) return;

    // Handle workspace deletion event
    const handleWorkspaceDeleted = (data) => {
      // Update both active and archived workspaces lists
      setActiveWPs(prev => prev.filter(wp => wp._id !== data.workplaceId));
      setArchivedWPs(prev => prev.filter(wp => wp._id !== data.workplaceId));
      
      // If currently viewing the deleted workspace, redirect to dashboard
      if (location.pathname === `/workspace/${data.workplaceId}`) {
        navigate('/dashboard', { replace: true });
        alert(`Workspace "${data.name}" has been deleted.`);
      }
    };

    socket.on('workspace_deleted', handleWorkspaceDeleted);
    
    // Cleanup event listener on component unmount
    return () => {
      socket.off('workspace_deleted', handleWorkspaceDeleted);
    };
  }, [user, navigate, location.pathname]);

  // close the menu if the user clicks anywhere else
useEffect(() => {
  const handleClickOutside = (e) => {
    if (
      !e.target.closest('.card-menu-btn') &&
      !e.target.closest('.list-menu')
    ) {
      setShowMenuId(null);
    }
  };
  document.addEventListener('mousedown', handleClickOutside);
  return () => document.removeEventListener('mousedown', handleClickOutside);
}, []);

  // Fetch workspaces (active + archived) whenever user changes
  useEffect(() => {
    if (!user?.email) return;


    api.get(`/api/workplaces/${encodeURIComponent(user.email)}`)
    .then(response => {
      const all = response.data;
      setActiveWPs(all.filter(w => !w.archived));
      setArchivedWPs(all.filter(w => w.archived));
    })
    .catch(err => {
      console.error("Failed to get workspace:", err);
      alert("Failed to get workspace list");
    });

  }, [user]);

  // Archive / Restore API calls
const handleArchive = async (id) => {
  try {
    const response = await api.patch(`/api/workplaces/${id}/archive`);
    const updated = response.data;
    setActiveWPs(wps => wps.filter(w => w._id !== id));
    setArchivedWPs(wps => [updated, ...wps]);
    setShowMenuId(null);
  } catch (err) {
    console.error("Archive failed:", err);
    alert("Failed to archive workspace");
  }
};

const handleRestore = async (id) => {
  try {
    const response = await api.patch(`/api/workplaces/${id}/restore`);
    const updated = response.data;
    setArchivedWPs(wps => wps.filter(w => w._id !== id));
    setActiveWPs(wps => [updated, ...wps]);
    setShowMenuId(null);
  } catch (err) {
    console.error("Failed recovery:", err);
    alert("Recovering the workspace failed");
  }
};

  // Permanently delete an archived workplace
  const handleDelete = async (id, name) => {
    if (isDeleting) return; // Prevent multiple clicks
    
    if (!window.confirm(`Are you sure you want to permanently delete the workspace "${name}"?\n\nThis will also delete all tasks, files, and chat messages related to this workspace. This action cannot be undone.`)) {
      setShowMenuId(null);
      return;
    }
    
    setIsDeleting(true);
    
    try {
      // Show loading indicator or disable buttons
      const wp = archivedWPs.find(w => w._id === id);
      
      // Optimistically update UI
      setArchivedWPs(wps => wps.filter(w => w._id !== id));
      setShowMenuId(null);
      
      await api.delete(`/api/workplaces/${id}`);
      
      // Success notification
      alert(`Workspace "${name}" and all associated data have been deleted successfully.`);
    } catch (err) {
      console.error("Deletion failed:", err);
      alert("Failed to delete workspace. Please try again.");
      
      // Re-fetch workspaces to ensure UI is in sync with backend
      if (user?.email) {
        api.get(`/api/workplaces/${encodeURIComponent(user.email)}`)
          .then(response => {
            const all = response.data;
            setActiveWPs(all.filter(w => !w.archived));
            setArchivedWPs(all.filter(w => w.archived));
          })
          .catch(err => {
            console.error("Failed to refresh workspace list:", err);
          });
      }
    } finally {
      setIsDeleting(false);
    }
  };

  // --- If not logged in, show login / sign-up form ---
  if (!user) {
    return (
      <div className="dashboard-container">
        <div className="login-box">
          <h2 className="team-name">TEAM NEXUS</h2>
          <h3>{isSignUp ? 'Sign Up' : 'Log In'}</h3>

          {isSignUp && (
            <input
              type="text"
              placeholder="Full name"
              value={name}
              onChange={e => setName(e.target.value)}
              className="input-field"
            />
          )}

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="input-field"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="input-field"
          />
          {isSignUp && (
           <div className="password-hint">
             <span className="hint-asterisk">*</span>
             Password must be at least 8 characters long and include uppercase, lowercase, number, and special character.
           </div>
         )}

          {isSignUp && (
            <input
              type="password"
              placeholder="Confirm password"
              value={confirmPass}
              onChange={e => setConfirmPass(e.target.value)}
              className="input-field"
            />
          )}

          <button
            className="login-button"
            onClick={() => {
              if (isSignUp) {
                onRegister(name, email, password);
              } else {
                onLogin(email, password);
              }
            }}
          >
            {isSignUp ? 'Sign Up' : 'Log In'}
          </button>

          <p className="signup-prompt">
            {isSignUp
              ? <>Already have an account? <span className="signup-link" onClick={() => setIsSignUp(false)}>Log in</span></>
              : <>Don't have an account? <span className="signup-link" onClick={() => setIsSignUp(true)}>Sign up</span></>
            }
          </p>
        </div>
      </div>
    );
  }

  // --- Main dashboard when logged in ---
  return (
    <div className="dashboard-container">

      {/* Your Workspaces */}
      <section>
        <h3>Your Workspaces</h3>
        <div className="workplace-board">
        {activeWPs.map(wp => {
          const isOwner = wp.userEmail === user.email;

          return (
            <div
              key={wp._id}
              className={`workplace-card ${showMenuId===wp._id ? 'menu-open' : ''}`}
              onClick={() => navigate(`/workspace/${wp._id}`)}
            >
              <span className="card-title">{wp.name}</span>

              {isOwner && (
                <>
                  <button
                    className="card-menu-btn"
                    onClick={e => {
                      e.stopPropagation();
                      setShowMenuId(id => id===wp._id ? null : wp._id);
                    }}
                  >⋯</button>

                  {showMenuId===wp._id && (
                    <div className="list-menu">
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          handleArchive(wp._id);
                        }}
                      >
                        Archive
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}

          {/* Create-new card */}
          <div
            className="workplace-card create-new"
            onClick={() => setShowModal(true)}
          >
            + Create new workplace
          </div>
        </div>
      </section>

      {/* Archived Workspaces */}
      {archivedWPs.length > 0 && (
        <section style={{ marginTop: '2rem' }}>
          <h3>Archived Workspaces</h3>
          <div className="workplace-board">
          {archivedWPs.map(wp => {
            const isOwner = wp.userEmail === user.email;

            return (
              <div
                key={wp._id}
                className={`workplace-card archived ${showMenuId===wp._id ? 'menu-open' : ''}`}
                onClick={() => navigate(`/workspace/${wp._id}`)}
              >
                <span className="card-title">{wp.name}</span>

                {isOwner && (
                  <>
                    <button
                      className="card-menu-btn"
                      onClick={e => {
                        e.stopPropagation();
                        setShowMenuId(id => id===wp._id ? null : wp._id);
                      }}
                    >⋯</button>

                    {showMenuId===wp._id && (
                      <div className="list-menu">
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            handleRestore(wp._id);
                          }}
                        >
                          Restore
                        </button>
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            handleDelete(wp._id);
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}

          </div>
        </section>
      )}

      {/* Create new–workplace modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h4>Workplace title <span style={{ color: 'red' }}>*</span></h4>
            <input
              className={`input-field${error ? ' input-error' : ''}`}
              type="text"
              placeholder="Enter a title"
              value={newTitle}
              onChange={e => {
                setNewTitle(e.target.value);
                setError('');
              }}
            />
            {error && <div className="error-text">{error}</div>}
            <div className="modal-buttons">
              <button
                className="create-button"
                onClick={async () => {
                  if (!newTitle.trim()) {
                    setError('Workplace title is required');
                    return;
                  }
                  try {
                    const response = await api.post('/api/workplaces', {
                      userEmail: user.email,
                      name: newTitle
                    });
                    
                    setActiveWPs(wps => [...wps, response.data]);
                    setNewTitle('');
                    setShowModal(false);
                  } catch (err) {
                    console.error("Creation failed:", err);
                    setError('Failed to create workspace');
                  }
                }}
              >
                Create
              </button>
              <button
                className="cancel-button"
                onClick={() => {
                  setShowModal(false);
                  setNewTitle('');
                  setError('');
                }}
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
