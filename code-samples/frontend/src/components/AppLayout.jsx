import React from 'react';
import Navbar from './Navbar';

const AppLayout = ({ user, onLogout, children }) => {
  return (
    <>
      <Navbar user={user} onLogout={onLogout} />
      <div style={{ paddingTop: '48px' }}>
        {children}
      </div>
    </>
  );
};

export default AppLayout;
