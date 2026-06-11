import React, { useState, useRef, useEffect } from 'react';

export default function NotificationCenter({ 
  notifications, 
  onMarkRead 
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = () => {
    setIsOpen(!isOpen);
    if (!isOpen && unreadCount > 0) {
      // Mark read when opening
      onMarkRead();
    }
  };

  return (
    <div className="notification-bell-container" ref={dropdownRef}>
      <button 
        className="theme-toggle-btn" 
        onClick={handleToggle}
        title="Notifications"
        style={{ position: 'relative' }}
      >
        🔔
        {unreadCount > 0 && (
          <span className="bell-badge">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="notifications-dropdown">
          <div className="notif-header">
            <span>Notifications</span>
            {unreadCount > 0 && (
              <button className="mark-read-btn" onClick={onMarkRead}>
                Mark read
              </button>
            )}
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {notifications.length === 0 ? (
              <div className="empty-state" style={{ border: 'none', padding: '24px' }}>
                No notifications.
              </div>
            ) : (
              notifications
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                .slice(0, 15) // Show top 15
                .map(n => (
                  <div 
                    key={n.id} 
                    className={`notif-item ${!n.is_read ? 'unread' : ''}`}
                  >
                    <span style={{ fontWeight: 600 }}>{n.title}</span>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{n.message}</span>
                    <span className="notif-time">
                      {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{' '}
                      {new Date(n.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
