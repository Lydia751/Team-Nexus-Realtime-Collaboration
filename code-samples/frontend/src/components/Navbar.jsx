import React from 'react';
import { useNavigate } from 'react-router-dom'; 


const Navbar = ({ user, onLogout }) => {
  const navigate = useNavigate();

  return (
    <div className="navbar">
      {user ? (
        <>
          <div className="navbar-left">Welcome, {user.email}</div>
          <div className="navbar-right">
            <button className="logout-btn" onClick={onLogout}>Logout</button>
          </div>
        </>
      ) : (
        <>
          <div className="navbar-left"></div>
          <div className="navbar-right">
            <button className="logout-btn" onClick={() => navigate('/dashboard', { state: { isSignUp: false } })}>Login</button>
            <button className="logout-btn" onClick={() => navigate('/dashboard', { state: { isSignUp: true } })}>Sign up</button>
          </div>
        </>
      )}
    </div>
  );
};

export default Navbar;
