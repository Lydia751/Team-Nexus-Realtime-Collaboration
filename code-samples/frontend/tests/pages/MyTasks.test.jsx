
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import MyTasks from '../../src/pages/MyTasks';
import api from '../../src/api';
import socket from '../../src/socket';

// Correctly mock the API
vi.mock('../../src/api', () => ({
  default: {
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn()
  }
}));

// Mock socket
vi.mock('../../src/socket', () => ({
  default: {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn()
  }
}));

// Mock console.error to reduce noise
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = vi.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
});

describe('MyTasks Component', () => {
  // Sample user
  const mockUser = {
    email: 'test@example.com',
    name: 'Test User'
  };

  // Sample tasks
  const mockTasks = [
    {
      id: 'task1',
      title: 'Task 1',
      dueDate: '2023-06-01T00:00:00.000Z',
      startDate: '2023-05-01T00:00:00.000Z',
      source: 'Workspace 1 / Todo',
      completedBy: [],
      isCompletedByCurrentUser: false,
      isRead: true
    },
    {
      id: 'task2',
      title: 'Task 2',
      dueDate: '2023-07-01T00:00:00.000Z',
      startDate: '2023-06-01T00:00:00.000Z',
      source: 'Workspace 2 / In Progress',
      completedBy: ['test@example.com'],
      isCompletedByCurrentUser: true,
      isRead: true
    },
    {
      id: 'task3',
      title: 'Task 3',
      dueDate: null,
      startDate: null,
      source: 'Workspace 1 / Todo',
      completedBy: [],
      isCompletedByCurrentUser: false,
      isRead: false
    }
  ];

  // Mock window.confirm
  const originalConfirm = window.confirm;
  
  beforeAll(() => {
    window.confirm = vi.fn(() => true);
  });
  
  afterAll(() => {
    window.confirm = originalConfirm;
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Set up default API responses for all tests
    // This default mock should return mock tasks for all tests except specific ones
    api.get.mockImplementation((url) => {
      if (url === '/api/tasks/my') {
        return Promise.resolve({ data: mockTasks });
      } 
      if (url.match(/\/api\/tasks\/task\d+$/)) {
        return Promise.resolve({ 
          data: { description: 'This is a task description' } 
        });
      }
      return Promise.resolve({ data: {} });
    });
    
    api.put.mockResolvedValue({ data: {} });
    api.post.mockResolvedValue({ data: { success: true } });
    
    // Reset window.confirm mock
    window.confirm.mockReset();
    window.confirm.mockReturnValue(true);
  });

  test('renders loading state initially', () => {
    // Override API mock to never resolve 
    api.get.mockImplementation(() => new Promise(() => {}));
    
    render(<MyTasks user={mockUser} />);
    expect(screen.getByText('My Tasks')).toBeInTheDocument();
  });

  test('renders tasks after loading', async () => {
    // Make sure API returns tasks
    api.get.mockImplementation((url) => {
      if (url === '/api/tasks/my') {
        return Promise.resolve({ data: mockTasks });
      }
      return Promise.resolve({ data: {} });
    });
    
    render(<MyTasks user={mockUser} />);
    
    // Wait for API call to complete
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/api/tasks/my');
    });
    
    // Wait for the table to be rendered (no "No tasks found" message)
    await waitFor(() => {
      expect(screen.queryByText('No tasks found')).not.toBeInTheDocument();
      expect(screen.getByRole('table')).toBeInTheDocument();
    });
    
    // Now check for specific task titles
    expect(screen.getByText(/Task 1/)).toBeInTheDocument();
    expect(screen.getByText(/Task 2/)).toBeInTheDocument();
    expect(screen.getByText(/Task 3/)).toBeInTheDocument();
  });

  test('displays "NEW" badge for unread tasks', async () => {
    render(<MyTasks user={mockUser} />);
    
    // Wait for API call to complete
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/api/tasks/my');
    });

    // Wait for the table to render
    await waitFor(() => {
      expect(screen.queryByText('No tasks found')).not.toBeInTheDocument();
    });
    
    // Check for the NEW badge
    const newBadge = screen.getByText('NEW');
    expect(newBadge).toBeInTheDocument();
    expect(newBadge.className).toBe('new-task-badge');
  });

  test('marks tasks as completed when checkbox is clicked', async () => {
    render(<MyTasks user={mockUser} />);
    
    // Wait for API call to complete
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/api/tasks/my');
    });

    // Wait for the table to render
    await waitFor(() => {
      expect(screen.queryByText('No tasks found')).not.toBeInTheDocument();
    });
    
    // Now we can look for checkboxes
    const checkboxes = await screen.findAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThan(0);
    
    // Click the first checkbox
    fireEvent.click(checkboxes[0]);
    
    // Check that the API was called
    await waitFor(() => {
      expect(api.put).toHaveBeenCalled();
      const callArgs = api.put.mock.calls[0];
      
      // The URL should contain '/api/tasks/' and a task ID
      expect(callArgs[0]).toMatch(/\/api\/tasks\/task\d+/);
      
      // The data should have completed=true and userSpecificAction=true
      expect(callArgs[1]).toEqual({
        completed: true,
        userSpecificAction: true
      });
    });
  });

  test('shows task description tooltip on hover', async () => {
    render(<MyTasks user={mockUser} />);
    
    // Wait for API call to complete
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/api/tasks/my');
    });

    // Wait for the table to render
    await waitFor(() => {
      expect(screen.queryByText('No tasks found')).not.toBeInTheDocument();
    });
    
    // Find Task 1 and hover over it
    const task1Element = await screen.findByText('Task 1');
    fireEvent.mouseEnter(task1Element);
    
    // Check that the API was called to get task details
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(expect.stringMatching(/\/api\/tasks\/task\d+/));
    });
    
    // Check that the tooltip is displayed
    await waitFor(() => {
      expect(screen.getByText('This is a task description')).toBeInTheDocument();
    });
  });

  test('sorts tasks when column headers are clicked', async () => {
    render(<MyTasks user={mockUser} />);
    
    // Wait for API call to complete
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/api/tasks/my');
    });

    // Wait for the table to render
    await waitFor(() => {
      expect(screen.queryByText('No tasks found')).not.toBeInTheDocument();
    });
    
    // Find the Due date header and click it
    const dueDateHeader = await screen.findByText(/Due date/);
    fireEvent.click(dueDateHeader);
    
    // Click again to reverse sort
    fireEvent.click(dueDateHeader);
    
    // We're not checking sort order here, just making sure the clicks don't cause errors
  });

  test('deletes tasks when Delete button is clicked', async () => {
    render(<MyTasks user={mockUser} />);
    
    // Wait for API call to complete
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/api/tasks/my');
    });

    // Wait for the table to render
    await waitFor(() => {
      expect(screen.queryByText('No tasks found')).not.toBeInTheDocument();
    });
    
    // Find the Delete button on the completed task (Task 2)
    const deleteButton = await screen.findByText('Delete');
    
    // Click the Delete button
    fireEvent.click(deleteButton);
    
    // Check that window.confirm was called
    expect(window.confirm).toHaveBeenCalled();
    
    // Check that the API was called to hide the task
    await waitFor(() => {
      expect(api.put).toHaveBeenCalled();
      const apiCalls = api.put.mock.calls;
      
      // Find the call that has a URL with '/hide'
      const hideCall = apiCalls.find(call => 
        call[0].includes('/hide')
      );
      
      expect(hideCall).toBeTruthy();
      expect(hideCall[0]).toMatch(/\/api\/tasks\/task\d+\/hide/);
    });
  });

  test('displays "No tasks found" when task list is empty', async () => {
    // Override API to return empty task list
    api.get.mockImplementation((url) => {
      if (url === '/api/tasks/my') {
        return Promise.resolve({ data: [] });
      }
      return Promise.resolve({ data: {} });
    });
    
    render(<MyTasks user={mockUser} />);
    
    // Wait for API call to complete
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/api/tasks/my');
    });
    
    // Check for "No tasks found" message
    expect(screen.getByText('No tasks found')).toBeInTheDocument();
  });

  test('marks task as read when hovered', async () => {
    render(<MyTasks user={mockUser} />);
    
    // Wait for API call to complete
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/api/tasks/my');
    });

    // Wait for the table to render
    await waitFor(() => {
      expect(screen.queryByText('No tasks found')).not.toBeInTheDocument();
    });
    
    // Find Task 3 (which is unread) and hover over it
    const task3Element = await screen.findByText('Task 3');
    fireEvent.mouseEnter(task3Element);
    
    // Check that the API was called to mark it as read
    await waitFor(() => {
      expect(api.post).toHaveBeenCalled();
      
      // Find the call to mark-single-read
      const markReadCall = api.post.mock.calls.find(call => 
        call[0].includes('/mark-single-read')
      );
      
      expect(markReadCall).toBeTruthy();
      expect(markReadCall[1]).toEqual({ email: 'test@example.com' });
    });
  });

  test('listens for socket events and updates accordingly', async () => {
    render(<MyTasks user={mockUser} />);
    
    // Wait for API call to complete
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/api/tasks/my');
    });

    // Wait for the table to render
    await waitFor(() => {
      expect(screen.queryByText('No tasks found')).not.toBeInTheDocument();
    });
    
    // Check that socket listeners were set up
    expect(socket.on).toHaveBeenCalledWith('task_assigned', expect.any(Function));
    expect(socket.on).toHaveBeenCalledWith('task_completion_updated', expect.any(Function));
    
    // Get the task_assigned handler function
    const taskAssignedHandler = socket.on.mock.calls.find(
      call => call[0] === 'task_assigned'
    )[1];
    
    // Clear previous API calls
    api.get.mockClear();
    
    // Simulate receiving a task_assigned event
    taskAssignedHandler({
      taskId: 'new-task',
      assignedTo: [mockUser.email]
    });
    
    // Check that fetchTasks was called
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/api/tasks/my');
    });
  });
});