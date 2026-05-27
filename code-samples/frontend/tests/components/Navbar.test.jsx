// frontend/tests/components/Navbar.test.jsx
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';
import Navbar from '../../src/components/Navbar';

//  useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useNavigate: () => mockNavigate
  };
});

describe('Navbar Components', () => {
  const mockUser = {
    email: 'test@example.com'
  };
  
  const mockOnLogout = vi.fn();

  const renderNavbar = (props = {}) => {
    return render(
      <BrowserRouter>
        <Navbar user={props.user} onLogout={props.onLogout || mockOnLogout} />
      </BrowserRouter>
    );
  };

  beforeEach(() => {
    // Reset All Simulations
    vi.clearAllMocks();
  });

  test('Render a welcome message when a user logs in', () => {
    renderNavbar({ user: mockUser });
    
    const welcomeMessage = screen.getByText(/welcome, test@example.com/i);
    expect(welcomeMessage).toBeInTheDocument();
  });

  test('Render a logout button when the user is logged in', () => {
    renderNavbar({ user: mockUser });
    
    const logoutButton = screen.getByRole('button', { name: /logout/i });
    expect(logoutButton).toBeInTheDocument();
  });

  test('onLogout is called when the logout button is clicked', () => {
    renderNavbar({ user: mockUser });
    
    const logoutButton = screen.getByRole('button', { name: /logout/i });
    fireEvent.click(logoutButton);
    
    expect(mockOnLogout).toHaveBeenCalledTimes(1);
  });

  test('Render the login and register buttons when the user is not logged in', () => {
    renderNavbar({ user: null });
    
    const loginButton = screen.getByRole('button', { name: /login/i });
    const signupButton = screen.getByRole('button', { name: /sign up/i });
    
    expect(loginButton).toBeInTheDocument();
    expect(signupButton).toBeInTheDocument();
  });

  test('Click the login button to jump to the dashboard with the login status', () => {
    renderNavbar({ user: null });
    
    const loginButton = screen.getByRole('button', { name: /login/i });
    fireEvent.click(loginButton);
    
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { state: { isSignUp: false } });
  });
});