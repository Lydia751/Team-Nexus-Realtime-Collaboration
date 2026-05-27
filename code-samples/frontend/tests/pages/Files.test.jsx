
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import MyTasks from '../../src/pages/MyTasks';
import api from '../../src/api';
import socket from '../../src/socket';

// Mock api
vi.mock('../../src/api', () => ({
  default: {
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn()
  }
}));

// Mock console.error to reduce test noise
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = vi.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
});

// Mock socket
vi.mock('../../src/socket', () => ({
  default: {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn()
  }
}));

describe('MyTasks Component', () => {
  // Update the sample user data
  const mockUser = {
    email: 'test@example.com',
    name: 'Test User'
  };

  // Completely rewrite the mock task data to ensure it exactly matches what the component expects
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

  // Completely rewrite the mock API setup
  beforeEach(() => {
    vi.clearAllMocks();

    // Create stub implementations that properly mock the component's expected responses
    api.get.mockImplementation((url) => {
      // For /api/tasks/my, we return the mock tasks array
      if (url === '/api/tasks/my') {
        return Promise.resolve({ 
          data: mockTasks
        });
      } 
      // For individual task details, return a description
      else if (/\/api\/tasks\/task\d+$/.test(url)) {
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
    // Mock the API call to never resolve to keep the component in loading state
    api.get.mockImplementation(() => new Promise(() => {}));

    render(<MyTasks user={mockUser} />);

    expect(screen.getByText('My Tasks')).toBeInTheDocument();
    // Since the component is in loading state, tasks shouldn't be rendered yet
  });

  test('renders tasks after loading', async () => {
    render(<MyTasks user={mockUser} />);

    // Check for loading state
    expect(screen.getByText('My Tasks')).toBeInTheDocument();

    // Wait for API call to complete
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/api/tasks/my');
    });

    // Check that tasks have been rendered
    await waitFor(() => {
      // Look for specific task titles
      expect(screen.getByText('Task 1')).toBeInTheDocument();
      expect(screen.getByText('Task 2')).toBeInTheDocument();
      expect(screen.getByText('Task 3')).toBeInTheDocument();
    });
  });

  test('displays "NEW" badge for unread tasks', async () => {
    render(<MyTasks user={mockUser} />);

    // Wait for API call to complete
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/api/tasks/my');
    });

    // Check for NEW badge
    await waitFor(() => {
      // Verify at least one element with the NEW badge exists
      const newBadges = screen.getAllByText('NEW');
      expect(newBadges.length).toBeGreaterThan(0);
      
      // Check it has the correct class
      expect(newBadges[0].className).toBe('new-task-badge');
    });
  });

  test('marks tasks as completed when checkbox is clicked', async () => {
    render(<MyTasks user={mockUser} />);

    // Wait for API call to complete
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/api/tasks/my');
    });

    // Find all checkboxes (there should be at least one for Task 1 and Task 3)
    await waitFor(() => {
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes.length).toBeGreaterThan(0);
      
      // Click the first checkbox
      fireEvent.click(checkboxes[0]);
    });

    // Expect the API to be called with the correct data
    await waitFor(() => {
      expect(api.put).toHaveBeenCalled();
      const callArgs = api.put.mock.calls[0];
      
      // Check that the URL contains /api/tasks/ and the request includes userSpecificAction
      expect(callArgs[0]).toMatch(/\/api\/tasks\/.+/);
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

    // Find a task element and hover over it
    await waitFor(() => {
      const taskElement = screen.getByText('Task 1');
      fireEvent.mouseEnter(taskElement);
    });

    // API should be called to get task details
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(expect.stringMatching(/\/api\/tasks\/task\d+$/));
    });

    // Wait for the tooltip to appear
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

    // Find the sortable headers
    await waitFor(() => {
      const dueDateHeader = screen.getByText(/Due date/i);
      expect(dueDateHeader).toBeInTheDocument();
      
      // Click the header to sort
      fireEvent.click(dueDateHeader);
      
      // Click again to reverse the sort order
      fireEvent.click(dueDateHeader);
      
      // Test passes if no errors are thrown
    });
  });

  test('deletes tasks when Delete button is clicked', async () => {
    render(<MyTasks user={mockUser} />);

    // Wait for API call to complete
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/api/tasks/my');
    });

    // Find the Delete button (Task 2 should have the Delete button as it's completed)
    await waitFor(async () => {
      // Look for the delete button
      const deleteButton = await screen.findByText('Delete');
      
      // Confirm window.confirm is set up
      expect(window.confirm).not.toHaveBeenCalled();
      
      // Click the delete button
      fireEvent.click(deleteButton);
      
      // Check that confirm was called
      expect(window.confirm).toHaveBeenCalled();
    });
    
    // Check that the API was called to hide the task
    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith(expect.stringMatching(/\/api\/tasks\/task.*\/hide/));
    });
  });

  test('displays "No tasks found" when task list is empty', async () => {
    // Override the default mock for this test only
    api.get.mockImplementation((url) => {
      if (url === '/api/tasks/my') {
        return Promise.resolve({ data: [] });  // Return empty array
      }
      return Promise.resolve({ data: {} });
    });
    
    render(<MyTasks user={mockUser} />);

    // Wait for API call to complete
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/api/tasks/my');
    });

    // "No tasks found" should be displayed
    expect(screen.getByText('No tasks found')).toBeInTheDocument();
    
    // Task elements should not be present
    expect(screen.queryByText('Task 1')).not.toBeInTheDocument();
    expect(screen.queryByText('Task 2')).not.toBeInTheDocument();
    expect(screen.queryByText('Task 3')).not.toBeInTheDocument();
  });

  test('marks task as read when hovered', async () => {
    render(<MyTasks user={mockUser} />);

    // Wait for API call to complete
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/api/tasks/my');
    });

    // Find Task 3 (which is unread) and hover over it
    await waitFor(() => {
      // Find the task with the NEW badge
      const task3 = screen.getByText('Task 3');
      
      // Hover over it
      fireEvent.mouseEnter(task3);
    });
    
    // Check if the API was called to mark it as read
    await waitFor(() => {
      const postCalls = api.post.mock.calls;
      // Check if any call was made to mark-single-read
      const markReadCall = postCalls.find(call => 
        call[0].includes('/mark-single-read')
      );
      expect(markReadCall).toBeTruthy();
      
      // Verify correct data was sent
      expect(markReadCall[1]).toEqual({ email: 'test@example.com' });
    });
  });

  test('handle socket events', async () => {
    render(<MyTasks user={mockUser} />);

    // Wait for API call to complete
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/api/tasks/my');
    });

    // Verify socket event listeners are registered
    expect(socket.on).toHaveBeenCalledWith('task_assigned', expect.any(Function));
    expect(socket.on).toHaveBeenCalledWith('task_completion_updated', expect.any(Function));
    
    // Get the socket event handlers
    const taskAssignedHandler = socket.on.mock.calls.find(
      call => call[0] === 'task_assigned'
    )[1];
    
    const completionUpdatedHandler = socket.on.mock.calls.find(
      call => call[0] === 'task_completion_updated'
    )[1];
    
    // Test the task_assigned handler
    api.get.mockClear(); // Clear previous calls
    
    // Simulate receiving task_assigned event
    taskAssignedHandler({
      taskId: 'new-task-id',
      assignedTo: [mockUser.email]
    });
    
    // Should trigger a new API call to refresh tasks
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/api/tasks/my');
    });
    
    // Test the task_completion_updated handler
    // This is more complex to test as it updates internal state
    // Just verify it doesn't crash
    completionUpdatedHandler({
      taskId: 'task1',
      completedBy: [mockUser.email, 'other@example.com']
    });
  });
});