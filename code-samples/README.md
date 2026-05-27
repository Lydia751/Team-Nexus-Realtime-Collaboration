# Code Samples

This folder contains the core frontend and backend implementation of Team Nexus.

Team Nexus is a real-time collaboration platform designed for workspace management, task tracking, team communication, and file sharing.

---

# Backend Structure

Backend built with:

- Node.js
- Express.js
- MongoDB
- Socket.IO

Main backend structure:

```text
backend/
├── src/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── utils/
│   ├── app.js
│   └── socket.js
├── tests/
│   ├── routes/
│   └── setup.js
```

Backend responsibilities:

- RESTful API services
- Authentication and middleware handling
- Realtime communication with Socket.IO
- Database operations and business logic
- File upload and workspace management

---

# Frontend Structure

Frontend built with:

- React
- Vite
- Tailwind CSS
- Socket.IO Client

Main frontend structure:

```text
frontend/
├── public/
├── src/
├── tests/
├── README.md
├── eslint.config.js
├── index.html
├── package.json
├── tailwind.config.js
├── vite.config.js
└── vitest.config.js
```

Frontend responsibilities:

- Workspace dashboard UI
- Kanban task board interface
- Realtime chat interface
- Task detail modal
- Notifications system
- Shared file management
- Responsive frontend interaction

---

# Key Features

- Workspace management
- Kanban task board
- Realtime team chat
- Task detail editing
- Shared file uploads
- Notifications system
- Socket-based realtime updates
- Team collaboration workflow

---

# Notes

Some generated files and sensitive configuration files are excluded from the repository for security and repository size reasons.

Excluded files/folders:

- node_modules
- coverage
- .env
