import React, { useState } from 'react';

export default function SimulatorPanel({ 
  currentUser, 
  whitelist, 
  onSwitchUser 
}) {
  const [collapsed, setCollapsed] = useState(false);

  // Filter whitelist to only show registered users
  const registeredUsers = whitelist.filter(u => u.registered);

  if (registeredUsers.length === 0) return null;

  return (
    <div className={`simulator-drawer ${collapsed ? 'collapsed' : ''}`}>
      <div className="simulator-header" onClick={() => setCollapsed(!collapsed)}>
        <div className="simulator-title">
          <div className="simulator-pulse-dot"></div>
          <span>Aikyam Preview Simulator</span>
        </div>
        <button 
          style={{ 
            background: 'none', 
            border: 'none', 
            color: '#e9f0ec', 
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: 700
          }}
        >
          {collapsed ? '▲ Show Panel' : '▼ Hide Panel'}
        </button>
      </div>

      {!collapsed && (
        <>
          <p style={{ fontSize: '0.8rem', color: '#b3c2bc', marginBottom: '8px' }}>
            Switch roles to test the app from different perspectives (e.g. switch to <strong>Vikram</strong> to send Rohan a request, then switch to <strong>Rohan</strong> to accept it).
          </p>
          <div className="simulator-body">
            {registeredUsers.map(user => {
              const simulatedUserId = `u-${user.name.toLowerCase()}`;
              const isCurrent = currentUser?.id === simulatedUserId;
              
              return (
                <button
                  key={user.email}
                  className={`sim-user-btn ${isCurrent ? 'active' : ''}`}
                  onClick={() => onSwitchUser(simulatedUserId)}
                >
                  {user.name} {user.isAdmin && '👑'}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
