import React, { useState, useEffect } from 'react';
import api from '../api';
import './Files.css'; // Import the new CSS file

const Files = () => {
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch all workspaces and their files
  useEffect(() => {
    const fetchWorkspaces = async () => {
      setLoading(true);
      try {
        // First get the user's workspaces
        const userEmail = localStorage.getItem('user') 
          ? JSON.parse(localStorage.getItem('user')).email 
          : null;
          
        if (!userEmail) {
          setLoading(false);
          return;
        }
        
        const workspacesRes = await api.get(`/api/workplaces/${encodeURIComponent(userEmail)}`);
        const workspaceList = workspacesRes.data;
        
        // Get files for each workspace
        const workspacesWithFiles = await Promise.all(
          workspaceList.map(async (workspace) => {
            try {
              const filesRes = await api.get(`/api/files/${workspace._id}`);
              return {
                ...workspace,
                files: filesRes.data || []
              };
            } catch (err) {
              console.error(`Failed to get files for workspace ${workspace.name}:`, err);
              return {
                ...workspace,
                files: [],
                error: true
              };
            }
          })
        );
        
        // Only keep workspaces with files
        const filteredWorkspaces = workspacesWithFiles.filter(ws => ws.files && ws.files.length > 0);
        setWorkspaces(filteredWorkspaces);
      } catch (err) {
        console.error("Failed to fetch workspaces:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchWorkspaces();
  }, []);

  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  // Calculate expiry date
  const calculateExpiryDate = (uploadTime) => {
    const uploadDate = new Date(uploadTime);
    const expiryDate = new Date(uploadDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    return formatDate(expiryDate);
  };

  if (loading) {
    return (
      <div className="files-container">
        <div className="files-header">
          <h1 className="files-title">Files</h1>
          <p className="files-subtitle">Loading files...</p>
        </div>
      </div>
    );
  }

  if (workspaces.length === 0) {
    return (
      <div className="files-container">
        <div className="files-header">
          <h1 className="files-title">Files</h1>
          <p className="files-subtitle">View all shared files from your workspaces</p>
        </div>
        <div className="no-files-message">
          No files found. Files will appear here after they've been uploaded to your workspaces.
        </div>
      </div>
    );
  }

  return (
    <div className="files-container">
      <div className="files-header">
        <h1 className="files-title">Files</h1>
        <p className="files-subtitle">View all shared files from your workspaces</p>
      </div>

      {workspaces.map((workspace) => (
        <div key={workspace._id} className="workspace-section">
          <h2 className="workspace-title">{workspace.name}</h2>
          
          <ul className="files-list">
            {workspace.files.map((file) => (
              <li key={file._id} className="file-item">
                <div className="file-info">
                  <div className="file-icon">📄</div>
                  <div className="file-details">
                    <div className="file-name">
                      {file.filename.split('-').slice(1).join('-')}
                    </div>
                    <div className="file-meta">
                      Uploaded: {formatDate(file.uploadTime)} | 
                      Expires: {calculateExpiryDate(file.uploadTime)}
                    </div>
                  </div>
                </div>
                
                <div className="file-actions">
                  <a
                    href={file.fileUrl}
                    download
                    className="download-btn"
                  >
                    <span className="download-icon">⬇️</span>
                    Download
                  </a>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
};

export default Files;