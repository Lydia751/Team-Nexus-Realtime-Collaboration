# Architecture Overview

This folder contains the core technical architecture and workflow diagrams for Team Nexus.

Team Nexus is a collaborative workspace and task management web application that supports Kanban task boards, real-time communication, notifications, file sharing, and team collaboration.

---

# 1. System Architecture

![System Architecture](./system-architecture-diagram.png)

This diagram illustrates the overall technical architecture of Team Nexus.

The backend is built with Node.js and Express, using:

- JWT authentication middleware
- Express route modules
- Socket.IO server
- MongoDB with Mongoose
- multer file upload handling
- notification utilities

Main backend route modules include:

- auth
- protected
- users
- workplaces
- boards
- tasks
- rooms
- messages
- chat-status
- files
- links
- notifications

The frontend is built with React and Vite.

Frontend components include:

- React Router pages
- Axios REST client
- Socket.IO client
- Notification providers
- Chat notification providers

The system supports:

- REST API communication
- real-time Socket.IO events
- JWT-based authentication
- file uploads
- notification broadcasting
- Kanban task management

---

# 2. Core Database ER Diagram

![Database ER Diagram](./database-er-diagram.png)

This ER diagram represents the core MongoDB database structure used in Team Nexus.

Key collections include:

- USER_ENTRY
- WORKPLACE
- BOARD
- TASK
- ROOM
- MESSAGE
- CHAT_STATUS
- NOTIFICATION
- LINK
- FILE

Main relationships include:

- WORKPLACE creates BOARD
- BOARD maps columns and TASK cards
- ROOM contains MESSAGE
- CHAT_STATUS tracks unread messages
- USER_ENTRY uploads FILE and LINK
- USER_ENTRY receives NOTIFICATION
- WORKPLACE stores FILE and LINK

The TASK collection stores:

- task details
- assignees
- labels
- checklist data
- completion state
- hidden users
- read status

The ROOM, MESSAGE, and CHAT_STATUS collections support the real-time chat system.

Only major collections and relationships related to the main application workflow are included for readability.

---

# 3. Task Workflow Diagram

![Task Workflow](./task-workflow-diagram.png)

This diagram illustrates the main workspace and task management workflow inside Team Nexus.

The workflow includes:

- user login
- JWT storage in localStorage
- workspace creation
- automatic board creation
- board column management
- Kanban task creation
- task assignment
- task completion updates
- MyTasks management
- Socket.IO real-time synchronization

Main API flows include:

- `POST /api/login`
- `GET /api/workplaces/:email`
- `POST /api/workplaces`
- `GET /api/boards/:workplaceId`
- `PUT /api/boards/:workplaceId`
- `POST /api/tasks`
- `GET /api/tasks/:id`
- `PUT /api/tasks/:id`
- `GET /api/tasks/my`

Socket.IO events include:

- `task_assigned`
- `task_completion_updated`
- `workspace_deleted`
- `send_message`

The workflow supports collaborative task management with live updates across multiple connected users.
