import React, { useState, useEffect } from 'react';
import Files from './pages/Files';
import { Routes, Route, NavLink, useNavigate, Navigate, useLocation } from 'react-router-dom';
import './App.css';
import logo from './assets/image/logo.png';
import Dashboard from './pages/Dashboard';
import SharedWorkspace from './pages/SharedWorkspace';
import TaskBoard from './pages/TaskBoard';
//import WorkplacePage from './pages/WorkplacePage';
import Chat from './pages/Chat';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import MyTasks from './pages/MyTasks';
import NotificationPage from './pages/NotificationPage';
import {
  FiFolder,
  FiBookmark,
  FiMessageCircle,
  FiBell,
  FiFileText,
  FiSettings,
  FiUsers,
  FiMonitor
} from 'react-icons/fi';
import socket from './socket';
import api from './api';
import { ChatNotificationProvider, useChatNotifications } from './pages/ChatNotificationContext';
import { NotificationProvider, useNotifications } from './pages/NotificationContext';
import NotificationBadge from './pages/NotificationBadge';

// Sidebar component with notification badge support
const Sidebar = ({ user, safePath, unreadTasks }) => {
  // Use the chat notifications context safely inside this component
  const { totalUnread } = useChatNotifications();
  const { unreadCount } = useNotifications(); // Use notifications context
  
  return (
    <aside className="sidebar">
      <div className="logo-section">
        <img src={logo} alt="Team Nexus" className="logo" />
        <div className="logo-text">TEAM NEXUS</div>
      </div>

      <nav className="nav">
        <NavLink to={safePath('/dashboard')} className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}>
          <FiFolder className="nav-icon" />
          <span>Dashboard</span>
        </NavLink>

        {/* Chat/Messages link with notification badge */}
        <NavLink to={safePath('/chat')} className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}>
          <div className="nav-icon-container">
            <FiMessageCircle className="nav-icon" />
            {totalUnread > 0 && <NotificationBadge count={totalUnread} />}
          </div>
          <span>Messages</span>
        </NavLink>

        <NavLink to={safePath('/my-tasks')} className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}>
          <div className="nav-icon-container">
            <FiMonitor className="nav-icon" />
            {unreadTasks > 0 && <span className="notification-badge">{unreadTasks}</span>}
          </div>
          <span>My Task</span>
        </NavLink>

        {/* <NavLink to="/" className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}>
          <FiBell className="nav-icon" />
          <span>Notifications</span>
        </NavLink> */}

        <NavLink to={safePath('/notifications')} className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}>
          <div className="nav-icon-container">
            <FiBell className="nav-icon" />
            {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
          </div>
          <span>Notifications</span>
        </NavLink>

        <NavLink to="/files" className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}>
          <FiFileText className="nav-icon" />
          <span>Files</span>
        </NavLink>
{/* 
        <NavLink to="/" className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}>
          <FiSettings className="nav-icon" />
          <span>Settings</span>
        </NavLink> */}
      </nav>

      <footer className="sidebar-footer">
        <p>© 2025 TEAM NEXUS BY YYZS</p>
        <p className="version">v1.0</p>
      </footer>
    </aside>
  );
};

// Main App component
export default function App() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [unreadTasks, setUnreadTasks] = useState(0);
  const location = useLocation();

  // On app load, try to fetch the "real" user profile
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }  // not logged in
    
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        if (parsedUser && parsedUser.email) {
          parsedUser.email = parsedUser.email.toLowerCase();
        }
        setUser(parsedUser);
        setLoading(false);
        return; // If already have user information, use it directly
      } catch (e) {
        console.error('Unable to parse stored user information');
      }
    }
    
    api.get('/api/me')
      .then(response => {
        const userData = response.data;
        if (userData && userData.email) {
          userData.email = userData.email.toLowerCase();
        }        
        setUser(userData);
        localStorage.setItem('user', JSON.stringify(userData));
      })
      .catch(error => {
        console.error('Failed to fetch user data:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  // Function to get the number of unread tasks
  const fetchUnreadTasksCount = () => {
    if (!user) return;
    if (!user.email) {
    console.error('User email is missing');
    return;
  }
    
    api.get('/api/tasks/unread', {
      headers: {
        'x-user-email': user.email.toLowerCase()
      }
    })
      .then(response => {
        setUnreadTasks(response.data.count || 0);
      })
      .catch(error => {
        console.error('Failed to fetch unread tasks count:', error);
        if (error.response) {
          console.error('Error response data:', error.response.data);
          console.error('Error status:', error.response.status);
        }
      });
  };

  useEffect(() => {
    if (!user) return;
    console.log('Current user object:', user);
    console.log('User email:', user.email);  
    // Get the number of unread tasks for the first time
    fetchUnreadTasksCount();
    
    // Set up periodic checks, for example every 60 seconds
    const interval = setInterval(fetchUnreadTasksCount, 60000);
    
    return () => clearInterval(interval);
  }, [user]);

  // New: Handle real-time task assignment notifications
  useEffect(() => {
    if (!user) return;
    
    const handleTaskAssigned = (data) => {
      // If the task is assigned to the current user, increase the unread task count
      if (data.assignedTo && data.assignedTo.includes(user.email)) {
        setUnreadTasks(prev => prev + 1);
        alert(`You have been assigned to task: ${data.title}`);

        const newTaskEvent = new CustomEvent('new-task-assigned', { 
          detail: { taskId: data.taskId } 
        });
        window.dispatchEvent(newTaskEvent);
      }
    };
    
    socket.on("task_assigned", handleTaskAssigned);
    
    return () => {
      socket.off("task_assigned", handleTaskAssigned);
    };
  }, [user]);

  // Listen for path changes and reset the unread count when the user visits the My Tasks page
  useEffect(() => {
    if (location.pathname === '/my-tasks' && unreadTasks > 0) {
      api.post('/api/tasks/mark-read', { notificationsOnly: true })
        .then(() => {
          setUnreadTasks(0);
        })
        .catch(error => {
          console.error('Failed to mark notifications as read:', error);
        });
    }
  }, [location.pathname, unreadTasks]);

  // Event monitoring
  useEffect(() => {
    // task update
    const handleTaskUpdate = (data) => {
      alert(`Task ${data.title} updated`);
    };
    
    // file upload
    const handleFileUpload = (data) => {
      alert(`New file ${data.filename} uploaded`);
    };
    
    // Add event listener
    socket.on("task_update", handleTaskUpdate);
    socket.on("file_upload", handleFileUpload);
    
    // Clean up when component is unmounted
    return () => {
      socket.off("task_update", handleTaskUpdate);
      socket.off("file_upload", handleFileUpload);
    };
  }, []);  

  // Helper to redirect anonymous users to /dashboard
  const safePath = (path) => (user ? path : '/dashboard');

  // Real login: call your API, store token, then pull /api/me
  const handleLogin = async (email, password) => {
    try {
      if (!email || !password) {
        alert('Please enter your email and password');
        return;
      }
      
      const normalizedEmail = email.toLowerCase();
      try {
      // login request
      const response = await api.post('/api/login', {
        email: normalizedEmail, 
        password
      });
        
        const data = response.data;
        
        // token
        localStorage.setItem('token', data.token);
        
        try {
          // get user info
          const profileResponse = await api.get('/api/me');
   
          const me = profileResponse.data;
          if (me && me.email) {
          me.email = me.email.toLowerCase();
          }
          localStorage.setItem('user', JSON.stringify(me));
          setUser(me);
          navigate('/dashboard', { replace: true });
        } catch (profileError) {
          console.error('Profile fetch error:', profileError);
          alert('Login was successful but failed to obtain user information. Please log in again.');
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        }
      } catch (apiError) {
        console.error('API request failed:', apiError);
        
        if (apiError.response) {
          const status = apiError.response.status;
          const errorData = apiError.response.data;
          
          if (status === 401) {
            alert('Wrong email or password');
          } else if (status === 429) {
            alert('Too many login attempts, please try again later');
          } else if (status === 403) {
            alert('The account has been locked, please contact the administrator');
          } else {
            alert(errorData.message || 'Login Failed');
          }
        } else if (apiError.request) {
          alert('Server not responding. Please try again later.');
        } else {
          alert('An error occurred during login: ' + apiError.message);
        }
      }
    } catch (err) {
      console.error('Login error:', err);
      alert('An error occurred during login: ' + (err.message || 'Unknown error'));
    }
  };

  // Real register: similar to login but hitting /api/signup
  const handleRegister = async (name, email, password) => {
    try {
      // Basic Authentication
      if (!name || !email || !password) {
        alert('Please fill in all required fields');
        return;
      }
      
      // Password strength verification
      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\da-zA-Z]).{8,}$/;
      if (!passwordRegex.test(password)) {
        alert('The password must contain at least 8 characters and include uppercase and lowercase letters, numbers, and special characters.');
        return;
      }
      
      const res = await api.post('/api/signup', {
          name,
          email,
          password
        });
      
      const data = await res.data;

      // Registration successful - store token
      localStorage.setItem('token', data.token);
      
      try {
        // Get user information
        const meRes = await api.get('/api/me');
        
        const me = await meRes.data;
        localStorage.setItem('user', JSON.stringify(me));
        setUser(me);
        navigate('/dashboard', { replace: true });
      } catch (profileError) {
        alert('Registration was successful but failed to obtain user information, please log in again');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        console.error('Profile fetch error:', profileError);
      }
    } catch (err) {
      console.error('Registration error:', err);
      alert('An error occurred during registration: ' + (err.message || 'Unknown error'));
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    navigate('/dashboard', { replace: true });
  };

  const ProtectedRoute = ({ user, children }) => {
    const location = useLocation();

    if(location.state?.loading){
      return null;
    }

    if (!user) {
      return <Navigate to="/dashboard" replace />;
    }

    return children;
  };

  if (loading) {
    return <div>Loading…</div>;
  }

  return (
    <ChatNotificationProvider>
      <NotificationProvider>
      <div className="app">
        {loading && <div className="loading-overlay">Loading...</div>}
        
        {/* Sidebar Navigation - now as a separate component with notification support */}
        <Sidebar user={user} safePath={safePath} unreadTasks={unreadTasks} />

        {/* Main Content Area */}
        <div className="main"> 
          <Navbar
            user={user}
            onLogin={handleLogin}
            onRegister={handleRegister}
            onLogout={handleLogout}
          />
          <div className="page-container">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/dashboard" element={<Dashboard user={user} onLogin={handleLogin} onRegister={handleRegister}/>} />
              <Route path="/workspace/:id" element={
                <ProtectedRoute user={user}>                                                
                  <SharedWorkspace user={user}/>
                </ProtectedRoute>
              } />
              <Route path="/chat" element={
                <ProtectedRoute user={user}>
                  <Chat user={user}/>
                </ProtectedRoute>
              } />
              <Route path="/files" element={<Files />} />
              <Route path="/taskboard/:taskId" element={
                <ProtectedRoute user={user}>
                  <TaskBoard user={user}/>
                </ProtectedRoute>
              } />
              <Route path="/my-tasks" element={
                <ProtectedRoute user={user}>
                  <MyTasks user={user}/>
                </ProtectedRoute>
              } />
              <Route path="/notifications" element={
                <ProtectedRoute user={user}>
                  <NotificationPage />
                </ProtectedRoute>
              } />              
            </Routes>
          </div>
        </div>
      </div>
      </NotificationProvider>
    </ChatNotificationProvider>
  );
}