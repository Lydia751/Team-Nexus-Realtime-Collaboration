
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';
import Dashboard from '../../src/pages/Dashboard';
import api from '../../src/api';

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ state: {} })
  };
});

// Mock api.js
vi.mock('../../src/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn()
  }
}));

// Mock socket.io
vi.mock('../../src/socket', () => ({
  default: {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn()
  }
}));

// Mock window.confirm
const originalConfirm = window.confirm;
beforeAll(() => {
  window.confirm = vi.fn();
});

afterAll(() => {
  window.confirm = originalConfirm;
});

describe('Dashboard Component', () => {
  // Mocked props
  const mockUser = {
    email: 'test@example.com',
    name: 'Test User'
  };
  
  const mockOnLogin = vi.fn();
  const mockOnRegister = vi.fn();
  
  // Mock workplaces data
  const mockWorkplaces = [
    { _id: '1', name: 'Workplace 1', userEmail: 'test@example.com', archived: false },
    { _id: '2', name: 'Workplace 2', userEmail: 'test@example.com', archived: false }
  ];
  
  const mockArchivedWorkplaces = [
    { _id: '3', name: 'Archived Workplace', userEmail: 'test@example.com', archived: true }
  ];

  // Helper function to render Dashboard with given props
  const renderDashboard = (props = {}) => {
    return render(
      <MemoryRouter>
        <Dashboard 
          user={props.user || null} 
          onLogin={props.onLogin || mockOnLogin} 
          onRegister={props.onRegister || mockOnRegister} 
        />
      </MemoryRouter>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock for api.get
    api.get.mockResolvedValue({ data: [] });
    
    // Reset window.confirm mock
    window.confirm.mockReset();
    window.confirm.mockImplementation(() => true);
  });

  test('renders login form when user is not logged in', () => {
    renderDashboard();
    
    expect(screen.getByText(/log in/i, { selector: 'h3' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/email/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument();
  });

  test('switches to sign up form when sign up link is clicked', () => {
    renderDashboard();
    
    const signUpLink = screen.getByText(/sign up/i, { selector: 'span' });
    fireEvent.click(signUpLink);
    
    expect(screen.getByText(/sign up/i, { selector: 'h3' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/full name/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/email/i)).toBeInTheDocument();
    
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Confirm password')).toBeInTheDocument();
    
    expect(screen.getByRole('button', { name: /sign up/i })).toBeInTheDocument();
  });

  test('calls onLogin with email and password when login form is submitted', () => {
    renderDashboard();
    
    const emailInput = screen.getByPlaceholderText(/email/i);
    const passwordInput = screen.getByPlaceholderText('Password');
    const loginButton = screen.getByRole('button', { name: /log in/i });
    
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(loginButton);
    
    expect(mockOnLogin).toHaveBeenCalledWith('test@example.com', 'password123');
  });

  test('calls onRegister with name, email, and password when signup form is submitted', () => {
    renderDashboard();
    
    // Switch to signup form
    const signUpLink = screen.getByText(/sign up/i, { selector: 'span' });
    fireEvent.click(signUpLink);
    
    const nameInput = screen.getByPlaceholderText(/full name/i);
    const emailInput = screen.getByPlaceholderText(/email/i);
    const passwordInput = screen.getByPlaceholderText('Password');
    const signupButton = screen.getByRole('button', { name: /sign up/i });
    
    fireEvent.change(nameInput, { target: { value: 'Test User' } });
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'Password123!' } });
    fireEvent.click(signupButton);
    
    expect(mockOnRegister).toHaveBeenCalledWith('Test User', 'test@example.com', 'Password123!');
  });

  test('renders workplaces when user is logged in', async () => {
    // Mock API response for workplaces
    api.get.mockResolvedValue({ 
      data: [...mockWorkplaces, ...mockArchivedWorkplaces] 
    });
    
    renderDashboard({ user: mockUser });
    
    // Wait for workplaces to load - use URL encoded email
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(`/api/workplaces/${encodeURIComponent(mockUser.email)}`);
    });
    
    // Check if workplaces are rendered
    expect(screen.getByText('Your Workspaces')).toBeInTheDocument();
    
    // Active workplaces
    mockWorkplaces.forEach(workplace => {
      expect(screen.getByText(workplace.name)).toBeInTheDocument();
    });
    
    // Archived workplaces
    expect(screen.getByText('Archived Workspaces')).toBeInTheDocument();
    mockArchivedWorkplaces.forEach(workplace => {
      expect(screen.getByText(workplace.name)).toBeInTheDocument();
    });
  });

  test('shows create workplace modal when "Create new workplace" is clicked', async () => {
    // Mock API response for workplaces
    api.get.mockResolvedValue({ data: mockWorkplaces });
    
    renderDashboard({ user: mockUser });
    
    // Wait for workplaces to load
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(`/api/workplaces/${encodeURIComponent(mockUser.email)}`);
    });
    
    // Click on "Create new workplace"
    const createButton = screen.getByText('+ Create new workplace');
    fireEvent.click(createButton);
    
    // Check if modal is shown
    expect(screen.getByText('Workplace title')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter a title')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument();
  });

  test('creates a new workplace when Create button is clicked in the modal', async () => {
    // Mock API responses
    api.get.mockResolvedValue({ data: mockWorkplaces });
    api.post.mockResolvedValue({ 
      data: { _id: '4', name: 'New Workplace', userEmail: mockUser.email, archived: false } 
    });
    
    renderDashboard({ user: mockUser });
    
    // Wait for workplaces to load
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(`/api/workplaces/${encodeURIComponent(mockUser.email)}`);
    });
    
    // Open modal
    const createButton = screen.getByText('+ Create new workplace');
    fireEvent.click(createButton);
    
    // Enter workplace title
    const titleInput = screen.getByPlaceholderText('Enter a title');
    fireEvent.change(titleInput, { target: { value: 'New Workplace' } });
    
    // Click Create button
    const modalCreateButton = screen.getByRole('button', { name: 'Create' });
    fireEvent.click(modalCreateButton);
    
    // Verify API call
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/api/workplaces', {
        userEmail: mockUser.email,
        name: 'New Workplace'
      });
    });
  });

  test('navigates to workspace page when a workspace card is clicked', async () => {
    // Mock API response for workplaces
    api.get.mockResolvedValue({ data: mockWorkplaces });
    
    renderDashboard({ user: mockUser });
    
    // Wait for workplaces to load
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(`/api/workplaces/${encodeURIComponent(mockUser.email)}`);
    });
    
    // Click on the first workspace
    const workspaceCard = screen.getByText('Workplace 1');
    fireEvent.click(workspaceCard);
    
    // Verify navigation
    expect(mockNavigate).toHaveBeenCalledWith('/workspace/1');
  });
});